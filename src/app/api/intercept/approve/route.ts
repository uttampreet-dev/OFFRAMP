import { NextRequest, NextResponse } from "next/server";
import { approvePacket, packetById, audit } from "@/lib/db";
import { getSession } from "@/lib/auth";
export const runtime = "nodejs";
/** Supervisor sign-off on a sealed packet. The packet body and hash are untouched; approval is a separate, audited fact. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (s.role !== "supervisor") return NextResponse.json({ error: "supervisor role required to sign off a packet" }, { status: 403 });
  const { id } = (await req.json()) as { id?: string };
  const p = id ? packetById(id) : undefined;
  if (!p) return NextResponse.json({ error: "packet not found" }, { status: 404 });
  if (p.approved_by) return NextResponse.json({ error: `already signed off by ${p.approved_by}` }, { status: 409 });
  const r = approvePacket(p.id, s.u)!;
  audit(s.u, "packet.approved", `case=${p.case_id} packet=${p.id} sha256=${p.sha256.slice(0, 12)}`);
  return NextResponse.json({ ok: true, id: r.id, approvedBy: r.approved_by, approvedAt: r.approved_at });
}
