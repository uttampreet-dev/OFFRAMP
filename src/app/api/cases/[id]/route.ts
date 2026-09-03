import { NextRequest, NextResponse } from "next/server";
import { updateCase, audit, type CaseStatus } from "@/lib/db";
import { caseDetail } from "@/lib/cases";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const STATUSES: CaseStatus[] = ["intake", "tracing", "cash-out", "escalated", "closed"];

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = caseDetail(id);
  return d ? NextResponse.json(d) : NextResponse.json({ error: "case not found" }, { status: 404 });
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json()) as { status?: string; notes?: string; title?: string };
  const status = body.status && STATUSES.includes(body.status as CaseStatus) ? (body.status as CaseStatus) : undefined;
  const c = updateCase(id, { status, notes: body.notes, title: body.title });
  if (!c) return NextResponse.json({ error: "case not found" }, { status: 404 });
  audit(s.u, "case.updated", `case=${id}${status ? ` status=${status}` : ""}${body.notes !== undefined ? " notes" : ""}`);
  return NextResponse.json(c);
}
