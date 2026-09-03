import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data", "ofac");

let cache: { set: Set<string>; byAsset: Record<string, number>; syncedAt: string | null } | null = null;

export function ofacIndex() {
  if (cache) return cache;
  const set = new Set<string>();
  const byAsset: Record<string, number> = {};
  let syncedAt: string | null = null;
  if (existsSync(DIR)) {
    for (const f of readdirSync(DIR)) {
      if (f === "meta.json") {
        syncedAt = JSON.parse(readFileSync(path.join(DIR, f), "utf8")).syncedAt ?? null;
        continue;
      }
      if (!f.endsWith(".json")) continue;
      const list = JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as string[];
      byAsset[f.replace(".json", "")] = list.length;
      for (const a of list) set.add(a.toLowerCase());
    }
  }
  cache = { set, byAsset, syncedAt };
  return cache;
}

export function isSanctioned(address: string): boolean {
  return ofacIndex().set.has(address.trim().toLowerCase());
}
