"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { BridgeResult, Linkage } from "@/lib/bridge/correlate";
import { TopBar, AddressInput, Seg, Primary, Chip, StatusBar } from "@/components/console";

const short = (a: string) => (a.length > 18 ? `${a.slice(0, 7)}…${a.slice(-5)}` : a);
const inr = (v: number) => "₹" + Math.round(v).toLocaleString("en-IN");
const fmtV = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: v < 1 ? 5 : 2 });
const hms = (ts: number) => new Date(ts + 5.5 * 3600_000).toISOString().slice(11, 19);
const dmy = (ts: number) => new Date(ts + 5.5 * 3600_000).toISOString().slice(0, 10);
const mins = (ms: number) => (ms < 3600_000 ? `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s` : `${(ms / 3600_000).toFixed(1)} h`);

function Inner() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [address, setAddress] = useState("");
  const [csv, setCsv] = useState<string | null>(null);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [tol, setTol] = useState(5);
  const [win, setWin] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<BridgeResult | null>(null);
  const [sel, setSel] = useState<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = useCallback(
    async (m = mode, a = address, t = tol, w = win, c = csv) => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("/api/bridge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: m, address: a.trim() || undefined, statementCsv: c ?? undefined, tolerancePct: t, windowHours: w }),
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "bridge failed");
        setRes(body as BridgeResult);
        setSel(0);
      } catch (e) {
        setRes(null);
        setError(e instanceof Error ? e.message : "bridge failed");
      } finally {
        setLoading(false);
      }
    },
    [mode, address, tol, win, csv],
  );

  useEffect(() => {
    const a = params.get("address");
    if (a) {
      setMode("live");
      setAddress(a);
      run("live", a);
    } else if (params.get("demo") === "1") run("demo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    setCsv(text);
    setCsvName(f.name);
  };

  const link: Linkage | null = res?.linkages[sel] ?? res?.best ?? null;
  const matchedEvent = link?.event.txid;
  const matchedCredit = link?.credit;

  return (
    <div className="flex flex-col h-screen">
      <TopBar
        title="The Bridge"
        subtitle="on-chain → INR · amount × FX × time window"
        secondRow={
          <>
            <Seg label="statement" value={csv ? "upload" : "sample"} options={[["sample", "sample · synthetic"], ["upload", csvName ? csvName.slice(0, 22) : "upload CSV"]]} onChange={(v) => (v === "upload" ? fileRef.current?.click() : (setCsv(null), setCsvName(null)))} />
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Seg label="tolerance" value={String(tol)} options={[["2", "2%"], ["5", "5%"], ["10", "10%"]]} onChange={(v) => setTol(Number(v))} />
            <Seg label="window" value={String(win)} options={[["2", "2 h"], ["6", "6 h"], ["24", "24 h"]]} onChange={(v) => setWin(Number(v))} />
            <span className="ml-auto c-note">a match is a candidate linkage, not proof the funds are the same</span>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="flex-1 flex items-center gap-3 min-w-0"
        >
          <Seg label="source" value={mode} options={[["demo", "demonstration case"], ["live", "live wallet"]]} onChange={(v) => setMode(v as "demo" | "live")} />
          {mode === "live" ? <AddressInput value={address} onChange={setAddress} /> : <div className="flex-1 c-note">synthetic on-chain events for case 2026-CHD-0417, labelled — the seam story end to end</div>}
          <Primary disabled={loading || (mode === "live" && !address.trim())}>{loading ? "correlating…" : "correlate"}</Primary>
        </form>
      </TopBar>

      {!res && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {error && <div className="mx-8 mt-6 border border-[#652225] bg-[#1a0c0e] text-red px-4 py-3 text-[13px] max-w-xl">{error}</div>}
          {loading && <div className="px-8 pt-6 mono text-[12px] text-faint">correlating outflows against statement credits…</div>}
          {!error && !loading && (
            <div className="px-8 py-8 max-w-[1300px] grid lg:grid-cols-[1fr_1fr] gap-10">
              <div>
                <div className="c-label">Cross the seam</div>
                <h2 className="text-[22px] font-bold mt-2 leading-tight">Where crypto stops and rupees start.</h2>
                <p className="c-body mt-3 max-w-md">
                  Every on-chain outflow is compared with every credit that lands in the bank statement afterwards. Two things must agree: the
                  amount, through that day&apos;s exchange rate, and the time. The result is a candidate linkage with its working shown — not a
                  claim that the funds are the same.
                </p>
                <button onClick={() => run("demo")} className="mt-8 mono text-[11px] tracking-[0.12em] uppercase font-extrabold bg-amber text-[#12100c] px-6 py-3 hover:brightness-110">
                  Run the demonstration case →
                </button>
                <p className="c-note mt-3 max-w-md">Both sides of the demonstration are synthetic and labelled. For a real wallet, switch the source to live and upload a statement in the project CSV schema.</p>
              </div>
              <div className="border border-line bg-rail">
                <div className="h-[46px] border-b border-line flex items-center px-5 gap-3">
                  <span className="c-label">How a match is scored</span>
                </div>
                <div className="px-5 py-4 space-y-4">
                  {[
                    ["Amount", "credit vs value × that day's INR rate · agreement within the tolerance you set"],
                    ["Time", "the credit must land after the outflow, inside the window · sooner scores higher"],
                    ["Strength", "geometric mean of the two — a perfect amount with a late credit still scores honestly lower"],
                    ["Flow-aware", "the same funds passing through several wallets count once, at the cash-out"],
                    ["Ambiguity", "flagged when an unrelated outflow competes for the same credit"],
                  ].map(([t, d]) => (
                    <div key={t} className="grid grid-cols-[110px_1fr] gap-3 items-baseline">
                      <span className="text-[13px] font-semibold">{t}</span>
                      <span className="c-note">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {res && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* the seam */}
          <div className="grid grid-cols-[1fr_200px_1fr] border-b border-line">
            <div className="px-7 py-5 bg-panel">
              <div className="flex items-center gap-3 mb-3">
                <span className="c-label">On-chain · outflows</span>
                <Chip tone={res.chainSynthetic ? "mut" : "green"}>{res.chainSynthetic ? "synthetic · demonstration" : "live public chain data"}</Chip>
              </div>
              {res.events.map((ev) => {
                const hit = ev.txid === matchedEvent;
                const up = !!matchedCredit && res.linkages.some((l) => l.upstreamOfBest && l.event.txid === ev.txid && l.credit.ts === matchedCredit.ts && l.credit.credit === matchedCredit.credit);
                return (
                  <div key={ev.txid} className={`mono flex items-center gap-4 text-[13px] border-b border-line2 py-3 ${hit ? "bg-[#17130a] -mx-3 px-3 shadow-[inset_3px_0_0_#e8b23a]" : ""}`}>
                    <span className="text-faint w-[64px] shrink-0">{hms(ev.ts)}</span>
                    <span className="truncate flex-1 text-ink/90">{short(ev.from)} → {short(ev.to)}<span className="text-faint"> · {ev.note}</span>{up && <span className="text-teal"> · upstream of match</span>}</span>
                    <span className={`font-bold shrink-0 ${hit ? "text-amber2" : ""}`}>{fmtV(ev.value)} {ev.symbol}</span>
                  </div>
                );
              })}
            </div>
            <div className="relative flex items-center justify-center bg-panel">
              <div className="absolute top-0 bottom-0 left-1/2 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-amber to-transparent seam-line" />
              {link ? (
                <div className="relative z-10 border border-[#8a6f26] bg-[#0e0c08] px-4 py-3 text-center w-[168px]">
                  <div className="mono text-[9px] tracking-[0.18em] font-extrabold text-amber">CANDIDATE LINKAGE</div>
                  <div className="mono text-[30px] font-bold text-amber2 leading-tight mt-1">{Math.round(link.strength * 1000) / 10}%</div>
                  <div className="mono text-[9.5px] text-[#8c7a50] mt-1.5 leading-relaxed">
                    Δ {inr(Math.abs(link.deltaInr))} · {(link.deltaPct * 100).toFixed(2)}%<br />Δt {mins(link.deltaMs)}<br />FX ₹{link.fx.rate}/{link.event.symbol}
                  </div>
                  {link.ambiguous && <div className="mono text-[9px] text-red mt-2">ambiguous</div>}
                </div>
              ) : (
                <div className="relative z-10 border border-line bg-panel2 px-4 py-3 text-center w-[168px]">
                  <div className="mono text-[9px] tracking-[0.18em] font-extrabold text-faint">NO LINKAGE</div>
                  <div className="c-note mt-1">no credit inside tolerance and window</div>
                </div>
              )}
            </div>
            <div className="px-7 py-5 cash-paper">
              <div className="flex items-center gap-3 mb-3">
                <span className="c-label text-cashmut">Bank statement · credits</span>
                <Chip tone="mut">{res.statementSynthetic ? "synthetic — labelled" : "uploaded"}</Chip>
                <span className="ml-auto mono text-[11px] text-cashmut">A/C {res.account}</span>
              </div>
              {res.credits.map((cr, i) => {
                const hit = cr === matchedCredit || (matchedCredit && cr.ts === matchedCredit.ts && cr.credit === matchedCredit.credit);
                return (
                  <div key={i} className={`mono flex items-center gap-4 text-[13px] border-b border-[#2b2318] py-3 ${hit ? "bg-[#2a1f0a] -mx-3 px-3 text-[#fbe9bc] shadow-[inset_3px_0_0_#e8b23a]" : "text-cashink"}`}>
                    <span className={`w-[64px] shrink-0 ${hit ? "" : "text-[#8a7659]"}`}>{cr.time}</span>
                    <span className="truncate flex-1" style={{ fontFamily: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif', fontSize: "14px" }}>{cr.narration}</span>
                    <span className="font-bold shrink-0">{inr(cr.credit)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* linkages + resolved entity */}
          <div className="grid grid-cols-[1fr_440px]">
            <div className="px-7 py-5 border-r border-line">
              <div className="c-label mb-3">Candidate linkages · {res.linkages.length}</div>
              {res.linkages.length === 0 && <p className="c-note">No outflow matched a credit within {res.tolerancePct}% and {res.windowHours} h. Widen the tolerance or the window, or check the statement schema.</p>}
              {res.linkages.map((l, i) => (
                <button key={i} onClick={() => setSel(i)} className={`w-full text-left grid grid-cols-[70px_1fr_130px_120px_110px] items-center gap-3 mono text-[12.5px] py-3 border-b border-line2 ${i === sel ? "bg-panel shadow-[inset_3px_0_0_#e8b23a] -mx-3 px-3" : "hover:bg-panel/60"}`}>
                  <span className="text-faint">{hms(l.event.ts)}</span>
                  <span className="truncate">{fmtV(l.event.value)} {l.event.symbol} → {inr(l.credit.credit)} <span className="text-faint">· {l.credit.narration}</span></span>
                  <span className="text-mut">Δ {(l.deltaPct * 100).toFixed(2)}%</span>
                  <span className="text-mut">Δt {mins(l.deltaMs)}</span>
                  <span className="text-right">
                    <span className={`font-bold ${i === 0 ? "text-amber2" : ""}`}>{Math.round(l.strength * 1000) / 10}%</span>
                    {l.upstreamOfBest && <span className="block text-[9px] text-teal">upstream</span>}
                    {l.ambiguous && <span className="block text-[9px] text-red">ambiguous</span>}
                  </span>
                </button>
              ))}
              <div className="c-note mt-4 leading-relaxed">
                Tolerance {res.tolerancePct}% · window {res.windowHours} h · FX {link ? `${link.fx.source}${link.fx.fallback ? " (fallback)" : ""}` : "—"}. Events that carried the same funds upstream of the best match are shown once, at the cash-out.
              </div>
            </div>
            <aside className="px-6 py-5 bg-rail">
              <div className="c-label mb-3">Resolved entity — candidate</div>
              {res.candidateEntity ? (
                <>
                  <div className="mono text-[14px] text-ink/95 break-all">{res.candidateEntity.wallet}</div>
                  <div className="mono text-[13px] text-faint my-1.5">=</div>
                  <div className="mono text-[14px] text-ink/95">A/C {res.candidateEntity.account}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <Chip tone="amber">strength {Math.round(res.candidateEntity.strength * 1000) / 10}%</Chip>
                    <Chip tone="mut">Layer-1 mule pattern</Chip>
                  </div>
                  <p className="c-note mt-4 leading-relaxed">
                    The wallet and the account are linked by amount and timing only. This is an investigative lead in the format the I4C Suspect Registry uses for mule accounts — it is not evidence of ownership.
                  </p>
                  <div className="mt-5 flex flex-col gap-2">
                    <Link href={`/intercept?address=${res.candidateEntity.wallet}&amount=${link?.event.value ?? ""}&symbol=${link?.event.symbol ?? ""}`} className="mono text-[11px] tracking-[0.1em] uppercase font-bold text-amber border border-amber/50 px-3 py-2 hover:bg-amber hover:text-[#12100c] transition-colors">
                      Compose freeze packet in Intercept →
                    </Link>
                    <Link href={`/trace?address=${res.candidateEntity.wallet}`} className="mono text-[11px] tracking-[0.1em] uppercase font-bold text-mut border border-line px-3 py-2 hover:text-ink hover:border-[#2c3a4c] transition-colors">
                      Trace this wallet →
                    </Link>
                  </div>
                </>
              ) : (
                <p className="c-note">No candidate. Nothing to resolve.</p>
              )}
            </aside>
          </div>
        </div>
      )}

      <StatusBar
        left={res ? `${res.chainSynthetic ? "on-chain: synthetic demonstration events" : "on-chain: live public chain data"} · statement: ${res.statementSynthetic ? "synthetic, labelled" : "uploaded"}` : "statement rows are treated as synthetic unless stated · correlation is a candidate linkage"}
        right="not proof of ownership"
      />
    </div>
  );
}

export default function BridgePage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
