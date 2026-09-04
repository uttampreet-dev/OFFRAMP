"use client";
import { useCallback, useEffect, useState } from "react";
import { TopBar, Chip, StatusBar, Seg } from "@/components/console";

interface UserRow { username: string; role: string; disabled: number; failed_count: number; locked_until: number | null; created_by: string | null; created_at: number | null; last_login: number | null; pass_changed_at: number | null }
interface Me { user: string; role: string; exp: number; current: string | null; sessions: { id: string; created_at: number; expires_at: number; ip: string | null; agent: string | null; current: boolean }[] }
const ist = (ts: number | null) => (ts ? new Date(ts + 5.5 * 3600_000).toISOString().replace("T", " ").slice(0, 16) + " IST" : "—");
const roleTone = (r: string): "amber" | "teal" | "mut" => (r === "supervisor" ? "amber" : r === "compliance" ? "teal" : "mut");

export default function AccessPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [recent, setRecent] = useState<{ at: number; username: string; action: string; detail: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [nu, setNu] = useState({ username: "", role: "investigator", password: "" });
  const [pw, setPw] = useState({ current: "", next: "" });
  const [reset, setReset] = useState<{ user: string; password: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/auth/sessions", { cache: "no-store" });
    if (r.ok) {
      const m = (await r.json()) as Me;
      setMe(m);
      if (m.role === "supervisor") {
        const a = await fetch("/api/admin/users", { cache: "no-store" });
        if (a.ok) {
          const b = await a.json();
          setUsers(b.users);
          setRecent(b.recent);
        }
      }
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function call(url: string, method: string, body?: unknown) {
    setMsg(null);
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? (b.note ?? "done") : (b.error ?? "failed"));
    await load();
    return r.ok;
  }

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Access" subtitle="accounts · roles · sessions · access log" secondRow={<span className="c-note">no public sign-up: a supervisor provisions every account · five failed logins lock an account for fifteen minutes · sessions are recorded server-side, so sign-out and revocation are real · every event below is in the audit log</span>}>
        <div className="flex-1 flex items-center gap-3">
          {me && (
            <>
              <Chip tone={roleTone(me.role)}>{me.user} · {me.role}</Chip>
              <span className="c-note">session expires {ist(me.exp)} · {me.sessions.length} active session{me.sessions.length === 1 ? "" : "s"}</span>
            </>
          )}
          {msg && <span className="c-note ml-auto">{msg}</span>}
        </div>
      </TopBar>

      <div className={`flex-1 min-h-0 grid ${me?.role === "supervisor" ? "grid-cols-[1fr_1fr_420px]" : "grid-cols-[1fr_1fr]"} overflow-hidden`}>
        {/* your account */}
        <div className="overflow-y-auto border-r border-line">
          <div className="px-7 py-4 border-b border-line"><span className="c-label">Your account</span></div>
          <div className="px-7 py-4">
            <div className="c-label mb-2">Change password</div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await call("/api/auth/password", "POST", pw)) setPw({ current: "", next: "" });
              }}
              className="flex flex-col gap-2 max-w-sm"
            >
              <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder="current password" autoComplete="current-password" className="mono h-[40px] bg-panel border border-line px-3 text-[13px] placeholder:text-faint outline-none focus:border-amber/60" />
              <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="new password · at least 10 characters" autoComplete="new-password" className="mono h-[40px] bg-panel border border-line px-3 text-[13px] placeholder:text-faint outline-none focus:border-amber/60" />
              <button disabled={!pw.current || pw.next.length < 10} className="mono text-[10.5px] tracking-[0.12em] uppercase font-bold text-amber border border-amber/50 px-3 py-2 hover:bg-amber hover:text-[#12100c] disabled:opacity-40 self-start">change password</button>
            </form>
            <div className="c-note mt-2">changing it ends your other sessions</div>
          </div>
          <div className="px-7 py-4 border-t border-line">
            <div className="flex items-center justify-between mb-2"><span className="c-label">Active sessions</span><button onClick={() => call("/api/auth/sessions", "DELETE").then(() => (window.location.href = "/login"))} className="mono text-[10px] tracking-[0.1em] uppercase font-bold text-red border border-[#652225] px-2.5 py-1.5 hover:bg-red hover:text-[#12080a]">sign out everywhere</button></div>
            {me?.sessions.map((s) => (
              <div key={s.id} className="py-2 border-b border-line2 last:border-0 flex items-center gap-3">
                <span className="mono text-[12px]">{s.id}…</span>
                {s.current && <Chip tone="green">this device</Chip>}
                <span className="mono text-[10.5px] text-faint ml-auto">{ist(s.created_at)} → {ist(s.expires_at)}{s.ip ? ` · ${s.ip}` : ""}</span>
              </div>
            ))}
          </div>
          <div className="px-7 py-4 border-t border-line">
            <div className="c-label mb-2">How access is protected</div>
            {[
              ["Passwords", "scrypt with a per-user salt; never stored or logged in clear"],
              ["Session", "HMAC-signed httpOnly cookie, 12 h, tied to a server-side session record"],
              ["Lockout", "5 failed attempts → 15 minutes; a supervisor reset clears it"],
              ["Roles", "investigator · compliance · supervisor; sign-off and case closing are supervisor-only, enforced on the server"],
              ["Audit", "every login, failure, lockout, password change, user change, seal, export and status change — under the login"],
              ["Transport", "HTTPS at deployment; the cookie is marked secure behind TLS"],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[90px_1fr] gap-3 py-1.5 border-b border-line2 last:border-0"><span className="mono text-[10.5px] tracking-[0.1em] uppercase text-faint pt-0.5">{k}</span><span className="text-[12.5px] text-ink/85">{v}</span></div>
            ))}
          </div>
        </div>

        {/* supervisor: users */}
        {me?.role === "supervisor" ? (
          <div className="overflow-y-auto border-r border-line">
            <div className="px-7 py-4 border-b border-line flex items-center gap-3"><span className="c-label">Accounts · {users?.length ?? 0}</span><Chip tone="amber">supervisor</Chip></div>
            <div className="px-7 py-4 border-b border-line">
              <div className="c-label mb-2">Provision an account</div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await call("/api/admin/users", "POST", nu)) setNu({ username: "", role: "investigator", password: "" });
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <input value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} placeholder="username" autoCapitalize="none" className="mono h-[40px] w-[170px] bg-panel border border-line px-3 text-[13px] placeholder:text-faint outline-none focus:border-amber/60" />
                <Seg label="role" value={nu.role} options={[["investigator", "investigator"], ["compliance", "compliance"], ["supervisor", "supervisor"]]} onChange={(r) => setNu({ ...nu, role: r })} />
                <input type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} placeholder="initial password · 10+" autoComplete="new-password" className="mono h-[40px] w-[200px] bg-panel border border-line px-3 text-[13px] placeholder:text-faint outline-none focus:border-amber/60" />
                <button disabled={nu.username.length < 3 || nu.password.length < 10} className="mono text-[10.5px] tracking-[0.12em] uppercase font-bold bg-amber text-[#12100c] px-4 py-2.5 disabled:opacity-40">create</button>
              </form>
            </div>
            {users?.map((u) => {
              const locked = !!u.locked_until && u.locked_until > Date.now();
              return (
                <div key={u.username} className="px-7 py-3 border-b border-line2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="mono text-[13px] font-bold">{u.username}</span>
                    <Chip tone={roleTone(u.role)}>{u.role}</Chip>
                    {u.disabled ? <Chip tone="red">disabled</Chip> : null}
                    {locked ? <Chip tone="red">locked until {ist(u.locked_until)}</Chip> : null}
                    {u.username === me.user && <Chip tone="green">you</Chip>}
                  </div>
                  <div className="mono text-[10.5px] text-faint mt-1">last login {ist(u.last_login)} · failed {u.failed_count}{u.created_by ? ` · created by ${u.created_by} ${ist(u.created_at)}` : " · seeded"}{u.pass_changed_at ? ` · password changed ${ist(u.pass_changed_at)}` : ""}</div>
                  {u.username !== me.user && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <button onClick={() => call("/api/admin/users", "PATCH", { username: u.username, action: u.disabled ? "enable" : "disable" })} className="mono text-[10px] tracking-[0.1em] uppercase font-bold text-mut border border-line px-2.5 py-1.5 hover:text-ink">{u.disabled ? "enable" : "disable"}</button>
                      <Seg label="role" value={u.role} options={[["investigator", "inv"], ["compliance", "comp"], ["supervisor", "sup"]]} onChange={(r) => call("/api/admin/users", "PATCH", { username: u.username, action: "role", role: r })} />
                      {reset?.user === u.username ? (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (await call("/api/admin/users", "PATCH", { username: u.username, action: "reset", password: reset.password })) setReset(null);
                          }}
                          className="flex items-center gap-2"
                        >
                          <input type="password" autoFocus value={reset.password} onChange={(e) => setReset({ user: u.username, password: e.target.value })} placeholder="new password · 10+" className="mono h-[32px] w-[180px] bg-panel border border-line px-2 text-[12px] placeholder:text-faint outline-none focus:border-amber/60" />
                          <button disabled={reset.password.length < 10} className="mono text-[10px] tracking-[0.1em] uppercase font-bold text-amber border border-amber/50 px-2.5 py-1.5 disabled:opacity-40">set</button>
                          <button type="button" onClick={() => setReset(null)} className="mono text-[10px] text-faint">cancel</button>
                        </form>
                      ) : (
                        <button onClick={() => setReset({ user: u.username, password: "" })} className="mono text-[10px] tracking-[0.1em] uppercase font-bold text-mut border border-line px-2.5 py-1.5 hover:text-ink">reset password · unlock</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-y-auto">
            <div className="px-7 py-4 border-b border-line"><span className="c-label">Roles</span></div>
            <div className="px-7 py-4">
              {[
                ["investigator", "opens cases, traces, runs detectors, bridges statements, composes and seals packets, assembles evidence"],
                ["compliance", "everything an investigator can, plus ownership of the STR draft and filing"],
                ["supervisor", "signs off sealed packets, closes cases, provisions and disables accounts, resets passwords"],
              ].map(([r, d]) => (
                <div key={r} className="flex items-start gap-3 py-2.5 border-b border-line2 last:border-0"><Chip tone={roleTone(r)}>{r}</Chip><span className="text-[12.5px] text-ink/85">{d}</span></div>
              ))}
              <div className="c-note mt-4">Account changes are made by a supervisor on this screen; ask yours if you need a reset.</div>
            </div>
          </div>
        )}

        {/* supervisor: access log */}
        {me?.role === "supervisor" && (
          <aside className="overflow-y-auto bg-rail">
            <div className="px-6 py-4 border-b border-line"><span className="c-label">Access log · last {recent.length}</span></div>
            <div className="px-6">
              {recent.map((r, i) => (
                <div key={i} className="grid grid-cols-[10px_1fr] gap-3 py-2.5 border-b border-line2">
                  <span className={`mt-1.5 w-2 h-2 rounded-full ${r.action.includes("failed") || r.action.includes("locked") || r.action.includes("disabled") ? "bg-red" : r.action.startsWith("user.") || r.action.startsWith("password") ? "bg-amber" : "bg-[#3dd68c]"}`} />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3"><span className="mono text-[12px] text-ink/90">{r.action} · {r.username}</span><span className="mono text-[10.5px] text-faint ml-auto shrink-0">{ist(r.at)}</span></div>
                    <div className="mono text-[10.5px] text-mut truncate">{r.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
      <StatusBar left="accounts are provisioned by a supervisor · no public sign-up by design · passwords hashed with scrypt · sessions recorded server-side" right={me ? `${me.role}` : ""} />
    </div>
  );
}
