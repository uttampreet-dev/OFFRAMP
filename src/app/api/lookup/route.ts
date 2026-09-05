import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lookupAddress, detectChain } from "@/lib/chains";
import { isSanctioned, ofacIndex } from "@/lib/ofac";
import { isReported } from "@/lib/board";
import { knownEntity } from "@/lib/trace/labels";
import { riskScore } from "@/lib/risk";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const address = req.nextUrl.searchParams.get("address")?.trim();
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });
  const chain = detectChain(address);
  if (!chain) return NextResponse.json({ error: "Not a recognisable BTC, ETH or TRON address" }, { status: 422 });
  try {
    const result = await lookupAddress(address);
    const idx = ofacIndex();
    return NextResponse.json({
      ...result,
      risk: riskScore(address, result.transfers),
      screening: {
        ofacSanctioned: isSanctioned(address),
        listSize: idx.set.size,
        listSyncedAt: idx.syncedAt,
        reported: isReported(address),
        entity: knownEntity(address) ? { entity: knownEntity(address)!.entity, type: knownEntity(address)!.type, source: knownEntity(address)!.source } : null,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "lookup failed" }, { status: 502 });
  }
}
