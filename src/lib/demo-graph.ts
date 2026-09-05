import { lookupAddress } from "./chains";
import { isSanctioned } from "./ofac";
import type { Transfer } from "./chains/types";

export interface DemoGraph { center: string; sanctioned: boolean; transfers: Transfer[]; txCount: number; receivedTotal: number; symbol: string }

/** The hero wallet, resolved on the server so the constellation paints with the headline.
 *  Bounded: if the cache is cold and the explorer is slow, give up quickly and let the client fetch. */
export async function demoGraph(address: string, timeoutMs = 1500): Promise<DemoGraph | null> {
  try {
    const r = await Promise.race([
      lookupAddress(address),
      new Promise<null>((res) => setTimeout(() => res(null), timeoutMs)),
    ]);
    if (!r) return null;
    return { center: address, sanctioned: isSanctioned(address), transfers: r.transfers.slice(0, 60), txCount: r.summary.txCount, receivedTotal: r.summary.receivedTotal, symbol: r.summary.symbol };
  } catch {
    return null;
  }
}
