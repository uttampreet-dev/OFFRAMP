import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { activeSessions, audit, revokeAllSessions } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  return NextResponse.json({ user: s.u, role: s.role, exp: s.exp, current: s.sid ?? null, sessions: activeSessions(s.u).map((x) => ({ ...x, id: x.id.slice(0, 8), current: x.id === s.sid })) });
}
/** Sign out everywhere: revoke every live session of this user, including this one. */
export async function DELETE() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const n = revokeAllSessions(s.u);
  audit(s.u, "session.revoke_all", `revoked=${n}`);
  return NextResponse.json({ ok: true, revoked: n });
}
