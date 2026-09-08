import { NextRequest, NextResponse } from "next/server";
import { packById, packetsForCase, audit } from "@/lib/db";
import { renderSTR, renderS63, verifyManifest, type PackManifest } from "@/lib/evidence";
import { getSession } from "@/lib/auth";
import QRCode from "qrcode";

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
  // the verification link printed on the documents: anyone scanning it gets the chain recomputed
  // the code carries the pack's own hashes, so it verifies on any server, even one that never saw this pack
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const base = (process.env.OFFRAMP_PUBLIC_URL ?? `${proto}://${host}`).replace(/\/$/, "");
  const b64 = (hex: string) => Buffer.from(hex, "hex").toString("base64url");
  const carried = Buffer.from(JSON.stringify({ v: 2, c: m.caseId, t: m.sealedAt.slice(0, 19), b: m.sealedBy, r: b64(m.rootHash), a: m.artefacts.map((a) => [a.name, a.kind[0], b64(a.sha256)]) })).toString("base64url");
  const verifyUrl = `${base}/verify?pack=${encodeURIComponent(id)}&root=${m.rootHash}#m=${carried}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 2, width: 320, errorCorrectionLevel: "L", color: { dark: "#0b1f33", light: "#ffffff" } });
  const verifyBlock = `<div style="margin-top:28px;padding-top:14px;border-top:1px solid #d1d5db;display:flex;gap:16px;align-items:flex-start;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11.5px;color:#374151;page-break-inside:avoid">
  <img src="${qr}" width="300" height="300" alt="verification code" style="flex:none;border:1px solid #e5e7eb">
  <div>
    <div style="font-weight:700;color:#111827;letter-spacing:.06em;text-transform:uppercase;font-size:10.5px">Verify this record</div>
    <div style="margin-top:4px">Scan the code with any phone, or open <span style="font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all">${base}/verify</span> and paste the JSON bundle. The code carries the pack\u2019s hashes, so it verifies on any copy of OFFRAMP.</div>
    <div style="margin-top:4px">The page recomputes the SHA-256 hash chain of pack <span style="font-family:ui-monospace,Menlo,Consolas,monospace">${id}</span> and confirms the root below still holds. No account is needed; no artefact content is shown.</div>
    <div style="margin-top:6px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10.5px;word-break:break-all;color:#111827">root ${m.rootHash}</div>
  </div>
</div>`;
  const withVerify = (html: string) => html.replace(/<\/body>/i, `${verifyBlock}\n</body>`);
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
    return new NextResponse(withVerify(html), { headers: { "Content-Type": "text/html; charset=utf-8" } });
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
    return new NextResponse(withVerify(html), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return NextResponse.json({ pack: m, verification: v });
}
