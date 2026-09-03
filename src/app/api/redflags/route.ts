import { NextRequest, NextResponse } from "next/server";
import { redFlags } from "@/lib/detectors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim();
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });
  const depth = Number(req.nextUrl.searchParams.get("depth") ?? 2);
  try {
    return NextResponse.json(await redFlags(address, { depth }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "detector run failed" }, { status: 502 });
  }
}
