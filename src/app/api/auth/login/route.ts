import { NextRequest, NextResponse } from "next/server";
import { attemptLogin, audit, createSession, LOCK_AFTER, LOCK_MINUTES } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_HOURS_PUBLIC } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  if (!username || !password) return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  const u = username.trim().toLowerCase();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const agent = req.headers.get("user-agent")?.slice(0, 120) ?? null;
  const r = attemptLogin(u, password);
  if (!r.ok) {
    if (r.reason === "locked") {
      audit(u || "unknown", "login.locked", `until=${new Date(r.lockedUntil!).toISOString()} ip=${ip ?? "?"}`);
      const mins = Math.max(1, Math.ceil((r.lockedUntil! - Date.now()) / 60_000));
      return NextResponse.json({ error: `Account locked after ${LOCK_AFTER} failed attempts. Try again in ${mins} min or ask a supervisor to reset it.` }, { status: 423 });
    }
    if (r.reason === "disabled") {
      audit(u, "login.disabled", `ip=${ip ?? "?"}`);
      return NextResponse.json({ error: "This account is disabled. Contact a supervisor." }, { status: 403 });
    }
    audit(u || "unknown", "login.failed", `ip=${ip ?? "?"}`);
    return NextResponse.json({ error: `Invalid credentials. ${LOCK_AFTER} failures lock the account for ${LOCK_MINUTES} minutes.` }, { status: 401 });
  }
  const sess = createSession(r.username, SESSION_HOURS_PUBLIC, ip, agent);
  audit(r.username, "login.ok", `role=${r.role} session=${sess.id.slice(0, 8)} ip=${ip ?? "?"}`);
  const res = NextResponse.json({ ok: true, role: r.role, expiresAt: sess.expiresAt });
  res.cookies.set(SESSION_COOKIE, signSession(r.username, r.role, sess.id, sess.expiresAt), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && !!req.headers.get("x-forwarded-proto")?.includes("https"), path: "/", maxAge: SESSION_HOURS_PUBLIC * 3600 });
  return res;
}
