import { NextResponse } from "next/server";
import { boardSnapshot, seedWatchFromAddressBook } from "@/lib/board";
import { addWatch, listWatch } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (listWatch().length === 0) seedWatchFromAddressBook(s?.u ?? "system", addWatch);
  try {
    return NextResponse.json(await boardSnapshot());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "board failed" }, { status: 500 });
  }
}
