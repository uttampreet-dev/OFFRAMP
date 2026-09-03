import { NextResponse } from "next/server";
import { buildSyndicates } from "@/lib/syndicates";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(buildSyndicates());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "syndicates failed" }, { status: 500 });
  }
}
