import { NextResponse } from "next/server";
import { sampleStatements } from "@/lib/bridge/sample";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json({ statements: sampleStatements().map(({ name, account, rows }) => ({ name, account, rows })) });
}
