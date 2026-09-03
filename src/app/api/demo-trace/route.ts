import { NextRequest, NextResponse } from "next/server";
import { lookupAddress } from "@/lib/chains";
import { isSanctioned, ofacIndex } from "@/lib/ofac";

export const runtime = "nodejs";

// Public, unauthenticated demo endpoint for the landing page. Restricted to a
// curated set of OFAC-listed addresses so it cannot be used as an open proxy.
export const DEMO_ADDRESSES = [
  { address: "12HQDsicffSBaYdJ6BhnE22sfjTESmmzKx", label: "OFAC-listed BTC · 1,335 tx" },
  { address: "1295rkVyNfFpqZpXvKGhDqwhP1jZcNNDMV", label: "OFAC-listed BTC · 3,377 BTC in" },
  { address: "134r8iHv69xdT6p5qVKTsHrcUEuBVZAYak", label: "OFAC-listed BTC · 1,538 BTC in" },
];

const ALLOWED = new Set(DEMO_ADDRESSES.map((d) => d.address));

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!ALLOWED.has(address)) {
    return NextResponse.json({ error: "Demo is limited to the curated address set" }, { status: 403 });
  }
  try {
    const r = await lookupAddress(address);
    return NextResponse.json({
      summary: r.summary,
      transfers: r.transfers.slice(0, 30),
      fromCache: r.fromCache,
      screening: { ofacSanctioned: isSanctioned(address), listSize: ofacIndex().set.size },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "lookup failed" }, { status: 502 });
  }
}
