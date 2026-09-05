import { NextRequest, NextResponse } from "next/server";
import { collectReport, renderReport } from "@/lib/report";
import { audit } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const input = await collectReport(id, s.u);
  if (!input) return NextResponse.json({ error: "case not found" }, { status: 404 });
  audit(s.u, "report.exported", `case=${id} packets=${input.packets.length} packs=${input.packs.length} risk=${input.risk.score}`);
  return new NextResponse(renderReport(input), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
