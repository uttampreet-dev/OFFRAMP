import { NextRequest, NextResponse } from "next/server";
import { packById } from "@/lib/db";
import { verifyManifest, type PackManifest } from "@/lib/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Public verification. Anyone holding a sealed pack — the JSON bundle, or the id printed on a
 * certificate — can have the hash chain recomputed here without an account. Only hashes and
 * artefact names travel; no artefact body is ever returned.
 */

function summarise(m: PackManifest, expectRoot?: string | null) {
  const v = verifyManifest(m);
  const rootMatches = expectRoot ? expectRoot.toLowerCase() === m.rootHash.toLowerCase() : null;
  return {
    ok: v.ok && rootMatches !== false,
    brokenAt: v.brokenAt,
    rootMatches,
    caseId: m.caseId,
    sealedAt: m.sealedAt,
    sealedBy: m.sealedBy,
    rootHash: m.rootHash,
    packVersion: m.packVersion,
    artefacts: m.artefacts.map((a, i) => ({ n: i + 1, name: a.name, kind: a.kind, synthetic: a.synthetic, bytes: a.bytes, sha256: a.sha256, chain: m.chain[i] ?? null, summary: a.summary })),
  };
}

function isManifest(x: unknown): x is PackManifest {
  return !!x && typeof x === "object" && Array.isArray((x as PackManifest).artefacts) && Array.isArray((x as PackManifest).chain) && typeof (x as PackManifest).rootHash === "string";
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("pack")?.trim();
  const root = req.nextUrl.searchParams.get("root");
  if (!id) return NextResponse.json({ error: "pack id is required" }, { status: 400 });
  const row = packById(id);
  if (!row) return NextResponse.json({ found: false, id, error: "no pack with this id on this server — paste the JSON bundle instead" }, { status: 404 });
  const m = JSON.parse(row.manifest) as PackManifest;
  return NextResponse.json({ found: true, id, ...summarise(m, root) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as unknown;
  const root = req.nextUrl.searchParams.get("root");
  // accept the raw manifest or the exported bundle that wraps it as { pack, verification }
  const m = isManifest(body) ? body : body && typeof body === "object" && isManifest((body as { pack?: unknown }).pack) ? ((body as { pack: PackManifest }).pack) : null;
  if (!m) return NextResponse.json({ error: "not a pack manifest — paste the JSON bundle exported from Evidence" }, { status: 400 });
  return NextResponse.json({ found: true, id: null, ...summarise(m, root) });
}
