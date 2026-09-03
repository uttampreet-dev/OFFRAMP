"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { BoardSnapshot, BoardWindow } from "@/lib/board";
import { TopBar, AddressInput, Primary, Chip, StatusBar } from "@/components/console";

const POLL_S = 60;
const short = (a: string) => (a.length > 18 ? `${a.slice(0, 7)}…${a.slice(-5)}` : a);
const ist = (ts: number) => new Date(ts + 5.5 * 3600_000).toISOString().slice(11, 19) + " IST";
const hhmmss = (s: number) => {
  const c = Math.max(0, Math.floor(s));
  return `${String(Math.floor(c / 3600)).padStart(2, "0")}:${String(Math.floor((c % 3600) / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
};
const ago = (ts: number | null) => {
  if (!ts) return "—";
  const d = (Date.now() - ts) / 1000;
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  return `${Math.floor(d / 86400)} d ago`;
};
const fmtV = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: v < 1 ? 5 : 2 });
const statusTone = (s: string): "amber" | "red" | "teal" | "mut" | "green" => (s === "cash-out" ? "red" : s === "escalated" ? "amber" : s === "tracing" ? "teal" : s === "closed" ? "green" : "mut");

function Window({ w }: { w: BoardWindow }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (w.replayNow) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [w.replayNow]);
  const rem = (w.closesAt - (w.replayNow ?? Date.now())) / 1000;
  return (
    <div className="py-3 border-b border-line2">
      <div className="flex items-center justify-between">
        <span className="mono text-[12px] font-bold">{w.caseId}</span>
        <span className={`mono text-[18px] font-extrabold tabular-nums ${rem <= 0 ? "text-faint" : rem < 900 ? "text-red" : "text-amber"}`}>{rem <= 0 ? "closed" : hhmmss(rem)}</span>
      </div>
      <div className="mono text-[10.5px] text-faint mt-0.5">{short(w.address)} · {w.amount.toLocaleString("en-IN")} {w.symbol} · {w.packetId}</div>
      {w.replayNow && <div className="mt-1"><Chip tone="mut">replay · clock anchored at trigger + 12:38</Chip></div>}
    </div>
  );
}

function Inner() {
  const params = useSearchParams();
  const [snap, setSnap] = useState<BoardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [left, setLeft] = useState(POLL_S);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/board", { cache: "no-store" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "board failed");
      setSnap(b as BoardSnapshot);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "board failed");
    } finally {
      setLoading(false);
      setLeft(POLL_S);
    }
  }, []);

  async function watch(a: string, l: string) {
    const r = await fetch("/api/watch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: a, label: l }) });
    const b = await r.json();
    if (!r.ok) return setMsg(b.error ?? "could not watch");
    setMsg(b.added ? `watching ${short(a)} on ${String(b.chain).toUpperCase()}` : `${short(a)} was already watched`);
    setAddr("");
    setLabel("");
    poll();
  }
  async function ack(key: string) {
    await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    poll();
  }
  async function unwatch(a: string) {
    await fetch(`/api/watch?address=${encodeURIComponent(a)}`, { method: "DELETE" });
    poll();
  }

  useEffect(() => {
    const w = params.get("watch");
    if (w) watch(w, "from Trace");
    else poll();
    timer.current = setInterval(() => setLeft((x) => (x <= 1 ? POLL_S : x - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (left === POLL_S && snap) poll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const st = snap?.stats;
  return (
    <div className="flex flex-col h-screen">
      <TopBar
        title="Live Board"
        subtitle="triage · watched addresses against live chain state"
        secondRow={
          <div className="flex items-center gap-5 mono text-[11px] text-mut">
            {st ? (
              <>
                <span><b className="text-ink">{st.watched}</b> watched</span>
                <span><b className="text-ink">{st.openCases}</b> open cases</span>
                <span><b className="text-ink">{st.packets}</b> packets sealed</span>
                <span>OFAC SDN <b className="text-ink">{st.ofac.total.toLocaleString()}</b>{st.ofac.syncedAt ? ` · synced ${st.ofac.syncedAt.slice(0, 10)}` : ""}</span>
                {st.reported !== null && <span>community reports <b className="text-ink">{st.reported.toLocaleString()}</b></span>}
                <span className="text-faint">polled {ist(snap!.polledAt)} · next in {left}s</span>
              </>
            ) : (
              <span className="text-faint">{error ?? "polling…"}</span>
            )}
            <button onClick={poll} disabled={loading} className="ml-auto mono text-[10.5px] tracking-[0.12em] uppercase font-bold text-amber border border-amber/50 px-2.5 py-1 hover:bg-amber hover:text-[#12100c] disabled:opacity-40">
              {loading ? "polling…" : "poll now"}
            </button>
          </div>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (addr.trim()) watch(addr, label);
          }}
          className="flex-1 flex items-center gap-3 min-w-0"
        >
          <AddressInput value={addr} onChange={setAddr} placeholder="Watch a BTC, ETH or TRON address" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="label (optional)" className="mono w-[220px] h-[44px] bg-panel border border-line px-3 text-[13px] placeholder:text-faint outline-none focus:border-amber/60" />
          <Primary disabled={!addr.trim()}>watch</Primary>
          {msg && <span className="c-note truncate">{msg}</span>}
        </form>
      </TopBar>

      {snap && snap.alerts.length > 0 && (
        <div className="border-b border-line bg-[#120c0e] px-6 py-2 flex items-center gap-3 overflow-x-auto">
          <span className="mono text-[10px] tracking-[0.14em] uppercase font-bold text-red shrink-0">alerts · {snap.alerts.length}</span>
          {snap.alerts.map((a) => (
            <div key={a.key} className={`shrink-0 flex items-center gap-2 border px-2.5 py-1.5 ${a.level === "red" ? "border-[#652225]" : "border-[#4a3a12]"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${a.level === "red" ? "bg-red" : "bg-amber"}`} />
              <span className="mono text-[11px] text-ink/90">{a.title}</span>
              <span className="mono text-[10px] text-faint">{a.detail}</span>
              {a.address && <Link href={`/trace?address=${a.address}`} className="mono text-[10px] text-amber underline underline-offset-2">trace</Link>}
              <button onClick={() => ack(a.key)} className="mono text-[10px] text-faint hover:text-ink">ack</button>
            </div>
          ))}
        </div>
      )}
      {snap && (
        <div className="flex-1 min-h-0 grid grid-cols-[1.35fr_1fr_400px] overflow-hidden">
          {/* watched */}
          <div className="overflow-y-auto">
            <div className="px-6 py-4 border-b border-line flex items-center gap-3">
              <span className="c-label">Watched addresses</span>
              <span className="c-note">re-evaluated every {POLL_S} s from the chain cache · balances and counts are public chain data</span>
            </div>
            <div className="px-6">
              <div className="grid grid-cols-[1fr_78px_120px_70px_92px] gap-3 py-2 border-b border-line c-kv">
                <span>address · label</span><span>chain</span><span className="text-right">balance</span><span className="text-right">tx</span><span className="text-right">last activity</span>
              </div>
              {snap.watched.map((a) => (
                <div key={a.address} className="grid grid-cols-[1fr_78px_120px_70px_92px] gap-3 py-3 border-b border-line2 items-center group">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/trace?address=${a.address}`} className="mono text-[13px] hover:text-amber">{short(a.address)}</Link>
                      {a.sanctioned && <Chip tone="red">OFAC SDN</Chip>}
                      {a.entity && <Chip tone="teal">{a.entity.entity}</Chip>}
                      {a.reported && <Chip tone="amber">community report · {a.reported.category}</Chip>}
                      {a.newTransfers.length > 0 && <Chip tone="amber">new activity ×{a.newTransfers.length}</Chip>}
                      {a.stale && <Chip tone="mut">last known · lookup timed out</Chip>}
                      {a.cases.map((c) => (
                        <Link key={c} href={`/cases?id=${c}`} className="mono text-[10px] text-amber underline underline-offset-2">{c}</Link>
                      ))}
                      <button onClick={() => unwatch(a.address)} className="mono text-[10px] text-faint opacity-0 group-hover:opacity-100 hover:text-red">remove</button>
                    </div>
                    <div className="c-note truncate mt-0.5">{a.error ? <span className="text-red">{a.error}</span> : a.label}</div>
                  </div>
                  <span className="mono text-[11px] uppercase text-mut">{a.chain}</span>
                  <span className={`mono text-[12.5px] text-right ${a.stale ? "text-faint" : ""}`}>{a.balance !== null ? `${fmtV(a.balance)} ${a.symbol}` : a.txCount !== null ? "n/a" : "—"}</span>
                  <span className="mono text-[12.5px] text-right">{a.txCount ?? "—"}</span>
                  <span className="mono text-[11px] text-right text-mut">{ago(a.lastSeen)}</span>
                </div>
              ))}
              {snap.watched.length === 0 && <p className="c-note py-6">Nothing watched yet. Add an address above or from Trace.</p>}
            </div>
          </div>

          {/* activity */}
          <div className="border-l border-line overflow-y-auto">
            <div className="px-6 py-4 border-b border-line"><span className="c-label">Activity</span> <span className="c-note ml-2">chain events on watched addresses and audited actions</span></div>
            <div className="px-6">
              {snap.events.map((e, i) => (
                <div key={i} className="grid grid-cols-[10px_1fr] gap-3 py-2.5 border-b border-line2">
                  <span className={`mt-1.5 w-2 h-2 rounded-full ${e.tone === "red" ? "bg-red" : e.tone === "amber" ? "bg-amber" : e.tone === "teal" ? "bg-teal" : "bg-[#4e5f70]"}`} />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3"><span className="mono text-[12px] text-ink/90 truncate">{e.title}</span><span className="mono text-[10.5px] text-faint shrink-0 ml-auto">{ist(e.at)}</span></div>
                    <div className="mono text-[10.5px] text-mut truncate">{e.address ? `${short(e.address)} · ` : ""}{e.detail}</div>
                  </div>
                </div>
              ))}
              {snap.events.length === 0 && <p className="c-note py-6">No activity yet.</p>}
            </div>
          </div>

          {/* windows + cases */}
          <aside className="border-l border-line bg-rail overflow-y-auto">
            <div className="px-6 py-4 border-b border-line"><span className="c-label">Windows</span> <span className="c-note ml-2">from sealed packets</span></div>
            <div className="px-6">
              {snap.windows.map((w) => <Window key={w.packetId} w={w} />)}
              {snap.windows.length === 0 && <p className="c-note py-4">No open windows. Seal a packet in Intercept.</p>}
            </div>
            <div className="px-6 py-4 border-y border-line mt-2 flex items-center justify-between"><span className="c-label">Cases</span><Link href="/cases" className="mono text-[10.5px] text-amber underline underline-offset-2">all cases →</Link></div>
            <div className="px-6">
              {snap.cases.slice(0, 8).map((c) => (
                <Link key={c.id} href={`/cases?id=${c.id}`} className="block py-3 border-b border-line2 hover:bg-panel -mx-2 px-2">
                  <div className="flex items-center gap-2"><span className="mono text-[12px] font-bold">{c.id}</span><Chip tone={statusTone(c.status)}>{c.status}</Chip>{c.synthetic ? <Chip tone="mut">synthetic</Chip> : null}</div>
                  <div className="text-[12.5px] text-ink/85 mt-1 leading-snug">{c.title}</div>
                  <div className="mono text-[10.5px] text-faint mt-0.5">{c.chain.toUpperCase()} · {c.officer} · {ago(c.updated_at)}</div>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      )}
      {!snap && <div className="flex-1 flex items-center justify-center"><span className="mono text-[12px] text-faint">{error ?? "polling watched addresses…"}</span></div>}

      <StatusBar left="chain state is public data read live and cached · a community report is a report, not a finding · every action here is audited" right={snap ? `${snap.watched.filter((a) => a.fromCache).length} of ${snap.watched.length} served from cache` : ""} />
    </div>
  );
}

export default function LiveBoardPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
