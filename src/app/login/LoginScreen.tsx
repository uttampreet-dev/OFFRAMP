"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NetGraph, { type GraphInput, type HoverInfo } from "@/components/landing/NetGraph";
import type { DemoGraph } from "@/lib/demo-graph";

const SEED = "12HQDsicffSBaYdJ6BhnE22sfjTESmmzKx";
const short = (a: string) => `${a.slice(0, 7)}…${a.slice(-5)}`;

export default function LoginScreen({ ofacCount, syncedAt, users, initial = null }: { ofacCount: number; syncedAt: string | null; users: number; initial?: DemoGraph | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ text: string; code: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [graph, setGraph] = useState<GraphInput | null>(initial ? { center: initial.center, sanctioned: initial.sanctioned, transfers: initial.transfers } : null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [clock, setClock] = useState("");

  useEffect(() => {
    if (!initial)
      fetch(`/api/demo-trace?address=${SEED}`)
        .then((r) => r.json())
        .then((b) => setGraph({ center: SEED, sanctioned: true, transfers: b.transfers ?? [] }))
        .catch(() => setGraph(null));
    const tick = () => setClock(new Date().toLocaleTimeString("en-IN", { hour12: false }) + " IST");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const body = await res.json();
      if (!res.ok) throw Object.assign(new Error(body.error ?? "Sign-in failed"), { code: res.status });
      router.push(next ?? "/live-board");
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : "Sign-in failed", code: (err as { code?: number }).code ?? 0 });
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-bg text-ink overflow-hidden grid lg:grid-cols-[1.35fr_minmax(440px,560px)]">
      {/* left · live constellation */}
      <section className="relative min-h-[46vh] lg:min-h-screen overflow-hidden">
        <div className="absolute inset-0 chain-grid opacity-60" />
        <div className="absolute inset-0">
          <NetGraph input={graph} onHover={setHover} />
        </div>
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgba(7,10,15,0.55)_0%,rgba(7,10,15,0.15)_45%,rgba(7,10,15,0.35)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 pointer-events-none bg-[linear-gradient(180deg,transparent,rgba(7,10,15,0.85))]" />

        <div className="absolute top-8 left-8 right-8 flex items-start justify-between pointer-events-none">
          <div>
            <div className="text-[22px] font-extrabold tracking-[0.18em]">OFF<span className="text-amber">RAMP</span></div>
            <div className="hlabel text-[8.5px] mt-1">crypto flow intelligence · investigation console</div>
          </div>
          <div className="text-right">
            <div className="mono text-[11px] text-mut">{clock}</div>
            <div className="mono text-[9px] tracking-[0.14em] uppercase text-faint mt-1">live public chain data</div>
          </div>
        </div>

        <div className="absolute left-8 bottom-8 right-8 pointer-events-none">
          <div className="mono text-[9px] tracking-[0.16em] uppercase text-faint mb-2">
            {hover ? (
              <span className="text-amber">{hover.dir === "center" ? "seed" : hover.dir} · {short(hover.addr)} · {hover.value.toLocaleString("en-IN", { maximumFractionDigits: 4 })} {hover.symbol}</span>
            ) : (
              <span>OFAC-listed BTC seed {short(SEED)} · its counterparties, drawn from the chain now</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-[640px]">
            {[
              ["3", "chains · BTC · ETH · TRON", "amber"],
              [ofacCount.toLocaleString(), `OFAC SDN addresses${syncedAt ? ` · synced ${syncedAt.slice(0, 10)}` : ""}`, "red"],
              [String(users), "provisioned accounts · 3 roles", "teal"],
            ].map(([n, d, tone]) => (
              <div key={d} className="border border-line bg-panel/90 px-4 py-3">
                <div className={`mono text-[22px] font-extrabold leading-none ${tone === "amber" ? "text-amber" : tone === "red" ? "text-red" : "text-teal"}`}>{n}</div>
                <div className="c-note mt-1.5 leading-snug">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* right · sign-in rail */}
      <aside className="relative border-l border-line bg-rail flex flex-col">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[linear-gradient(90deg,#e8b23a,transparent)]" />
        <div className="flex-1 flex flex-col justify-center px-10 xl:px-14 py-12">
          <div className="hlabel text-[8.5px]">Console access</div>
          <h1 className="text-[26px] font-bold leading-tight mt-2">Sign in with the account your unit issued.</h1>
          <p className="c-note mt-2 max-w-md">There is no public sign-up. A supervisor provisions every account, sets its role, and can disable it. Every sign-in, failure and lockout is written to the audit log.</p>

          {next && !error && <div className="mt-5 border border-line bg-panel px-3 py-2 mono text-[11px] text-mut">session required for <span className="text-ink">{next}</span></div>}

          <form onSubmit={submit} className="mt-7 flex flex-col gap-4 max-w-md">
            <label className="block">
              <span className="c-kv">Username</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoCapitalize="none" autoComplete="username" spellCheck={false} className="mono mt-1.5 w-full h-[46px] bg-panel border border-line px-3.5 text-[14px] outline-none focus:border-amber/60 transition-colors" />
            </label>
            <label className="block">
              <span className="c-kv">Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mono mt-1.5 w-full h-[46px] bg-panel border border-line px-3.5 text-[14px] outline-none focus:border-amber/60 transition-colors" />
            </label>
            {error && (
              <div className={`border px-3.5 py-2.5 text-[12.5px] leading-snug ${error.code === 423 ? "border-[#5a4310] bg-[#1a1408] text-amber" : "border-[#652225] bg-[#1a0c0e] text-red"}`}>
                <span className="mono text-[9px] tracking-[0.14em] uppercase font-bold block mb-1 opacity-80">{error.code === 423 ? "account locked" : error.code === 403 ? "account disabled" : "sign-in failed"}</span>
                {error.text}
              </div>
            )}
            <button disabled={busy || !username || !password} className="mono mt-1 h-[48px] bg-amber text-[#12100c] text-[11.5px] tracking-[0.16em] uppercase font-extrabold hover:brightness-110 disabled:opacity-40 transition">
              {busy ? "verifying…" : "sign in"}
            </button>
          </form>

          <div className="mt-9 grid grid-cols-3 gap-3 max-w-md">
            {[
              ["investigator", "cases · trace · packet"],
              ["compliance", "STR draft → filing"],
              ["supervisor", "sign-off · accounts"],
            ].map(([r, d]) => (
              <div key={r} className="border-t border-line pt-2.5">
                <div className="mono text-[10px] tracking-[0.12em] uppercase font-bold text-ink/90">{r}</div>
                <div className="c-note mt-1">{d}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 max-w-md mono text-[10px] leading-relaxed text-faint">
            scrypt-hashed passwords · HMAC-signed session, 12 h, recorded server-side · 5 failed attempts lock the account for 15 min · roles enforced on the server · every write audited
          </div>
        </div>
        <div className="px-10 xl:px-14 py-4 border-t border-line flex items-center justify-between">
          <span className="mono text-[9.5px] tracking-[0.12em] uppercase text-faint">evaluation build</span>
          <a href="/" className="mono text-[9.5px] tracking-[0.12em] uppercase text-mut hover:text-ink">about OFFRAMP →</a>
        </div>
      </aside>
    </div>
  );
}
