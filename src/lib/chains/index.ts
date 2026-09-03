import { lookupBtc } from "./btc";
import { lookupEth } from "./eth";
import { lookupTron } from "./tron";
import type { Chain, LookupResult } from "./types";

export function detectChain(address: string): Chain | null {
  const a = address.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return "eth";
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return "tron";
  if (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a)) return "btc";
  if (/^bc1[0-9a-z]{20,80}$/.test(a)) return "btc";
  return null;
}

export async function lookupAddress(address: string): Promise<LookupResult> {
  const chain = detectChain(address);
  if (!chain) throw new Error("Not a recognisable BTC, ETH or TRON address");
  if (chain === "btc") return lookupBtc(address.trim());
  if (chain === "tron") return lookupTron(address.trim());
  return lookupEth(address.trim());
}

export type { Chain, LookupResult, AddressSummary, Transfer } from "./types";
