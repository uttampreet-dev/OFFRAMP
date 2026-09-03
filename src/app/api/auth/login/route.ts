import { NextRequest, NextResponse } from "next/server";
import { verifyUser, audit } from "@/lib/db";
import { signSession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  if (!username || !password) return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  const user = verifyUser(username, password);
  if (!user) {
    audit(username.trim().toLowerCase() || "unknown", "login.failed");
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  audit(user.username, "login.ok", `role=${user.role}`);
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, signSession(user.username, user.role), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 3600,
  });
  return res;
}
