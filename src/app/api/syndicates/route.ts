import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildSyndicates } from "@/lib/syndicates";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  try {
    return NextResponse.json(buildSyndicates());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "syndicates failed" }, { status: 500 });
  }
}
