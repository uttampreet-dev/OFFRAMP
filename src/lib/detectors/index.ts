import { lookupAddress } from "../chains";
import type { LookupResult, Transfer } from "../chains/types";
import { isSanctioned } from "../ofac";
import { traceFlow, type TraceResult } from "../trace/engine";
import { knownEntity } from "../trace/labels";

/* ─────────────────────────────────────────────────────────────────────────
   Ten explainable detectors. Each is a named rule with a stated threshold and
   returns the evidence it saw. Nothing here is a score out of a hundred —
   a flag is presumptive and must be corroborated before anyone acts on it.
   Indicator groups follow FATF, "Virtual Assets: Red Flag Indicators of
   Money Laundering and Terrorist Financing" (Sept 2020).
   ───────────────────────────────────────────────────────────────────────── */

export type Severity = "high" | "medium" | "info";
export interface Finding {
  id: string;
  name: string;
  fatf: string;
  severity: Severity;
  fired: boolean;
  /** heuristic strength 0–1 when fired; 0 when clear */
  confidence: number;
  /** one line for the list view */
  summary: string;
  /** the evidence, line by line */
  evidence: string[];
  txids: string[];
}
export interface RedFlagReport {
  address: string;
  chain: string;
  findings: Finding[];
  fired: number;
  stats: { transfersExamined: number; hopsExamined: number; requests: number; ms: number };
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const short = (a: string) => `${a.slice(0, 7)}…${a.slice(-5)}`;
const fmt = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: v < 1 ? 5 : 2 });
const when = (t: number | null) => (t ? new Date(t).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "unknown time");

interface Ctx {
  seed: LookupResult;
  trace: TraceResult;
  /** transfer lists for hop-1 intermediaries, keyed by address */
  hop1: Map<string, Transfer[]>;
}

function mk(id: string, name: string, fatf: string, severity: Severity): Finding {
  return { id, name, fatf, severity, fired: false, confidence: 0, summary: "", evidence: [], txids: [] };
}
function clear(f: Finding, why: string): Finding {
  f.fired = false;
  f.confidence = 0;
  f.summary = why;
  return f;
}
function fire(f: Finding, confidence: number, summary: string, evidence: string[], txids: string[] = []): Finding {
  f.fired = true;
  f.confidence = Math.max(0.05, Math.min(1, confidence));
  f.summary = summary;
  f.evidence = evidence;
  f.txids = txids.slice(0, 8);
  return f;
}

/* 1 ─ rapid layering: money received then forwarded within a short window,
       through intermediaries that hold nothing */
function rapidLayering(c: Ctx): Finding {
  const f = mk("rapid-layering", "Rapid layering", "Transaction patterns — immediate onward transfer", "high");
  const hits: string[] = [];
  const tx: string[] = [];
  for (const [addr, transfers] of c.hop1) {
    const ins = transfers.filter((t) => t.direction === "in" && t.time).sort((a, b) => a.time! - b.time!);
    const outs = transfers.filter((t) => t.direction === "out" && t.time).sort((a, b) => a.time! - b.time!);
    const maxIn = Math.max(0, ...ins.map((t) => t.value));
    for (const i of ins) {
      if (i.value < maxIn * 0.05) continue; // ignore dust inflows
      const o = outs.find((x) => x.time! > i.time! && x.time! - i.time! < 2 * HOUR && x.value >= i.value * 0.6 && x.value <= i.value * 1.5);
      if (o) {
        const mins = Math.round((o.time! - i.time!) / 60000);
        hits.push(`${short(addr)} received ${fmt(i.value)} ${i.symbol} and forwarded ${fmt(o.value)} ${o.symbol} ${mins} min later`);
        tx.push(o.txid);
        break;
      }
    }
  }
  if (!hits.length) return clear(f, "No intermediary forwarded funds within 2 hours of receipt");
  return fire(f, Math.min(1, 0.45 + hits.length * 0.2), `${hits.length} intermediar${hits.length === 1 ? "y" : "ies"} forwarded funds within 2 hours of receipt`, hits, tx);
}

