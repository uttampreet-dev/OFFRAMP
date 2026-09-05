import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { traceFlow, type Direction } from "@/lib/trace/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const address = q.get("address")?.trim();
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });
  const depth = Number(q.get("depth") ?? 2);
  const fanout = Number(q.get("fanout") ?? 5);
  const direction = (q.get("dir") === "in" ? "in" : "out") as Direction;
  try {
    const result = await traceFlow(address, { depth, fanout, direction });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "trace failed" }, { status: 502 });
  }
}
