export type Chain = "btc" | "eth" | "tron";

export interface AddressSummary {
  chain: Chain;
  address: string;
  txCount: number;
  receivedTotal: number;
  sentTotal: number;
  balance: number;
  symbol: string;
  firstSeen: number | null;
  lastSeen: number | null;
}

export interface Transfer {
  txid: string;
  time: number | null;
  from: string;
  to: string;
  value: number;
  symbol: string;
  direction: "in" | "out" | "self";
}

export interface LookupResult {
  summary: AddressSummary;
  transfers: Transfer[];
  fromCache: boolean;
  fetchedAt: number;
}
