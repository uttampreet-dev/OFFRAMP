/** The demonstration case, both sides SYNTHETIC and labelled as such.
 *  On-chain events mirror the case narrative; the statement is the sample the
 *  whole product story is built on (A/C …4471). */
export interface ChainEvent {
  ts: number; // epoch ms
  from: string;
  to: string;
  value: number;
  symbol: string;
  txid: string;
  note: string;
}
const IST = 5.5 * 3600_000;
const t = (h: number, m: number, s: number) => Date.UTC(2026, 7, 14, h, m, s) - IST;

export const DEMO_CHAIN_EVENTS: ChainEvent[] = [
  { ts: t(11, 2, 16), from: "TKx9cE3uRZ1nq7HaFQ4mW8pLd2sVbY7Ha2", to: "TQm4vLu3ZbK9aH1BdT5wRc7nE2Xf8yG1Bd8", value: 9412, symbol: "USDT", txid: "f1a02c9e7b3d4e5a6c8b9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c", note: "victim payment" },
  { ts: t(11, 9, 44), from: "TQm4vLu3ZbK9aH1BdT5wRc7nE2Xf8yG1Bd8", to: "TZp8sQ2Lm6Kf1RnV4Wa9Yc3Xe7Hb5Gd0Kf1", value: 3137, symbol: "USDT", txid: "a4f19c0b8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0", note: "split 1 of 3" },
  { ts: t(11, 9, 51), from: "TQm4vLu3ZbK9aH1BdT5wRc7nE2Xf8yG1Bd8", to: "TZp8sQ2Lm6Kf1RnV4Wa9Yc3Xe7Hb5Gd0Kf1", value: 3136, symbol: "USDT", txid: "b5e20d1c9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1", note: "split 2 of 3" },
  { ts: t(11, 10, 3), from: "TQm4vLu3ZbK9aH1BdT5wRc7nE2Xf8yG1Bd8", to: "TZp8sQ2Lm6Kf1RnV4Wa9Yc3Xe7Hb5Gd0Kf1", value: 3137, symbol: "USDT", txid: "c6f31e2d0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2", note: "split 3 of 3" },
  { ts: t(11, 28, 31), from: "TZp8sQ2Lm6Kf1RnV4Wa9Yc3Xe7Hb5Gd0Kf1", to: "TBn2wYc9Rc5Hd4Kx1Lp7Qm3Vf8Za6Ne0Rc5", value: 9398, symbol: "USDT", txid: "d7a42f3e1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3", note: "pass-through" },
  { ts: t(11, 43, 9), from: "TBn2wYc9Rc5Hd4Kx1Lp7Qm3Vf8Za6Ne0Rc5", to: "TVd6jP2Lm7Kf3Qa9Rc1Xe5Hb8Nd4Wg0Lm7", value: 9398, symbol: "USDT", txid: "e8b53a4f2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4", note: "CASH-OUT · sold to P2P merchant" },
  { ts: t(12, 30, 0), from: "TBn2wYc9Rc5Hd4Kx1Lp7Qm3Vf8Za6Ne0Rc5", to: "TRfq7XmB3nL8pKw2Qd5Yt9Hc4Vz6Ja1Ef0Rq", value: 200, symbol: "USDT", txid: "f9c64b5a3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5", note: "small onward transfer" },
];

export const DEMO_CASHOUT_WALLET = "TVd6jP2Lm7Kf3Qa9Rc1Xe5Hb8Nd4Wg0Lm7";

const INLINE_STATEMENT_CSV = `date,time,narration,ref,debit,credit,balance,channel
2026-08-13,09:12:40,UPI/collect/…1180,,,1200,19650,UPI
2026-08-13,19:44:03,UPI/pay/…3391,,350,,19300,UPI
2026-08-14,08:01:22,MOBILE RECHARGE,,299,,19001,OTHER
2026-08-14,11:31:07,UPI/collect/…4471,,,42000,61001,UPI
2026-08-14,11:38:52,IMPS/P2P/ref 88120,88120,,115000,176001,IMPS
2026-08-14,11:49:20,IMPS/P2P/ref 88147,88147,,798180,974181,IMPS
2026-08-14,11:56:44,UPI/collect/…9903,,,64500,1038681,UPI
2026-08-14,12:04:11,NEFT/OUT/…2210,2210,690000,,348681,NEFT
2026-08-14,12:11:38,ATM WDL SEC-22 CHD,,100000,,248681,ATM
2026-08-15,10:20:05,UPI/pay/…7712,,1450,,247231,UPI
2026-08-16,13:05:47,ELECTRICITY BILL,,2310,,244921,OTHER
`;

import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
const STATEMENT_DIR = path.join(process.cwd(), "data", "synthetic", "statements");
/** The demonstration statement: the richer synthetic file under data/synthetic when present, else the inline sample. */
export const DEMO_STATEMENT_CSV: string = (() => {
  const f = path.join(STATEMENT_DIR, "demo-case-4471.csv");
  return existsSync(f) ? readFileSync(f, "utf8") : INLINE_STATEMENT_CSV;
})();
/** Synthetic statements available as samples (name → csv). */
export function sampleStatements(): { name: string; account: string; rows: number; csv: string }[] {
  if (!existsSync(STATEMENT_DIR)) return [{ name: "demo-case-4471.csv", account: "XXXXXX4471", rows: INLINE_STATEMENT_CSV.split("\n").length - 1, csv: INLINE_STATEMENT_CSV }];
  return readdirSync(STATEMENT_DIR)
    .filter((f) => f.endsWith(".csv"))
    .sort()
    .map((f) => {
      const csv = readFileSync(path.join(STATEMENT_DIR, f), "utf8");
      const m = /(\d{4})\.csv$/.exec(f);
      return { name: f, account: m ? `XXXXXX${m[1]}` : "XXXXXXXXXX", rows: csv.trim().split("\n").length - 1, csv };
    });
}