/* 2 ─ structuring: one outflow split into several similar-sized pieces in a short window */
function structuring(c: Ctx): Finding {
  const f = mk("structuring", "Structuring / splitting", "Transaction patterns — structuring below thresholds", "high");
  const outs = c.seed.transfers.filter((t) => t.direction === "out" && t.time).sort((a, b) => a.time! - b.time!);
  for (let i = 0; i < outs.length; i++) {
    const win = outs.filter((t) => t.time! >= outs[i].time! && t.time! - outs[i].time! < 30 * 60_000);
    if (win.length >= 3) {
      const vals = win.map((t) => t.value);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const spread = Math.max(...vals) / Math.max(1e-12, Math.min(...vals));
      if (spread < 3 && mean > 0) {
        return fire(
          f,
          Math.min(1, 0.5 + (win.length - 3) * 0.12),
          `${win.length} similar-sized outflows within 30 minutes`,
          [
            `${win.length} transfers between ${when(win[0].time)} and ${when(win[win.length - 1].time)}`,
            `values ${fmt(Math.min(...vals))} – ${fmt(Math.max(...vals))} ${win[0].symbol} (spread ×${spread.toFixed(1)})`,
            `recipients: ${[...new Set(win.map((t) => short(t.to)))].join(", ")}`,
          ],
          win.map((t) => t.txid),
        );
      }
    }
  }
  return clear(f, "No burst of similar-sized outflows");
}

/* 3 ─ P2P off-ramp: a downstream counterparty that transacts with very many parties */
function p2pOfframp(c: Ctx): Finding {
  const f = mk("p2p-offramp", "P2P off-ramp counterparty", "Senders/recipients — high-throughput unregistered counterparties", "medium");
  const busy = c.trace.nodes
    .filter((n) => n.hop > 0 && n.txCount !== null && n.txCount >= 200 && !n.entity)
    .sort((a, b) => (b.txCount ?? 0) - (a.txCount ?? 0));
  if (!busy.length) return clear(f, "No high-throughput unattributed counterparty downstream");
  return fire(
    f,
    Math.min(1, 0.4 + busy.length * 0.15),
    `${busy.length} unattributed counterpart${busy.length === 1 ? "y" : "ies"} with ≥200 transfers`,
    busy.slice(0, 4).map((n) => `${short(n.address)} · hop ${n.hop} · ${n.txCount!.toLocaleString()} transfers seen · ${fmt(n.inValue)} ${n.symbol} traced in`),
  );
}

/* 4 ─ velocity spike: the recent window is far busier than the address's baseline */
function velocitySpike(c: Ctx): Finding {
  const f = mk("velocity-spike", "Velocity spike", "Transaction patterns — unusual frequency", "medium");
  const ts = c.seed.transfers.map((t) => t.time).filter(Boolean) as number[];
  if (ts.length < 6) return clear(f, "Too few timestamped transfers to establish a baseline");
  const first = Math.min(...ts);
  const last = Math.max(...ts);
  const spanDays = Math.max(1, (last - first) / DAY);
  const baselinePerDay = ts.length / spanDays;
  const recent = ts.filter((t) => last - t < DAY).length;
  if (recent >= 6 && recent > baselinePerDay * 4) {
    return fire(f, Math.min(1, 0.4 + (recent / Math.max(1, baselinePerDay * 4)) * 0.15), `${recent} transfers in the last active day vs ${baselinePerDay.toFixed(1)}/day baseline`, [
      `baseline: ${ts.length} transfers over ${spanDays.toFixed(0)} days = ${baselinePerDay.toFixed(2)} per day`,
      `busiest 24h ending ${when(last)}: ${recent} transfers`,
    ]);
  }
  return clear(f, `Activity within ${Math.max(1, Math.round(baselinePerDay))}/day baseline`);
}

