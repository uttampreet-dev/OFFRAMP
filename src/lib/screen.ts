import type { RiskScore } from "@/lib/risk";

export interface ScreenRow {
  input: string;
  address: string;
  chain: "btc" | "eth" | "tron" | null;
  ok: boolean;
  error: string | null;
  risk: RiskScore | null;
  sanctioned: boolean;
  reported: { source: string; category: string } | null;
  entity: { entity: string; type: string; source: string } | null;
  txCount: number | null;
  balance: number | null;
  received: number | null;
  symbol: string | null;
  lastSeen: number | null;
  fromCache: boolean;
}

/** Pull address-shaped tokens out of free text: one per line, CSV cells, or space separated. */
export function extractAddresses(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tok of text.split(/[\s,;|"']+/)) {
    const t = tok.trim();
    if (!t) continue;
    if (!/^(0x[0-9a-fA-F]{40}|T[1-9A-HJ-NP-Za-km-z]{33}|[13][1-9A-HJ-NP-Za-km-z]{25,34}|bc1[0-9a-z]{20,80})$/.test(t)) continue;
    const key = t.startsWith("0x") ? t.toLowerCase() : t;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
