import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { redFlags } from "@/lib/detectors";
import { isSanctioned } from "@/lib/ofac";
import { isReported } from "@/lib/board";
import { knownEntity } from "@/lib/trace/labels";
import { riskScore } from "@/lib/risk";
import { lookupAddress } from "@/lib/chains";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const address = req.nextUrl.searchParams.get("address")?.trim();
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });
  const depth = Number(req.nextUrl.searchParams.get("depth") ?? 2);
  try {
    const rep = await redFlags(address, { depth });
    const ent = knownEntity(address);
    const lk = await lookupAddress(address).catch(() => null);
    const risk = riskScore(address, lk?.transfers ?? [], rep.findings);
    return NextResponse.json({ ...rep, risk, screening: { sanctioned: isSanctioned(address), reported: isReported(address), entity: ent ? { entity: ent.entity, type: ent.type, source: ent.source } : null } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "detector run failed" }, { status: 502 });
  }
}