/* 5 ─ mixer contact: any traced node attributed to a mixer */
function mixerContact(c: Ctx): Finding {
  const f = mk("mixer-contact", "Mixer / tumbler contact", "Anonymity — mixing and tumbling services", "high");
  const m = c.trace.nodes.filter((n) => n.entity?.type === "mixer");
  if (!m.length) return clear(f, "No known mixer in the traced flow");
  return fire(f, 0.9, `${m.length} known mixer${m.length === 1 ? "" : "s"} in the flow`, m.map((n) => `${short(n.address)} · ${n.entity!.entity} · hop ${n.hop} · source: ${n.entity!.source}`));
}

/* 6 ─ sanctions hit: seed or any traced node on the OFAC SDN list */
function sanctionsHit(c: Ctx): Finding {
  const f = mk("sanctions-hit", "Sanctions list hit", "Senders/recipients — sanctioned persons and entities", "high");
  const hits = c.trace.nodes.filter((n) => n.sanctioned);
  if (!hits.length) return clear(f, "No OFAC SDN address in the seed or traced flow");
  const seedHit = hits.some((n) => n.hop === 0);
  return fire(
    f,
    seedHit ? 1 : Math.min(1, 0.5 + hits.length * 0.1),
    seedHit ? `Seed wallet is on the OFAC SDN list${hits.length > 1 ? ` · ${hits.length - 1} more downstream` : ""}` : `${hits.length} sanctioned wallet${hits.length === 1 ? "" : "s"} within ${c.trace.stats.hopsReached} hops`,
    hits.slice(0, 6).map((n) => `${short(n.address)} · hop ${n.hop} · US Treasury SDN digital-currency list`),
  );
}

/* 7 ─ bridge hop: contact with a known cross-chain bridge */
function bridgeHop(c: Ctx): Finding {
  const f = mk("bridge-hop", "Cross-chain bridge hop", "Transaction patterns — chain hopping", "medium");
  const b = c.trace.nodes.filter((n) => n.entity && /bridge/i.test(`${n.entity.entity} ${n.entity.type}`));
  if (!b.length) return clear(f, "No known bridge contract in the traced flow");
  return fire(f, 0.7, `${b.length} bridge contact${b.length === 1 ? "" : "s"}`, b.map((n) => `${short(n.address)} · ${n.entity!.entity} · hop ${n.hop}`));
}

/* 8 ─ dormant reactivation: a long silence followed by a burst */
function dormantReactivation(c: Ctx): Finding {
  const f = mk("dormant-reactivation", "Dormant wallet reactivated", "Transaction patterns — dormant accounts suddenly active", "info");
  const ts = (c.seed.transfers.map((t) => t.time).filter(Boolean) as number[]).sort((a, b) => a - b);
  if (ts.length < 3) return clear(f, "Too few timestamped transfers");
  let bestGap = 0;
  let at = 0;
  for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > bestGap) { bestGap = ts[i] - ts[i - 1]; at = i; }
  if (bestGap > 90 * DAY) {
    const after = ts.filter((t) => t >= ts[at] && t - ts[at] < 7 * DAY).length;
    return fire(f, Math.min(1, 0.4 + after * 0.08), `${Math.round(bestGap / DAY)} days silent, then ${after} transfers within a week`, [
      `last activity before the gap: ${when(ts[at - 1])}`,
      `reactivated: ${when(ts[at])} · ${after} transfers in the following 7 days`,
    ]);
  }
  return clear(f, `Longest silence ${Math.round(bestGap / DAY)} days`);
}

/* 9 ─ peel chain: a chain of outputs where one large remainder carries on and small
       amounts peel off each step (classic Bitcoin laundering shape) */
