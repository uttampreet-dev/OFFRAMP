import { existsSync, readFileSync } from "fs";
import path from "path";
import type { Chain } from "../chains/types";

export interface KnownEntity {
  address: string;
  chain: Chain;
  entity: string;
  type: "exchange" | "mixer" | "p2p";
  source: string;
}

/* Fallback until data/known-entities.json exists: one publicly documented wallet. */
const FALLBACK: KnownEntity[] = [
  {
    address: "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s",
    chain: "btc",
    entity: "Binance",
    type: "exchange",
    source: "https://blockchair.com/bitcoin/address/1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s",
  },
];

let idx: Map<string, KnownEntity> | null = null;
function load(): Map<string, KnownEntity> {
  if (idx) return idx;
  const f = path.join(process.cwd(), "data", "known-entities.json");
  let list: KnownEntity[] = FALLBACK;
  if (existsSync(f)) {
    try {
      const parsed = JSON.parse(readFileSync(f, "utf8")) as KnownEntity[];
      if (Array.isArray(parsed) && parsed.length) list = parsed;
    } catch {
      /* keep fallback */
    }
  }
  idx = new Map(list.map((e) => [e.address.toLowerCase(), e]));
  return idx;
}

export function knownEntity(address: string): KnownEntity | null {
  return load().get(address.trim().toLowerCase()) ?? null;
}
export function knownEntityCount(): number {
  return load().size;
}
