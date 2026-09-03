import { NextRequest, NextResponse } from "next/server";
import { listCases, createCase, nextCaseId, audit, packetsForCase, packsForCase } from "@/lib/db";
import { detectChain } from "@/lib/chains";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = listCases().map((c) => ({ ...c, packets: packetsForCase(c.id).length, packs: packsForCase(c.id).length }));
  return NextResponse.json({ cases: rows });
}
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { seed, title } = (await req.json()) as { seed?: string; title?: string };
  const a = (seed ?? "").trim();
  const chain = detectChain(a);
  if (!chain) return NextResponse.json({ error: "not a recognisable BTC, ETH or TRON address" }, { status: 400 });
  const id = nextCaseId();
  const c = createCase({ id, title: (title ?? "").trim() || `${chain.toUpperCase()} wallet ${a.slice(0, 8)}… · opened from Trace`, status: "intake", chain, seed: a, officer: s.u, synthetic: 0, notes: "" });
  audit(s.u, "case.opened", `case=${id} seed=${a} chain=${chain}`);
  return NextResponse.json(c);
}
