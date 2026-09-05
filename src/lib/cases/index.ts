import { getCase, auditForCase, packetsForCase, packsForCase, alertsForCase, type CaseRow } from "../db";
import { lookupAddress } from "../chains";
import { DEMO_CHAIN_EVENTS, DEMO_CASHOUT_WALLET, DEMO_STATEMENT_CSV } from "../bridge/sample";

/*
 * One timeline for everything on a case: the chain events of its seed wallet, the credits
 * on the linked bank statement, the packets and packs sealed for it, the alerts the board
 * raised on it, and every audited action an officer took. Each entry says which side of the
 * seam it came from so the investigator reads crypto and cash on one clock.
 */

export type TimelineKind = "opened" | "audit" | "packet" | "pack" | "alert" | "chain" | "statement";
export interface TimelineItem {
  at: number;
  kind: TimelineKind;
  title: string;
  detail: string;
  by: string;
  /** monetary value where the entry is a movement */
  value?: number;
  symbol?: string;
  /** true when the entry is synthetic demonstration data */
  synthetic?: boolean;
  /** entry the investigator should look at first (a cash-out, a linked credit, a seal) */
  key?: boolean;
}
export interface CaseDetail {
  c: CaseRow;
  timeline: TimelineItem[];
  counts: Record<TimelineKind, number>;
  packets: { id: string; sha256: string; at: number; by: string; approvedBy: string | null; approvedAt: number | null }[];
  packs: { id: string; rootHash: string; at: number; by: string }[];
  /** chain lookups that did not complete inside the budget are reported, never silently dropped */
  chainNote: string | null;
}

const CHAIN_BUDGET_MS = 4000;
const CHAIN_LIMIT = 30;
const STATEMENT_LIMIT = 40;

function parseStatement(csv: string): { at: number; narration: string; debit: number; credit: number; balance: number; channel: string }[] {
  const lines = csv.trim().split("\n").slice(1);
  const rows: { at: number; narration: string; debit: number; credit: number; balance: number; channel: string }[] = [];
  for (const l of lines) {
    const [date, time, narration, , debit, credit, balance, channel] = l.split(",");
    if (!date || !time) continue;
    const at = Date.parse(`${date}T${time}+05:30`);
    if (!Number.isFinite(at)) continue;
    rows.push({ at, narration: narration ?? "", debit: Number(debit) || 0, credit: Number(credit) || 0, balance: Number(balance) || 0, channel: channel ?? "" });
  }
  return rows;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const num = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: v < 1 ? 5 : 2 });
const shortA = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

export async function caseDetail(id: string): Promise<CaseDetail | null> {
  const c = getCase(id);
  if (!c) return null;
  const items: TimelineItem[] = [];
  const rows = auditForCase(id);
  if (!rows.some((a) => a.action === "case.opened")) items.push({ at: c.created_at, kind: "opened", title: "case opened", detail: `${c.chain.toUpperCase()} · seed ${c.seed}`, by: c.officer });
  for (const a of rows) items.push({ at: a.at, kind: a.action === "case.opened" ? "opened" : "audit", title: a.action, detail: a.detail, by: a.username });

  const packetRows = packetsForCase(id);
  for (const p of packetRows) {
    items.push({ at: p.created_at, kind: "packet", title: `freeze packet sealed · ${p.id}`, detail: `sha256 ${p.sha256.slice(0, 20)}… · ${p.address}`, by: p.created_by, key: true });
    if (p.approved_by && p.approved_at) items.push({ at: p.approved_at, kind: "packet", title: `supervisor sign-off · ${p.id}`, detail: `packet approved for dispatch`, by: p.approved_by, key: true });
  }
  for (const p of packsForCase(id)) items.push({ at: p.created_at, kind: "pack", title: `evidence pack sealed · ${p.id}`, detail: `root ${p.root_hash.slice(0, 20)}…`, by: p.created_by, key: true });
  for (const a of alertsForCase(id, c.seed)) items.push({ at: a.at, kind: "alert", title: a.title, detail: `${a.detail}${a.acked_by ? ` · acknowledged by ${a.acked_by}` : ""}`, by: "board" });

  let chainNote: string | null = null;
  if (c.synthetic && c.seed === DEMO_CASHOUT_WALLET) {
    for (const e of DEMO_CHAIN_EVENTS) {
      const key = e.to === DEMO_CASHOUT_WALLET;
      items.push({ at: e.ts, kind: "chain", title: `${e.note}`, detail: `${shortA(e.from)} → ${shortA(e.to)} · tx ${e.txid.slice(0, 12)}…`, by: "chain", value: e.value, symbol: e.symbol, synthetic: true, key });
    }
    // credits and large debits only: the everyday spend on a mule account is noise on a case clock
    for (const r of parseStatement(DEMO_STATEMENT_CSV).filter((r) => r.credit >= 1_000 || r.debit >= 10_000).slice(-STATEMENT_LIMIT)) {
      const key = r.credit >= 500_000 || r.debit >= 500_000;
      items.push({
        at: r.at,
        kind: "statement",
        title: r.credit ? `credit ${inr(r.credit)}` : `debit ${inr(r.debit)}`,
        detail: `${r.narration} · ${r.channel} · balance ${inr(r.balance)}`,
        by: "A/C …4471",
        value: r.credit || r.debit,
        symbol: "INR",
        synthetic: true,
        key,
      });
    }
  } else {
    try {
      const r = await Promise.race([lookupAddress(c.seed), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("chain lookup did not finish inside 4 s")), CHAIN_BUDGET_MS))]);
      const txs = r.transfers.filter((t) => t.time).sort((a, b) => (b.time ?? 0) - (a.time ?? 0)).slice(0, CHAIN_LIMIT);
      for (const t of txs) {
        const out = t.direction === "out";
        items.push({ at: t.time!, kind: "chain", title: out ? `sent ${num(t.value)} ${t.symbol}` : `received ${num(t.value)} ${t.symbol}`, detail: `${out ? "→ " + shortA(t.to) : "← " + shortA(t.from)} · tx ${t.txid.slice(0, 12)}…`, by: "chain", value: t.value, symbol: t.symbol });
      }
      if (r.summary.txCount > txs.length) chainNote = `showing the ${txs.length} most recent of ${r.summary.txCount.toLocaleString()} transfers on the seed wallet`;
    } catch (e) {
      chainNote = e instanceof Error ? e.message : "chain lookup failed";
    }
  }

  items.sort((a, b) => a.at - b.at);
  const counts: Record<TimelineKind, number> = { opened: 0, audit: 0, packet: 0, pack: 0, alert: 0, chain: 0, statement: 0 };
  for (const i of items) counts[i.kind]++;
  const packets = packetRows.map((p) => ({ id: p.id, sha256: p.sha256, at: p.created_at, by: p.created_by, approvedBy: p.approved_by ?? null, approvedAt: p.approved_at ?? null }));
  const packs = packsForCase(id).map((p) => ({ id: p.id, rootHash: p.root_hash, at: p.created_at, by: p.created_by }));
  return { c, timeline: items, counts, packets, packs, chainNote };
}
