import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { audit, checkPassword, setPassword, revokeAllSessions } from "@/lib/db";
export const runtime = "nodejs";
/** Change your own password. Requires the current one; ends every other session of this user. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { current, next } = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  if (!current || !next) return NextResponse.json({ error: "current and new password are required" }, { status: 400 });
  if (!checkPassword(s.u, current)) {
    audit(s.u, "password.change.failed", "current password wrong");
    return NextResponse.json({ error: "current password is wrong" }, { status: 403 });
  }
  try {
    setPassword(s.u, next);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "rejected" }, { status: 400 });
  }
  const n = revokeAllSessions(s.u, s.sid);
  audit(s.u, "password.changed", `other sessions revoked=${n}`);
  return NextResponse.json({ ok: true, note: "password changed; sign in again on other devices" });
}
