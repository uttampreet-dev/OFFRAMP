import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { accessAudit, audit, createUser, listUsers, setPassword, setUserDisabled, setUserRole } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function supervisor() {
  const s = await getSession();
  if (!s) return { err: NextResponse.json({ error: "unauthorised" }, { status: 401 }) };
  if (s.role !== "supervisor") return { err: NextResponse.json({ error: "supervisor role required" }, { status: 403 }) };
  return { s };
}
export async function GET() {
  const g = await supervisor();
  if (g.err) return g.err;
  return NextResponse.json({ users: listUsers(), recent: accessAudit(40) });
}
export async function POST(req: NextRequest) {
  const g = await supervisor();
  if (g.err) return g.err;
  const { username, role, password } = (await req.json().catch(() => ({}))) as { username?: string; role?: string; password?: string };
  try {
    const created = createUser(username ?? "", role ?? "", password ?? "", g.s!.u);
    if (!created) return NextResponse.json({ error: "username already exists" }, { status: 409 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "rejected" }, { status: 400 });
  }
  audit(g.s!.u, "user.created", `user=${username!.trim().toLowerCase()} role=${role}`);
  return NextResponse.json({ ok: true });
}
export async function PATCH(req: NextRequest) {
  const g = await supervisor();
  if (g.err) return g.err;
  const { username, action, role, password } = (await req.json().catch(() => ({}))) as { username?: string; action?: string; role?: string; password?: string };
  const u = (username ?? "").trim().toLowerCase();
  if (!u || !action) return NextResponse.json({ error: "username and action are required" }, { status: 400 });
  if (u === g.s!.u && (action === "disable" || action === "role")) return NextResponse.json({ error: "you cannot disable or demote your own account" }, { status: 400 });
  try {
    if (action === "disable") setUserDisabled(u, true);
    else if (action === "enable") setUserDisabled(u, false);
    else if (action === "role") setUserRole(u, role ?? "");
    else if (action === "reset") setPassword(u, password ?? "");
    else return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "rejected" }, { status: 400 });
  }
  audit(g.s!.u, `user.${action}`, `user=${u}${role ? ` role=${role}` : ""}`);
  return NextResponse.json({ ok: true });
}
