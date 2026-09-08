import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assembleArtefacts, sealPack } from "@/lib/evidence";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { caseId?: string; address?: string; demo?: boolean };
  const caseId = b.caseId ?? "2026-CHD-0417";
  try {
    const artefacts = await assembleArtefacts(caseId, b.address ?? "", !!b.demo || !b.address);
    const m = sealPack(caseId, s.u, artefacts);
    // the manifest travels back with the answer so the screen can render documents even where functions do not share a disk
    const { id, ...manifest } = m;
    return NextResponse.json({ ok: true, id, rootHash: m.rootHash, artefacts: m.artefacts.length, sealedAt: m.sealedAt, by: m.sealedBy, m: Buffer.from(JSON.stringify(manifest)).toString("base64url") });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "seal failed" }, { status: 502 });
  }
}