function peelChain(c: Ctx): Finding {
  const f = mk("peel-chain", "Peel chain", "Transaction patterns — layering through successive small outputs", "medium");
  if (c.trace.chain !== "btc") return clear(f, "Pattern assessed on UTXO chains only");
  const outs = c.seed.transfers.filter((t) => t.direction === "out").sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  if (outs.length < 4) return clear(f, "Too few outflows to form a chain");
  const byTx = new Map<string, Transfer[]>();
  for (const o of outs) byTx.set(o.txid, [...(byTx.get(o.txid) ?? []), o]);
  const continuing = new Set(c.trace.nodes.filter((n) => n.hop >= 1 && n.expanded && n.outValue > 0 && !n.entity).map((n) => n.address));
  let peels = 0;
  let shaped = 0;
  for (const list of byTx.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => b.value - a.value);
    if (sorted[0].value > sorted[1].value * 8) {
      shaped += 1;
      if (continuing.has(sorted[0].to)) peels += 1; // the remainder went on to a wallet that kept moving it
    }
  }
  if (peels >= 3) {
    return fire(f, Math.min(0.75, 0.35 + peels * 0.08), `${peels} successive remainders carried on through wallets that spent onward`, [
      `${shaped} of ${byTx.size} outgoing transactions have one output ≥8× the next`,
      `${peels} of those remainders reached an intermediary that moved the funds again`,
      `shape is consistent with peeling; it does not establish common control`,
    ]);
  }
  return clear(f, shaped ? `${shaped} peel-shaped transaction${shaped === 1 ? "" : "s"}, but the remainder did not visibly continue (threshold 3)` : "No peel-shaped transactions");
}

/* 10 ─ round-number transfers: repeated exactly-round amounts */
function roundNumbers(c: Ctx): Finding {
  const f = mk("round-number", "Round-number transfers", "Transaction patterns — round amounts inconsistent with commerce", "info");
  const isRound = (v: number) => v >= 1 && Number.isInteger(v) && (v % 100 === 0 || v % 1000 === 0 || v % 10 === 0 || v % 1 === 0 && v <= 10);
  const r = c.seed.transfers.filter((t) => isRound(t.value));
  if (r.length >= 3) {
    return fire(f, Math.min(1, 0.3 + r.length * 0.08), `${r.length} exactly-round transfers`, r.slice(0, 5).map((t) => `${t.direction} ${fmt(t.value)} ${t.symbol} · ${when(t.time)}`), r.map((t) => t.txid));
  }
  return clear(f, `${r.length} round-value transfer${r.length === 1 ? "" : "s"} — below threshold of 3`);
}

export async function redFlags(address: string, opts: { depth?: number } = {}): Promise<RedFlagReport> {
  const t0 = Date.now();
  const [seed, trace] = await Promise.all([lookupAddress(address), traceFlow(address, { depth: opts.depth ?? 2, fanout: 5 })]);
  let requests = 2 + trace.stats.requests;
  const hop1 = new Map<string, Transfer[]>();
  const intermediaries = trace.nodes.filter((n) => n.hop === 1 && !n.entity).slice(0, 5);
  for (const n of intermediaries) {
    try {
      const r = await lookupAddress(n.address);
      requests += 1;
      hop1.set(n.address, r.transfers);
    } catch {
      /* skip */
    }
  }
  const ctx: Ctx = { seed, trace, hop1 };
  const findings = [rapidLayering, structuring, p2pOfframp, velocitySpike, mixerContact, sanctionsHit, bridgeHop, dormantReactivation, peelChain, roundNumbers].map((d) => d(ctx));
  const order: Record<Severity, number> = { high: 0, medium: 1, info: 2 };
  findings.sort((a, b) => Number(b.fired) - Number(a.fired) || order[a.severity] - order[b.severity]);
  void isSanctioned;
  void knownEntity;
  return {
    address,
    chain: trace.chain,
    findings,
    fired: findings.filter((f) => f.fired).length,
    stats: { transfersExamined: seed.transfers.length + [...hop1.values()].reduce((s, t) => s + t.length, 0), hopsExamined: trace.stats.hopsReached, requests, ms: Date.now() - t0 },
  };
}
