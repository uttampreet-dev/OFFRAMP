import { NextResponse } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/auth";
import { audit, revokeSession } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  const s = await getSession();
  if (s) {
    if (s.sid) revokeSession(s.sid);
    audit(s.u, "logout", s.sid ? `session=${s.sid.slice(0, 8)} revoked` : "");
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
