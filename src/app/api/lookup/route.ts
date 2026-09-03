import { NextRequest, NextResponse } from "next/server";
import { lookupAddress, detectChain } from "@/lib/chains";
import { isSanctioned, ofacIndex } from "@/lib/ofac";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim();
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });
  const chain = detectChain(address);
  if (!chain) return NextResponse.json({ error: "Not a recognisable BTC, ETH or TRON address" }, { status: 422 });
  try {
    const result = await lookupAddress(address);
    const idx = ofacIndex();
    return NextResponse.json({
      ...result,
      screening: {
        ofacSanctioned: isSanctioned(address),
        listSize: idx.set.size,
        listSyncedAt: idx.syncedAt,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "lookup failed" }, { status: 502 });
  }
}
