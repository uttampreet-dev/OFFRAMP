import { readFileSync } from "fs";
import path from "path";

export interface Entity {
  address: string;
  chain: "btc" | "eth" | "tron";
  entity: string;
  type: "exchange" | "mixer" | "p2p";
  source: string;
}

let idx: Map<string, Entity> | null = null;

function load() {
  if (idx) return idx;
  const list = JSON.parse(
    readFileSync(path.join(process.cwd(), "data", "known-entities.json"), "utf8")
  ) as Entity[];
  idx = new Map(list.map((e) => [e.address.toLowerCase(), e]));
  return idx;
}

export function lookupEntity(address: string): Entity | null {
  return load().get(address.trim().toLowerCase()) ?? null;
}
