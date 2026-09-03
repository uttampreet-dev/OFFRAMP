import { cachedJson } from "../cache";
import type { LookupResult, Transfer } from "./types";

const BASE = "https://blockstream.info/api";

interface EsploraAddr {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

interface EsploraVin {
  prevout: { scriptpubkey_address?: string; value: number } | null;
}
interface EsploraVout {
  scriptpubkey_address?: string;
  value: number;
}
interface EsploraTx {
  txid: string;
  status: { block_time?: number };
  vin: EsploraVin[];
  vout: EsploraVout[];
}

const SATS = 1e8;

export async function lookupBtc(address: string): Promise<LookupResult> {
  const [a, t] = await Promise.all([
    cachedJson<EsploraAddr>(`${BASE}/address/${address}`),
    cachedJson<EsploraTx[]>(`${BASE}/address/${address}/txs`),
  ]);
  const cs = a.data.chain_stats;

  const transfers: Transfer[] = [];
  for (const tx of t.data) {
    const inAddrs = tx.vin.map((v) => v.prevout?.scriptpubkey_address).filter(Boolean) as string[];
    const weAreSender = inAddrs.includes(address);
    if (weAreSender) {
      for (const o of tx.vout) {
        if (!o.scriptpubkey_address || o.scriptpubkey_address === address) continue;
        transfers.push({
          txid: tx.txid,
          time: tx.status.block_time ? tx.status.block_time * 1000 : null,
          from: address,
          to: o.scriptpubkey_address,
          value: o.value / SATS,
          symbol: "BTC",
          direction: "out",
        });
      }
    } else {
      const received = tx.vout.filter((o) => o.scriptpubkey_address === address).reduce((s, o) => s + o.value, 0);
      if (received > 0) {
        transfers.push({
          txid: tx.txid,
          time: tx.status.block_time ? tx.status.block_time * 1000 : null,
          from: inAddrs[0] ?? "coinbase",
          to: address,
          value: received / SATS,
          symbol: "BTC",
          direction: "in",
        });
      }
    }
  }

  const times = transfers.map((x) => x.time).filter(Boolean) as number[];
  return {
    summary: {
      chain: "btc",
      address,
      txCount: cs.tx_count,
      receivedTotal: cs.funded_txo_sum / SATS,
      sentTotal: cs.spent_txo_sum / SATS,
      balance: (cs.funded_txo_sum - cs.spent_txo_sum) / SATS,
      symbol: "BTC",
      firstSeen: times.length ? Math.min(...times) : null,
      lastSeen: times.length ? Math.max(...times) : null,
    },
    transfers,
    fromCache: a.fromCache && t.fromCache,
    fetchedAt: Math.min(a.fetchedAt, t.fetchedAt),
  };
}
