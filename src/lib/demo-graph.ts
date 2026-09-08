import { lookupAddress } from "./chains";
import { isSanctioned } from "./ofac";
import type { Transfer } from "./chains/types";
import { existsSync, readFileSync } from "fs";
import path from "path";

export interface DemoGraph { center: string; sanctioned: boolean; transfers: Transfer[]; txCount: number; receivedTotal: number; symbol: string }

/** The hero wallet, resolved on the server so the constellation paints with the headline.
 *  Bounded: if the cache is cold and the explorer is slow, give up quickly and let the client fetch. */
export async function demoGraph(address: string, timeoutMs = 1500): Promise<DemoGraph | null> {
  try {
    const r = await Promise.race([
      lookupAddress(address),
      new Promise<null>((res) => setTimeout(() => res(null), timeoutMs)),
    ]);
    if (r) return { center: address, sanctioned: isSanctioned(address), transfers: r.transfers.slice(0, 60), txCount: r.summary.txCount, receivedTotal: r.summary.receivedTotal, symbol: r.summary.symbol };
  } catch {
    /* fall through to the snapshot */
  }
  return snapshot(address);
}

/* A shipped snapshot of the hero wallet paints the constellation on a cold host; the client
 * still refreshes from the chain once mounted. The wallet has been dormant since 2020, so the
 * snapshot and the live answer draw the same picture. */
function snapshot(address: string): DemoGraph | null {
  try {
    const f = path.join(process.cwd(), "data", "demo", "hero-graph.json");
    if (!existsSync(f)) return null;
    const j = JSON.parse(readFileSync(f, "utf8")) as DemoGraph;
    return j.center === address ? { center: j.center, sanctioned: j.sanctioned, transfers: j.transfers, txCount: j.txCount, receivedTotal: j.receivedTotal, symbol: j.symbol } : null;
  } catch {
    return null;
  }
}
