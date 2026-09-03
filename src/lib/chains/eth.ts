import { cachedJson } from "../cache";
import type { LookupResult, Transfer } from "./types";

interface EsTx {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  isError: string;
}
interface EsResp {
  status: string;
  message: string;
  result: EsTx[] | string;
}

const WEI = 1e18;

export async function lookupEth(address: string): Promise<LookupResult> {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) {
    throw new Error("ETH lookups need ETHERSCAN_API_KEY in .env.local (free key: etherscan.io/apis)");
  }
  const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${address}&page=1&offset=50&sort=desc&apikey=${key}`;
  const r = await cachedJson<EsResp>(url);
  if (!Array.isArray(r.data.result)) {
    throw new Error(`Etherscan: ${r.data.message || "unexpected response"}`);
  }

  const addr = address.toLowerCase();
  const transfers: Transfer[] = r.data.result
    .filter((tx) => tx.isError === "0" && Number(tx.value) > 0)
    .map((tx) => ({
      txid: tx.hash,
      time: Number(tx.timeStamp) * 1000,
      from: tx.from,
      to: tx.to,
      value: Number(tx.value) / WEI,
      symbol: "ETH",
      direction: tx.from.toLowerCase() === addr ? ("out" as const) : ("in" as const),
    }));

  const inSum = transfers.filter((x) => x.direction === "in").reduce((s, x) => s + x.value, 0);
  const outSum = transfers.filter((x) => x.direction === "out").reduce((s, x) => s + x.value, 0);
  const times = transfers.map((x) => x.time).filter(Boolean) as number[];

  return {
    summary: {
      chain: "eth",
      address,
      txCount: transfers.length,
      receivedTotal: inSum,
      sentTotal: outSum,
      balance: inSum - outSum,
      symbol: "ETH",
      firstSeen: times.length ? Math.min(...times) : null,
      lastSeen: times.length ? Math.max(...times) : null,
    },
    transfers,
    fromCache: r.fromCache,
    fetchedAt: r.fetchedAt,
  };
}
