import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lookupTx } from "@/lib/chains/tx";
import { isSanctioned } from "@/lib/ofac";
import { knownEntity } from "@/lib/trace/labels";
import { isReported } from "@/lib/board";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const hash = req.nextUrl.searchParams.get("hash")?.trim();
  if (!hash) return NextResponse.json({ error: "hash is required" }, { status: 400 });
  try {
    const tx = await lookupTx(hash);
    const screen = (a: string) => ({ sanctioned: isSanctioned(a), entity: knownEntity(a)?.entity ?? null, reported: isReported(a)?.category ?? null });
    return NextResponse.json({ ...tx, legs: tx.legs.map((l) => ({ ...l, fromScreen: screen(l.from), toScreen: screen(l.to) })) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "transaction lookup failed" }, { status: 502 });
  }
}
