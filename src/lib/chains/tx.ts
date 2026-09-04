import { createHash } from "crypto";
import { cachedJson } from "../cache";
import type { Chain } from "./types";

export interface TxView {
  chain: Chain;
  hash: string;
  time: number | null;
  block: number | null;
  confirmed: boolean;
  symbol: string;
  legs: { from: string; to: string; value: number }[];
  fee: number | null;
  note?: string;
}

export function detectHash(s: string): "eth" | "hex64" | null {
  const h = s.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(h)) return "eth";
  if (/^[0-9a-fA-F]{64}$/.test(h)) return "hex64";
  return null;
}

/* base58check for TRON hex addresses (41…) */
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(buf: Buffer): string {
  let n = BigInt("0x" + buf.toString("hex"));
  const ZERO = BigInt(0);
  const B = BigInt(58);
  let out = "";
  while (n > ZERO) {
    out = B58[Number(n % B)] + out;
    n /= B;
  }
  for (const b of buf) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out;
}
export function tronHexToBase58(hex: string): string {
  const raw = Buffer.from(hex.replace(/^0x/, ""), "hex");
  const chk = createHash("sha256").update(createHash("sha256").update(raw).digest()).digest().subarray(0, 4);
  return b58(Buffer.concat([raw, chk]));
}

interface EsploraTx { txid: string; status: { confirmed: boolean; block_height?: number; block_time?: number }; fee: number; vin: { prevout: { scriptpubkey_address?: string; value: number } | null }[]; vout: { scriptpubkey_address?: string; value: number }[] }
async function btcTx(hash: string): Promise<TxView> {
  const r = await cachedJson<EsploraTx>(`https://blockstream.info/api/tx/${hash}`);
  const t = r.data;
  const ins = t.vin.map((v) => v.prevout).filter(Boolean) as { scriptpubkey_address?: string; value: number }[];
  const legs: TxView["legs"] = [];
  const from = ins[0]?.scriptpubkey_address ?? "coinbase";
  for (const o of t.vout) if (o.scriptpubkey_address) legs.push({ from, to: o.scriptpubkey_address, value: o.value / 1e8 });
  return { chain: "btc", hash: t.txid, time: t.status.block_time ? t.status.block_time * 1000 : null, block: t.status.block_height ?? null, confirmed: t.status.confirmed, symbol: "BTC", legs, fee: t.fee / 1e8, note: ins.length > 1 ? `${ins.length} inputs — first input shown as sender; all inputs are co-spent (likely one owner)` : undefined };
}

interface EthTxResp { result: { hash: string; from: string; to: string | null; value: string; blockNumber: string | null; input: string } | null }
interface EthBlockResp { result: { timestamp: string } | null }
async function ethTx(hash: string): Promise<TxView> {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) throw new Error("ETH lookups need ETHERSCAN_API_KEY");
  const base = `https://api.etherscan.io/v2/api?chainid=1&module=proxy&apikey=${key}`;
  const r = await cachedJson<EthTxResp>(`${base}&action=eth_getTransactionByHash&txhash=${hash}`);
  const t = r.data.result;
  if (!t) throw new Error("transaction not found on Ethereum");
  let time: number | null = null;
  if (t.blockNumber) {
    const b = await cachedJson<EthBlockResp>(`${base}&action=eth_getBlockByNumber&tag=${t.blockNumber}&boolean=false`);
    if (b.data.result?.timestamp) time = parseInt(b.data.result.timestamp, 16) * 1000;
  }
  const legs: TxView["legs"] = [];
  let symbol = "ETH";
  let note: string | undefined;
  if (t.input && t.input.startsWith("0xa9059cbb") && t.input.length >= 138) {
    const to = "0x" + t.input.slice(34, 74);
    const amt = BigInt("0x" + t.input.slice(74, 138));
    legs.push({ from: t.from, to, value: Number(amt) / 1e6 });
    symbol = "token";
    note = `ERC-20 transfer call to contract ${t.to} — amount shown with 6 decimals (USDT/USDC); other tokens differ`;
  } else {
    legs.push({ from: t.from, to: t.to ?? "contract creation", value: Number(BigInt(t.value)) / 1e18 });
  }
  return { chain: "eth", hash: t.hash, time, block: t.blockNumber ? parseInt(t.blockNumber, 16) : null, confirmed: !!t.blockNumber, symbol, legs, fee: null, note };
}

interface TronTx { txID: string; ret?: { contractRet: string }[]; raw_data: { timestamp: number; contract: { type: string; parameter: { value: { owner_address: string; to_address?: string; amount?: number; contract_address?: string; data?: string } } }[] } }
const USDT_TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
async function tronTx(hash: string): Promise<TxView> {
  const headers: Record<string, string> = {};
  if (process.env.TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"] = process.env.TRONGRID_API_KEY;
  const r = await cachedJson<TronTx>(`https://api.trongrid.io/wallet/gettransactionbyid?value=${hash}`, { headers });
  const t = r.data;
  if (!t?.txID) throw new Error("transaction not found on TRON");
  const c = t.raw_data.contract[0];
  const v = c.parameter.value;
  const from = tronHexToBase58(v.owner_address);
  const legs: TxView["legs"] = [];
  let symbol = "TRX";
  let note: string | undefined;
  if (c.type === "TriggerSmartContract" && v.data && v.data.startsWith("a9059cbb") && v.contract_address) {
    const contract = tronHexToBase58(v.contract_address);
    const to = tronHexToBase58("41" + v.data.slice(32, 72));
    const amt = BigInt("0x" + v.data.slice(72, 136));
    legs.push({ from, to, value: Number(amt) / 1e6 });
    symbol = contract === USDT_TRON ? "USDT" : "TRC-20";
    if (contract !== USDT_TRON) note = `TRC-20 transfer on contract ${contract} — amount shown with 6 decimals`;
  } else if (c.type === "TransferContract" && v.to_address) {
    legs.push({ from, to: tronHexToBase58(v.to_address), value: (v.amount ?? 0) / 1e6 });
  } else {
    note = `contract type ${c.type} — no simple transfer leg`;
  }
  return { chain: "tron", hash: t.txID, time: t.raw_data.timestamp ?? null, block: null, confirmed: t.ret?.[0]?.contractRet === "SUCCESS", symbol, legs, fee: null, note };
}

export async function lookupTx(hash: string): Promise<TxView> {
  const h = hash.trim();
  const kind = detectHash(h);
  if (!kind) throw new Error("Not a recognisable transaction hash");
  if (kind === "eth") return ethTx(h);
  try {
    return await btcTx(h);
  } catch {
    return tronTx(h);
  }
}
