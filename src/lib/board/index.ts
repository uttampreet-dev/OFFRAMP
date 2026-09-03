import { existsSync, readFileSync } from "fs";
import path from "path";
import { lookupAddress, detectChain } from "../chains";
import type { Transfer } from "../chains/types";
import { isSanctioned, ofacIndex } from "../ofac";
import { knownEntity } from "../trace/labels";
import { listWatch, markWatchSeen, recentAudit, listCases, allPackets, countPackets, type CaseRow, type WatchRow } from "../db";
import { POLICY_WINDOW_S } from "../intercept";

const LOOKUP_TIMEOUT_MS = 10_000;

export interface BoardAddress {
  address: string;
  chain: string;
  label: string;
  symbol: string;
  balance: number | null;
  txCount: number | null;
  lastSeen: number | null;
  latestTx: string | null;
  sanctioned: boolean;
  entity: { entity: string; type: string; source: string } | null;
  reported: { source: string; category: string } | null;
  fromCache: boolean;
  stale: boolean;
  error: string | null;
  newTransfers: Transfer[];
  cases: string[];
}
export interface BoardEvent { at: number; kind: "chain" | "audit"; title: string; detail: string; address: string | null; tone: "amber" | "red" | "teal" | "mut" }
export interface BoardWindow { caseId: string; packetId: string; address: string; amount: number; symbol: string; closesAt: number; replayNow: number | null }
export interface BoardSnapshot {
  polledAt: number;
  watched: BoardAddress[];
  events: BoardEvent[];
  windows: BoardWindow[];
  cases: CaseRow[];
  stats: { watched: number; openCases: number; packets: number; ofac: { total: number; syncedAt: string | null }; reported: number | null };
}

/* Community scam reports (CryptoScamDB export under data/scam) — a report, not a finding. */
let scamIdx: Map<string, { source: string; category: string }> | null = null;
function scamIndex(): Map<string, { source: string; category: string }> {
  if (scamIdx) return scamIdx;
  scamIdx = new Map();
  const dir = path.join(process.cwd(), "data", "scam");
  if (existsSync(dir)) {
    for (const f of ["cryptoscamdb.json"]) {
      const p = path.join(dir, f);
      if (!existsSync(p)) continue;
      try {
        const rows = JSON.parse(readFileSync(p, "utf8")) as { address: string; category: string; source: string }[];
        for (const r of rows) if (r?.address) scamIdx.set(r.address.trim().toLowerCase(), { source: r.source, category: r.category });
      } catch {
        /* ignore malformed file */
      }
    }
  }
  return scamIdx;
}
export function isReported(address: string) {
  return scamIndex().get(address.trim().toLowerCase()) ?? null;
}

/* Demo address book seeds the watch list on first run (verified public addresses). */
export function seedWatchFromAddressBook(addedBy: string, add: (w: { address: string; chain: string; label: string; added_by: string }) => boolean): number {
  const f = path.join(process.cwd(), "data", "demo", "addresses.json");
  if (!existsSync(f)) return 0;
  let n = 0;
  try {
    const rows = JSON.parse(readFileSync(f, "utf8")) as { address: string; chain: string; why?: string }[];
    for (const r of rows.slice(0, 8)) if (add({ address: r.address, chain: r.chain, label: r.why ? r.why.split(" · ")[0].slice(0, 60) : "address book", added_by: addedBy })) n++;
  } catch {
    /* ignore */
  }
  return n;
}

