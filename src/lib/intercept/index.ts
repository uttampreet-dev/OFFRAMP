import { createHash, randomBytes } from "crypto";
import { lookupAddress, detectChain } from "../chains";
import { knownEntity, type KnownEntity } from "../trace/labels";
import { isSanctioned } from "../ofac";
import { inrRate } from "../bridge/fx";

export const POLICY_WINDOW_S = 2 * 3600;

export interface WindowEstimate {
  seconds: number;
  basis: "observed on this wallet" | "policy default";
  pairs: number;
  medianLagS: number | null;
}
export interface InterceptView {
  address: string;
  chain: string;
  caseId: string;
  attribution: KnownEntity | null;
  sanctioned: boolean;
  amount: number;
  symbol: string;
  inrEstimate: number;
  fx: { rate: number; source: string; fallback: boolean };
  trigger: { ts: number; txid: string | null; label: string };
  window: WindowEstimate;
  /** epoch ms when the window closes; remaining = closesAt − now (or replay now) */
  closesAt: number;
  replay: { enabled: boolean; nowTs: number } ;
  packet: FreezePacket;
}
export interface FreezePacket {
  packetVersion: 1;
  caseId: string;
  generatedAt: string;
  requestingOfficer: string;
  subject: { address: string; chain: string; attribution: string; attributionSource: string | null; sanctioned: boolean };
  transaction: { txid: string | null; amount: number; symbol: string; inrEstimate: number; fxRate: number; fxSource: string; triggerAt: string };
  window: { seconds: number; basis: string; closesAt: string };
  requestedAction: string;
  legalBasis: string;
  notes: string[];
}

/** Median gap between a credit to this wallet and its next outflow — measured. */
async function observedLag(address: string): Promise<WindowEstimate> {
  try {
    const r = await lookupAddress(address);
    const ts = r.transfers.filter((t) => t.time).sort((a, b) => a.time! - b.time!);
    const lags: number[] = [];
    for (let i = 0; i < ts.length; i++) {
      if (ts[i].direction !== "in") continue;
      const out = ts.slice(i + 1).find((t) => t.direction === "out");
      if (out) lags.push((out.time! - ts[i].time!) / 1000);
    }
    if (lags.length >= 3) {
      lags.sort((a, b) => a - b);
      const med = lags[Math.floor(lags.length / 2)];
      return { seconds: Math.max(600, Math.min(48 * 3600, med)), basis: "observed on this wallet", pairs: lags.length, medianLagS: med };
    }
    return { seconds: POLICY_WINDOW_S, basis: "policy default", pairs: lags.length, medianLagS: lags.length ? lags[Math.floor(lags.length / 2)] : null };
  } catch {
    return { seconds: POLICY_WINDOW_S, basis: "policy default", pairs: 0, medianLagS: null };
  }
}

export async function buildIntercept(input: {
  address: string;
  amount: number;
  symbol: string;
  caseId: string;
  officer: string;
  triggerTs?: number;
  txid?: string | null;
  replay?: boolean;
}): Promise<InterceptView> {
  const chain = detectChain(input.address) ?? "tron";
  const attribution = knownEntity(input.address);
  const sanctioned = isSanctioned(input.address);
  const window = input.replay ? { seconds: POLICY_WINDOW_S, basis: "policy default" as const, pairs: 0, medianLagS: null } : await observedLag(input.address);
  const triggerTs = input.triggerTs ?? Date.now();
  const closesAt = triggerTs + window.seconds * 1000;
  const date = new Date(triggerTs + 5.5 * 3600_000).toISOString().slice(0, 10);
  const fx = inrRate(input.symbol, date);
  const inrEstimate = input.amount * fx.rate;
  // replay: the demonstration case clock is anchored 12 min 38 s after the trigger
  const nowTs = input.replay ? triggerTs + (12 * 60 + 38) * 1000 : Date.now();
  const packet: FreezePacket = {
    packetVersion: 1,
    caseId: input.caseId,
    generatedAt: new Date(nowTs).toISOString(),
    requestingOfficer: input.officer,
    subject: {
      address: input.address,
      chain,
      attribution: attribution ? `${attribution.entity} (${attribution.type})` : "unattributed — no publicly documented owner",
      attributionSource: attribution?.source ?? null,
      sanctioned,
    },
    transaction: { txid: input.txid ?? null, amount: input.amount, symbol: input.symbol, inrEstimate, fxRate: fx.rate, fxSource: fx.source, triggerAt: new Date(triggerTs).toISOString() },
    window: { seconds: window.seconds, basis: window.basis, closesAt: new Date(closesAt).toISOString() },
    requestedAction: attribution?.type === "exchange" ? `Request ${attribution.entity} to place a temporary hold on the deposit address pending investigation` : "Preserve records and flag the address; no exchange counterparty is attributed",
    legalBasis: "To be issued by the authorised officer under the applicable provisions; this packet is a prepared request, not an order",
    notes: [
      "Amount in INR is an estimate at the day's reference rate.",
      "Attribution is included only where a public source is cited.",
      "OFFRAMP does not freeze funds and does not transmit this packet.",
    ],
  };
  return {
    address: input.address,
    chain,
    caseId: input.caseId,
    attribution,
    sanctioned,
    amount: input.amount,
    symbol: input.symbol,
    inrEstimate,
    fx,
    trigger: { ts: triggerTs, txid: input.txid ?? null, label: attribution ? `funds entered ${attribution.entity} deposit address` : "funds reached the cash-out wallet" },
    window,
    closesAt,
    replay: { enabled: !!input.replay, nowTs },
    packet,
  };
}

/** Deterministic JSON: object keys sorted at every level, arrays kept in order, undefined dropped. */
export function canonical(obj: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return Object.keys(o)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          if (o[k] !== undefined) acc[k] = norm(o[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(norm(obj));
}
export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
export function newId(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}
