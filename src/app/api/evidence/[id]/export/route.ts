import { NextRequest, NextResponse } from "next/server";
import { packById, packetsForCase, audit } from "@/lib/db";
import { renderSTR, renderS63, verifyManifest, type PackManifest } from "@/lib/evidence";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const pack = packById(id);
  if (!pack) return NextResponse.json({ error: "pack not found" }, { status: 404 });
  const m = JSON.parse(pack.manifest) as PackManifest;
  const s = await getSession();
  if (s) audit(s.u, "pack.exported", `case=${m.caseId} pack=${id} format=${format}`);
  const v = verifyManifest(m);
  const packet = packetsForCase(m.caseId)[0];
  const pb = packet ? (JSON.parse(packet.body) as { subject: { address: string; chain: string; attribution: string }; transaction: { amount: number; symbol: string; inrEstimate: number; txid: string | null; triggerAt: string } }) : null;
  const date = new Date().toISOString().slice(0, 10);
  if (format === "str") {
    const html = renderSTR({
      caseId: m.caseId,
      reportingEntity: "Registered Virtual Asset Service Provider / investigating unit",
      principalOfficer: "____________________",
      reference: `STR/${m.caseId}/${id}`,
      date,
      subjectWallet: pb?.subject.address ?? "—",
      chainAsset: pb ? `${pb.subject.chain.toUpperCase()} · ${pb.transaction.symbol}` : "—",
      linkedAccount: "A/C XXXXXX4471 (candidate linkage)",
      attribution: pb?.subject.attribution ?? "—",
      amount: pb ? `${pb.transaction.amount.toLocaleString("en-IN")} ${pb.transaction.symbol}` : "—",
      inr: pb ? `₹${Math.round(pb.transaction.inrEstimate).toLocaleString("en-IN")} (reference rate)` : "—",
      period: pb ? pb.transaction.triggerAt.slice(0, 16).replace("T", " ") + " UTC" : "—",
      txid: pb?.transaction.txid ?? "—",
      grounds: "Funds split across three outputs within seven minutes of receipt; reconsolidated after a six-minute hold consistent with rapid layering under FATF virtual-asset red-flag indicators; cashed out through a peer-to-peer counterparty; INR credit of matching value observed within the time window.",
      evidence: m.artefacts.map((a) => `${a.name} · sha256 ${a.sha256.slice(0, 16)}…`).join("<br>"),
    });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (format === "bsa63") {
    const html = renderS63({
      caseId: m.caseId,
      packId: id,
      rootHash: m.rootHash,
      hash: m.rootHash,
      hashAlgorithm: "SHA-256",
      artefacts: m.artefacts.map((a) => a.name).join(", "),
      recordDescription: `Evidence pack for case ${m.caseId}: ${m.artefacts.length} artefacts (trace, detector findings, correlation, freeze packet)`,
      deviceProcess: "OFFRAMP investigation console — Node.js application; artefacts serialised canonically and hashed with SHA-256; hashes chained in sequence to a root hash",
      date,
      officerName: m.sealedBy,
      verified: v.ok ? "verified — chain intact" : `FAILED at artefact ${v.brokenAt}`,
    });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return NextResponse.json({ pack: m, verification: v });
}
