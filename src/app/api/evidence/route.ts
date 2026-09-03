import { NextRequest, NextResponse } from "next/server";
import { assembleArtefacts, caseState } from "@/lib/evidence";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const caseId = q.get("case") ?? "2026-CHD-0417";
  const address = q.get("address") ?? "";
  const demo = q.get("demo") === "1" || !address;
  try {
    const artefacts = await assembleArtefacts(caseId, address, demo);
    const st = caseState(caseId);
    return NextResponse.json({
      caseId,
      demo,
      artefacts: artefacts.map(({ body: _b, ...r }) => r),
      packets: st.packets.map((p) => ({ id: p.id, sha256: p.sha256, by: p.created_by, at: p.created_at, address: p.address })),
      packs: st.packs.map((p) => ({ id: p.id, rootHash: p.root_hash, by: p.created_by, at: p.created_at, artefacts: (JSON.parse(p.manifest).artefacts as unknown[]).length })),
      audit: st.audit,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "evidence failed" }, { status: 502 });
  }
}
