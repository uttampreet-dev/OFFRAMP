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

export async function lookupTron(address: string): Promise<LookupResult> {
  const headers: Record<string, string> = {};
  if (process.env.TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"] = process.env.TRONGRID_API_KEY;

  const t = await cachedJson<Trc20Resp>(
    `${BASE}/v1/accounts/${address}/transactions/trc20?limit=50`,
    { headers },
  );

  const transfers: Transfer[] = t.data.data.map((tx) => {
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
      symbol: transfers[0]?.symbol ?? "USDT",
      firstSeen: times.length ? Math.min(...times) : null,
      lastSeen: times.length ? Math.max(...times) : null,
    },
    transfers,
    fromCache: t.fromCache,
    fetchedAt: t.fetchedAt,
  };
}
