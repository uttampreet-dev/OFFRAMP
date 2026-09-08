import { NextRequest, NextResponse } from "next/server";
import { lookupAddress, detectChain } from "@/lib/chains";
import { isSanctioned } from "@/lib/ofac";
import { isReported } from "@/lib/board";
import { knownEntity } from "@/lib/trace/labels";
import { riskScore } from "@/lib/risk";
import { extractAddresses, type ScreenRow } from "@/lib/screen";
import { getSession } from "@/lib/auth";
import { audit } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX = 200;
const CONCURRENCY = 4;
const PER_LOOKUP_MS = 12_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("lookup timed out")), ms);
    p.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
  });
}

async function screenOne(address: string): Promise<ScreenRow> {
  const chain = detectChain(address);
  const ke = knownEntity(address);
  const base: ScreenRow = {
    input: address,
    address,
    chain,
    ok: false,
    error: null,
    risk: null,
    sanctioned: isSanctioned(address),
    reported: isReported(address),
    entity: ke ? { entity: ke.entity, type: ke.type, source: ke.source } : null,
    txCount: null,
    balance: null,
    received: null,
    symbol: null,
    lastSeen: null,
    fromCache: false,
  };
  if (!chain) return { ...base, error: "not a recognisable BTC, ETH or TRON address", risk: riskScore(address, []) };
  try {
    const r = await withTimeout(lookupAddress(address), PER_LOOKUP_MS);
    return {
      ...base,
      ok: true,
      risk: riskScore(address, r.transfers),
      txCount: r.summary.txCount,
      balance: r.summary.balance,
      received: r.summary.receivedTotal,
      symbol: r.summary.symbol,
      lastSeen: r.summary.lastSeen,
      fromCache: r.fromCache,
    };
  } catch (e) {
    // screening lists still resolve without chain data; the score then carries list hits only
    return { ...base, error: e instanceof Error ? e.message : "lookup failed", risk: riskScore(address, []) };
  }
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { text?: string; addresses?: string[] };
  const addresses = (body.addresses?.length ? body.addresses.map((a) => a.trim()).filter(Boolean) : extractAddresses(body.text ?? "")).slice(0, MAX);
  if (!addresses.length) return NextResponse.json({ error: "no BTC, ETH or TRON addresses found in the input" }, { status: 400 });
  const t0 = Date.now();
  const rows: ScreenRow[] = new Array(addresses.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, addresses.length) }, async () => {
      while (next < addresses.length) {
        const i = next++;
        rows[i] = await screenOne(addresses[i]);
      }
    }),
  );
  const flagged = rows.filter((r) => r.risk && r.risk.band !== "low").length;
  audit(s.u, "screen.run", `addresses=${rows.length} flagged=${flagged} sanctioned=${rows.filter((r) => r.sanctioned).length} ms=${Date.now() - t0}`);
  return NextResponse.json({ rows, ms: Date.now() - t0, truncated: (body.addresses?.length ?? extractAddresses(body.text ?? "").length) > MAX });
}
