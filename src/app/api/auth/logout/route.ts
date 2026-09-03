import { NextResponse } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/auth";
import { audit } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  const s = await getSession();
  if (s) audit(s.u, "logout");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
