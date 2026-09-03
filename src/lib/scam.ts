import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data", "scam");

type Report = { source: string; category: string };

let cache: { map: Map<string, Report>; bySource: Record<string, number> } | null = null;

export function scamIndex() {
  if (cache) return cache;
  const map = new Map<string, Report>();
  const bySource: Record<string, number> = {};
  if (existsSync(DIR)) {
    for (const f of readdirSync(DIR)) {
      if (f === "meta.json") continue;
      if (!f.endsWith(".json")) continue;
      const list = JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as {
        address: string;
        category: string;
        source: string;
      }[];
      bySource[f.replace(".json", "")] = list.length;
      for (const row of list) {
        const key = row.address.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, { source: row.source, category: row.category });
        }
      }
    }
  }
  cache = { map, bySource };
  return cache;
}

export function isReported(address: string): { source: string; category: string } | null {
  return scamIndex().map.get(address.trim().toLowerCase()) ?? null;
}
