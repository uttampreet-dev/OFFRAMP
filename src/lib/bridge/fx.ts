import { existsSync, readFileSync } from "fs";
import path from "path";

/** INR rate for a chain asset on a given day. Reads data/synthetic/fx.json when
 *  present; otherwise a documented fallback (August 2026 reference levels). */
const FALLBACK: Record<string, number> = { USDT_INR: 85.12, BTC_INR: 5_480_000, ETH_INR: 285_000 };
let table: { rates: Record<string, Record<string, number>>; source: string } | null = null;

function load() {
  if (table) return table;
  const f = path.join(process.cwd(), "data", "synthetic", "fx.json");
  if (existsSync(f)) {
    try {
      const j = JSON.parse(readFileSync(f, "utf8"));
      table = { rates: j.rates ?? {}, source: j.source ?? "data/synthetic/fx.json" };
      return table;
    } catch {
      /* fallback */
    }
  }
  table = { rates: {}, source: "fallback reference rates" };
  return table;
}

export function inrRate(symbol: string, dateIso: string): { rate: number; source: string; fallback: boolean } {
  const key = `${symbol.toUpperCase()}_INR`;
  const t = load();
  const day = t.rates[dateIso];
  if (day && typeof day[key] === "number") return { rate: day[key], source: t.source, fallback: false };
  return { rate: FALLBACK[key] ?? FALLBACK.USDT_INR, source: "fallback reference rate", fallback: true };
}
