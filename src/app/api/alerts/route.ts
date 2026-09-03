import { NextRequest, NextResponse } from "next/server";
import { ackAlert, audit, openAlerts } from "@/lib/db";
import { getSession } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ alerts: openAlerts() });
}
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { key } = (await req.json()) as { key?: string };
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
  ackAlert(key, s.u);
  audit(s.u, "alert.acked", `key=${key}`);
  return NextResponse.json({ ok: true });
}
