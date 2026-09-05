import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sampleStatements } from "@/lib/bridge/sample";
export const runtime = "nodejs";
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  return NextResponse.json({ statements: sampleStatements().map(({ name, account, rows }) => ({ name, account, rows })) });
}
