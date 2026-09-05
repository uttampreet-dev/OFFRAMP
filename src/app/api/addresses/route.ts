import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { existsSync, readFileSync } from "fs";
import path from "path";
export const runtime = "nodejs";
/** Verified public addresses from the demo address book (data/demo/addresses.json). */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const f = path.join(process.cwd(), "data", "demo", "addresses.json");
  if (!existsSync(f)) return NextResponse.json({ addresses: [] });
  const rows = JSON.parse(readFileSync(f, "utf8")) as { address: string; chain: string; txCount: number; received: number; symbol: string; verifiedOn: string; why: string }[];
  return NextResponse.json({ addresses: rows });
}
