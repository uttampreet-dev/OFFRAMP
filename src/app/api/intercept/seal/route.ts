import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { audit, savePacket } from "@/lib/db";
import { canonical, newId, sha256, type FreezePacket } from "@/lib/intercept";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const packet = (await req.json().catch(() => null)) as FreezePacket | null;
  if (!packet?.caseId || !packet.subject?.address) return NextResponse.json({ error: "packet body required" }, { status: 400 });
  const body = canonical({ ...packet, requestingOfficer: s.u });
  const hash = sha256(body);
  const id = newId("PKT");
  savePacket({ id, case_id: packet.caseId, address: packet.subject.address, body, sha256: hash, created_by: s.u, created_at: Date.now() });
  audit(s.u, "packet.sealed", `case=${packet.caseId} packet=${id} sha256=${hash.slice(0, 12)}`);
  return NextResponse.json({ id, sha256: hash, sealedAt: new Date().toISOString(), by: s.u });
}
