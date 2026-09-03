import { detectChain, lookupAddress } from "../chains";
import type { Chain, Transfer } from "../chains/types";
import { isSanctioned } from "../ofac";
import { knownEntity, type KnownEntity } from "./labels";

export type Direction = "out" | "in";

export interface TraceNode {
  address: string;
  hop: number;
  /** value that moved along traced edges into / out of this node */
  inValue: number;
  outValue: number;
  symbol: string;
  txCount: number | null;
  sanctioned: boolean;
  entity: KnownEntity | null;
  /** true when we chose not to expand it (depth or fan-out cap) */
  expanded: boolean;
}
export interface TraceEdge {
  from: string;
  to: string;
  value: number;
  count: number;
  firstTime: number | null;
  lastTime: number | null;
}
export interface TraceResult {
  seed: string;
  chain: Chain;
  direction: Direction;
  depth: number;
  fanout: number;
  nodes: TraceNode[];
  edges: TraceEdge[];
  stats: { requests: number; fromCache: number; ms: number; hopsReached: number };
  /** nodes worth acting on: sanctioned, or attributed to a known entity */
  terminals: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Aggregate one address's transfers into counterparty edges in the chosen direction. */
function aggregate(address: string, transfers: Transfer[], dir: Direction): TraceEdge[] {
  const m = new Map<string, TraceEdge>();
  for (const t of transfers) {
    if (dir === "out" && t.direction !== "out") continue;
    if (dir === "in" && t.direction !== "in") continue;
    const other = dir === "out" ? t.to : t.from;
    if (!other || other === address || other === "coinbase") continue;
    if (!Number.isFinite(t.value) || t.value <= 0 || t.value > 1e12) continue;
    const key = other;
    const e = m.get(key) ?? { from: dir === "out" ? address : other, to: dir === "out" ? other : address, value: 0, count: 0, firstTime: null, lastTime: null };
    e.value += t.value;
    e.count += 1;
    if (t.time) {
      e.firstTime = e.firstTime === null ? t.time : Math.min(e.firstTime, t.time);
      e.lastTime = e.lastTime === null ? t.time : Math.max(e.lastTime, t.time);
    }
    m.set(key, e);
  }
  return [...m.values()].sort((a, b) => b.value - a.value);
}

export async function traceFlow(
  seed: string,
  opts: { depth?: number; fanout?: number; direction?: Direction; maxNodes?: number; concurrency?: number } = {},
): Promise<TraceResult> {
  const depth = Math.min(4, Math.max(1, opts.depth ?? 2));
  const fanout = Math.min(10, Math.max(1, opts.fanout ?? 5));
  const direction = opts.direction ?? "out";
  const maxNodes = opts.maxNodes ?? 60;
  const concurrency = opts.concurrency ?? 3;
  const chain = detectChain(seed);
  if (!chain) throw new Error("Not a recognisable BTC, ETH or TRON address");

  const t0 = Date.now();
  const nodes = new Map<string, TraceNode>();
  const edges: TraceEdge[] = [];
  let requests = 0;
  let fromCache = 0;
  let hopsReached = 0;

  const mk = (address: string, hop: number): TraceNode => ({
    address,
    hop,
    inValue: 0,
    outValue: 0,
    symbol: "",
    txCount: null,
    sanctioned: isSanctioned(address),
    entity: knownEntity(address),
    expanded: false,
  });
  nodes.set(seed, mk(seed, 0));

  let frontier = [seed];
  for (let hop = 0; hop < depth && frontier.length; hop++) {
    const next: string[] = [];
    // expand the frontier with a small worker pool so we stay under public rate limits
    const queue = [...frontier];
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) {
        const address = queue.shift()!;
        if (nodes.size >= maxNodes) return;
        const node = nodes.get(address)!;
        // never expand into a known entity: an exchange deposit is where the trail ends for us
        if (node.entity && hop > 0) continue;
        let transfers: Transfer[] = [];
        try {
          const r = await lookupAddress(address);
          requests += 1;
          if (r.fromCache) fromCache += 1;
          node.symbol = r.summary.symbol;
          node.txCount = r.summary.txCount;
          transfers = r.transfers;
        } catch {
          requests += 1;
          continue;
        }
        node.expanded = true;
        const agg = aggregate(address, transfers, direction).slice(0, fanout);
        for (const e of agg) {
          const other = direction === "out" ? e.to : e.from;
          edges.push(e);
          if (!nodes.has(other)) {
            if (nodes.size >= maxNodes) break;
            const n = mk(other, hop + 1);
            n.symbol = node.symbol;
            nodes.set(other, n);
            next.push(other);
          }
          const a = nodes.get(e.from)!;
          const b = nodes.get(e.to)!;
          if (a) a.outValue += e.value;
          if (b) b.inValue += e.value;
        }
        if (chain === "tron" && !process.env.TRONGRID_API_KEY) await sleep(400);
        else await sleep(80);
      }
    });
    await Promise.all(workers);
    if (next.length) hopsReached = hop + 1;
    frontier = next;
  }

  const list = [...nodes.values()];
  const terminals = list.filter((n) => n.sanctioned || n.entity).map((n) => n.address);
  return {
    seed,
    chain,
    direction,
    depth,
    fanout,
    nodes: list,
    edges,
    stats: { requests, fromCache, ms: Date.now() - t0, hopsReached },
    terminals,
  };
}
