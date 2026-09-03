import type { StatementRow, Statement } from "./parse";
import { inrRate } from "./fx";
import type { ChainEvent } from "./sample";

export interface Linkage {
  event: ChainEvent;
  credit: StatementRow;
  fx: { rate: number; source: string; fallback: boolean };
  expectedInr: number;
  deltaInr: number;
  deltaPct: number;
  deltaMs: number;
  amountScore: number;
  timeScore: number;
  strength: number; // 0–1
  ambiguous: boolean;
  /** this event carried the same funds upstream of the credit's best-matching event */
  upstreamOfBest: boolean;
}
export interface BridgeResult {
  account: string;
  statementSynthetic: boolean;
  chainSynthetic: boolean;
  tolerancePct: number;
  windowHours: number;
  events: ChainEvent[];
  credits: StatementRow[];
  linkages: Linkage[];
  best: Linkage | null;
  candidateEntity: { wallet: string; account: string; strength: number } | null;
}

/**
 * For every on-chain outflow and every INR credit that lands AFTER it within the
 * window: amount agreement (|credit − value×fx| / expected, against tolerance) and
 * time agreement (how soon after). Strength is the geometric mean of the two,
 * so a perfect amount with a late credit still scores honestly lower.
 */
export function correlate(events: ChainEvent[], statement: Statement, opts: { tolerancePct?: number; windowHours?: number; chainSynthetic?: boolean } = {}): BridgeResult {
  const tol = (opts.tolerancePct ?? 5) / 100;
  const win = (opts.windowHours ?? 6) * 3600_000;
  const linkages: Linkage[] = [];
  for (const ev of events) {
    const date = new Date(ev.ts + 5.5 * 3600_000).toISOString().slice(0, 10);
    const fx = inrRate(ev.symbol, date);
    const expected = ev.value * fx.rate;
    for (const cr of statement.credits) {
      const dt = cr.ts - ev.ts;
      if (dt < 0 || dt > win) continue;
      const deltaInr = cr.credit - expected;
      const deltaPct = Math.abs(deltaInr) / expected;
      if (deltaPct > tol) continue;
      const amountScore = 1 - deltaPct / tol;
      const timeScore = 1 - dt / win;
      linkages.push({
        event: ev,
        credit: cr,
        fx,
        expectedInr: expected,
        deltaInr,
        deltaPct,
        deltaMs: dt,
        amountScore,
        timeScore,
        strength: Math.sqrt(Math.max(0, amountScore) * Math.max(0, timeScore)),
        ambiguous: false,
        upstreamOfBest: false,
      });
    }
  }
  linkages.sort((a, b) => b.strength - a.strength);
  // Same funds moving along a chain (A→B, B→C, C→D) are one flow, not rivals:
  // an event is upstream of another if its recipient is the other's sender,
  // transitively, and it happened earlier.
  const upstream = (a: ChainEvent, b: ChainEvent, seen = new Set<string>()): boolean => {
    if (a.ts >= b.ts) return false;
    if (a.to === b.from) return true;
    seen.add(a.txid);
    return events.some((m) => !seen.has(m.txid) && m.ts > a.ts && m.ts < b.ts && a.to === m.from && upstream(m, b, seen));
  };
  const bestFor = new Map<StatementRow, Linkage>();
  for (const l of linkages) if (!bestFor.has(l.credit)) bestFor.set(l.credit, l);
  for (const l of linkages) {
    const best = bestFor.get(l.credit)!;
    if (l !== best && upstream(l.event, best.event)) l.upstreamOfBest = true;
  }
  // ambiguity: an unrelated event competing for the same credit within 0.08
  for (const l of linkages) {
    const rivals = linkages.filter((o) => o !== l && o.credit === l.credit && !o.upstreamOfBest && !l.upstreamOfBest && !upstream(o.event, l.event) && !upstream(l.event, o.event) && Math.abs(o.strength - l.strength) < 0.08);
    l.ambiguous = rivals.length > 0;
  }
  const best = linkages[0] ?? null;
  return {
    account: statement.account,
    statementSynthetic: statement.synthetic,
    chainSynthetic: opts.chainSynthetic ?? false,
    tolerancePct: tol * 100,
    windowHours: win / 3600_000,
    events,
    credits: statement.credits,
    linkages,
    best,
    candidateEntity: best ? { wallet: best.event.to, account: statement.account, strength: best.strength } : null,
  };
}
