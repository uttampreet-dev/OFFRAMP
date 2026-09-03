import { NextRequest, NextResponse } from "next/server";
import { addWatch, removeWatch, audit } from "@/lib/db";
import { detectChain } from "@/lib/chains";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { address, label } = (await req.json()) as { address?: string; label?: string };
  const a = (address ?? "").trim();
  const chain = detectChain(a);
  if (!chain) return NextResponse.json({ error: "not a recognisable BTC, ETH or TRON address" }, { status: 400 });
  const added = addWatch({ address: a, chain, label: (label ?? "").slice(0, 80), added_by: s.u });
  if (added) audit(s.u, "watch.added", `address=${a} chain=${chain}`);
  return NextResponse.json({ ok: true, added, chain });
}
export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const a = req.nextUrl.searchParams.get("address") ?? "";
  removeWatch(a);
  audit(s.u, "watch.removed", `address=${a}`);
  return NextResponse.json({ ok: true });
}