async function evaluate(w: WatchRow, caseIds: Map<string, string[]>): Promise<BoardAddress> {
  const base: BoardAddress = {
    address: w.address,
    chain: w.chain,
    label: w.label,
    symbol: w.last_symbol ?? (w.chain === "btc" ? "BTC" : w.chain === "eth" ? "ETH" : "USDT"),
    balance: w.last_balance,
    txCount: w.last_txcount,
    lastSeen: w.last_seen,
    latestTx: w.last_tx,
    sanctioned: isSanctioned(w.address),
    entity: knownEntity(w.address) ? { entity: knownEntity(w.address)!.entity, type: knownEntity(w.address)!.type, source: knownEntity(w.address)!.source } : null,
    reported: isReported(w.address),
    fromCache: false,
    stale: w.last_balance !== null,
    error: null,
    newTransfers: [],
    cases: caseIds.get(w.address.toLowerCase()) ?? [],
  };
  try {
    const r = await Promise.race([
      lookupAddress(w.address),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`chain lookup exceeded ${LOOKUP_TIMEOUT_MS / 1000} s — showing last known values`)), LOOKUP_TIMEOUT_MS)),
    ]);
    const sorted = [...r.transfers].sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
    const latest = sorted[0]?.txid ?? null;
    let fresh: Transfer[] = [];
    if (w.last_tx && latest && latest !== w.last_tx) {
      const i = sorted.findIndex((t) => t.txid === w.last_tx);
      fresh = i > 0 ? sorted.slice(0, i) : sorted.slice(0, 3);
    }
    /* a token or contract balance derived from transfer lists alone can go negative (internal transfers are not visible); report unknown rather than a wrong number */
    const balance = r.summary.balance < 0 ? null : r.summary.balance;
    markWatchSeen(w.address, latest, r.summary.lastSeen ?? null, balance, r.summary.txCount, r.summary.symbol);
    return { ...base, symbol: r.summary.symbol, balance, txCount: r.summary.txCount, lastSeen: r.summary.lastSeen, latestTx: latest, fromCache: r.fromCache, stale: false, newTransfers: fresh };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "lookup failed" };
  }
}

export async function boardSnapshot(): Promise<BoardSnapshot> {
  const cases = listCases();
  const byAddr = new Map<string, string[]>();
  for (const c of cases) byAddr.set(c.seed.toLowerCase(), [...(byAddr.get(c.seed.toLowerCase()) ?? []), c.id]);
  const watch = listWatch();
  const watched: BoardAddress[] = [];
  for (let i = 0; i < watch.length; i += 3) watched.push(...(await Promise.all(watch.slice(i, i + 3).map((w) => evaluate(w, byAddr)))));

  const events: BoardEvent[] = [];
  for (const a of watched)
    for (const t of a.newTransfers)
      events.push({ at: t.time ?? Date.now(), kind: "chain", title: `${t.direction === "in" ? "inflow" : t.direction === "out" ? "outflow" : "self-transfer"} on watched address`, detail: `${t.value.toLocaleString("en-IN", { maximumFractionDigits: 4 })} ${t.symbol} · ${t.txid.slice(0, 10)}…`, address: a.address, tone: t.direction === "out" ? "amber" : "teal" });
  for (const r of recentAudit(60).filter((r) => !r.action.startsWith("login")).slice(0, 30)) {
    const tone = r.action.includes("sealed") ? "red" : r.action.startsWith("case") ? "amber" : "mut";
    events.push({ at: r.at, kind: "audit", title: `${r.action} · ${r.username}`, detail: r.detail, address: null, tone });
  }
  events.sort((a, b) => b.at - a.at);

  const synthetic = new Set(cases.filter((c) => c.synthetic).map((c) => c.id));
  const windows: BoardWindow[] = [];
  for (const p of allPackets()) {
    try {
      const b = JSON.parse(p.body) as { transaction: { amount: number; symbol: string; triggerAt: string }; window: { seconds: number } };
      const trigger = Date.parse(b.transaction.triggerAt);
      const closesAt = trigger + (b.window?.seconds ?? POLICY_WINDOW_S) * 1000;
      const replay = synthetic.has(p.case_id);
      if (!replay && closesAt < Date.now()) continue;
      windows.push({ caseId: p.case_id, packetId: p.id, address: p.address, amount: b.transaction.amount, symbol: b.transaction.symbol, closesAt, replayNow: replay ? trigger + 758_000 : null });
    } catch {
      /* skip malformed */
    }
  }
  const ofac = ofacIndex();
  const reportedCount = scamIndex().size || null;
  return {
    polledAt: Date.now(),
    watched,
    events: events.slice(0, 40),
    windows,
    cases,
    stats: { watched: watched.length, openCases: cases.filter((c) => c.status !== "closed").length, packets: countPackets(), ofac: { total: ofac.set.size, syncedAt: ofac.syncedAt }, reported: reportedCount },
  };
}

export function chainOf(address: string): string | null {
  return detectChain(address);
}
