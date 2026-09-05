import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cospendBtc } from "@/lib/chains/btc";
import { detectChain } from "@/lib/chains";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const a = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (detectChain(a) !== "btc") return NextResponse.json({ error: "co-spend clustering applies to UTXO chains (BTC)" }, { status: 400 });
  try {
    return NextResponse.json(await cospendBtc(a));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "cluster failed" }, { status: 502 });
  }
}
