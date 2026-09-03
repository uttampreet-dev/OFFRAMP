import { cachedJson } from "../cache";
import type { LookupResult, Transfer } from "./types";

const BASE = "https://api.trongrid.io";

interface Trc20Tx {
  transaction_id: string;
  block_timestamp: number;
  from: string;
  to: string;
  value: string;
  token_info: { symbol: string; decimals: number };
}
interface Trc20Resp {
  data: Trc20Tx[];
}

/** Canonical USDT (TRC-20). Airdrop spam tokens are everywhere on TRON, so the
 *  summary is computed on USDT first and only falls back to other tokens when
 *  an address has never touched USDT. */
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export async function lookupTron(address: string): Promise<LookupResult> {
  const headers: Record<string, string> = {};
  if (process.env.TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"] = process.env.TRONGRID_API_KEY;

  let t = await cachedJson<Trc20Resp>(
    `${BASE}/v1/accounts/${address}/transactions/trc20?limit=50&contract_address=${USDT_CONTRACT}`,
    { headers },
  );
  let dominantSymbol = "USDT";
  if (!t.data.data?.length) {
    t = await cachedJson<Trc20Resp>(`${BASE}/v1/accounts/${address}/transactions/trc20?limit=50`, { headers });
    const counts = new Map<string, number>();
    for (const tx of t.data.data ?? []) {
      const sym = tx.token_info?.symbol ?? "TRC20";
      counts.set(sym, (counts.get(sym) ?? 0) + 1);
    }
    dominantSymbol = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "TRC20";
  }

  // Spam tokens emit fake transfers with uint256-max "values"; anything past a
  // trillion units is not money, it is noise.
  const SANE_MAX = 1e12;
  const transfers: Transfer[] = (t.data.data ?? [])
    .filter((tx) => (tx.token_info?.symbol ?? "TRC20") === dominantSymbol)
    .filter((tx) => {
      const v = Number(tx.value) / 10 ** (tx.token_info?.decimals ?? 6);
      return Number.isFinite(v) && v > 0 && v < SANE_MAX;
    })
    .map((tx) => {
    const value = Number(tx.value) / 10 ** (tx.token_info?.decimals ?? 6);
    const direction = tx.from === address ? ("out" as const) : tx.to === address ? ("in" as const) : ("self" as const);
    return {
      txid: tx.transaction_id,
      time: tx.block_timestamp ?? null,
      from: tx.from,
      to: tx.to,
      value,
      symbol: tx.token_info?.symbol ?? "TRC20",
      direction,
    };
  });

  const inSum = transfers.filter((x) => x.direction === "in").reduce((s, x) => s + x.value, 0);
  const outSum = transfers.filter((x) => x.direction === "out").reduce((s, x) => s + x.value, 0);
  const times = transfers.map((x) => x.time).filter(Boolean) as number[];

  return {
    summary: {
      chain: "tron",
      address,
      txCount: transfers.length,
      receivedTotal: inSum,
      sentTotal: outSum,
      balance: inSum - outSum,
      symbol: dominantSymbol,
      firstSeen: times.length ? Math.min(...times) : null,
      lastSeen: times.length ? Math.max(...times) : null,
    },
    transfers,
    fromCache: t.fromCache,
    fetchedAt: t.fetchedAt,
  };
}
