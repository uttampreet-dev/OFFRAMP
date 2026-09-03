"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { InterceptView } from "@/lib/intercept";
import { TopBar, AddressInput, Seg, Primary, Chip, StatusBar } from "@/components/console";

const short = (a: string) => (a.length > 18 ? `${a.slice(0, 7)}…${a.slice(-5)}` : a);
const inr = (v: number) => "₹" + Math.round(v).toLocaleString("en-IN");
const hhmmss = (s: number) => {
  const c = Math.max(0, Math.floor(s));
  return `${String(Math.floor(c / 3600)).padStart(2, "0")}:${String(Math.floor((c % 3600) / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
};
const ist = (ts: number) => new Date(ts + 5.5 * 3600_000).toISOString().slice(11, 19) + " IST";

function Countdown({ closesAt, anchorNow }: { closesAt: number; anchorNow: number }) {
  const [t0] = useState(Date.now());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick;
  const now = anchorNow + (Date.now() - t0);
  const rem = (closesAt - now) / 1000;
  return <span className={rem <= 0 ? "text-faint" : rem < 900 ? "text-red" : "text-amber"}>{rem <= 0 ? "closed" : hhmmss(rem)}</span>;
}

function Inner() {
  const params = useSearchParams();
  const caseParam = params.get("case") ?? "";
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [symbol, setSymbol] = useState("USDT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<InterceptView | null>(null);
  const [seal, setSeal] = useState<{ id: string; sha256: string; sealedAt: string; by: string } | null>(null);
  const [sealing, setSealing] = useState(false);

  const run = useCallback(
    async (m = mode, a = address, amt = amount, sym = symbol) => {
      setLoading(true);
      setError(null);
      setSeal(null);
      setApproved(null);
      try {
        const r = await fetch("/api/intercept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(m === "demo" ? { demo: true } : { address: a.trim(), amount: Number(amt) || 0, symbol: sym, caseId: caseParam || undefined }),
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "intercept failed");
        setV(body as InterceptView);
      } catch (e) {
        setV(null);
        setError(e instanceof Error ? e.message : "intercept failed");
      } finally {
        setLoading(false);
      }
    },
    [mode, address, amount, symbol],
  );

  useEffect(() => {
    const a = params.get("address");
    if (a) {
      const amt = params.get("amount") ?? "";
      const sym = params.get("symbol") ?? "USDT";
      setMode("live");
      setAddress(a);
      setAmount(amt);
      setSymbol(sym);
      run("live", a, amt, sym);
    } else if (params.get("demo") === "1") run("demo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [approved, setApproved] = useState<string | null>(null);
  async function approve() {
    if (!seal) return;
    const r = await fetch("/api/intercept/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: seal.id }) });
    const b = await r.json();
    if (!r.ok) return setError(b.error ?? "sign-off failed");
    setApproved(b.approvedBy);
  }
  async function doSeal() {
    if (!v) return;
    setSealing(true);
    try {
      const r = await fetch("/api/intercept/seal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v.packet) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "seal failed");
      setSeal(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "seal failed");
    } finally {
      setSealing(false);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <TopBar
        title="Intercept"
        subtitle="golden hour · freeze-request packet"
        secondRow={
          <>
            <span className="c-note">the window is measured on the wallet where possible, otherwise a stated policy default · OFFRAMP composes the request; an authorised officer sends it</span>
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
          <Seg label="source" value={mode} options={[["demo", "demonstration case"], ["live", "live wallet"]]} onChange={(x) => setMode(x as "demo" | "live")} />
          {mode === "live" ? (
            <>
              <AddressInput value={address} onChange={setAddress} />
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="amount" inputMode="decimal" className="mono w-[130px] h-[44px] bg-panel border border-line px-3 text-[14px] placeholder:text-faint outline-none focus:border-amber/60" />
              <Seg label="asset" value={symbol} options={[["USDT", "USDT"], ["BTC", "BTC"], ["ETH", "ETH"]]} onChange={setSymbol} />
            </>
          ) : (
            <div className="flex-1 c-note">replay of case 2026-CHD-0417 · clock anchored 12 min 38 s after the cash-out trigger · synthetic, labelled</div>
          )}
          <Primary disabled={loading || (mode === "live" && !address.trim())}>{loading ? "assessing…" : "assess"}</Primary>
        </form>
      </TopBar>

      {!v && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {error && <div className="mx-8 mt-6 border border-[#652225] bg-[#1a0c0e] text-red px-4 py-3 text-[13px] max-w-xl">{error}</div>}
          {!error && !loading && (
            <div className="px-8 py-8 max-w-[1300px] grid lg:grid-cols-[1fr_1fr] gap-10">
              <div>
                <div className="c-label">Act inside the window</div>
                <h2 className="text-[22px] font-bold mt-2 leading-tight">Turn a trace into a request an officer can send in seconds.</h2>
                <p className="c-body mt-3 max-w-md">
                  The moment funds reach a cash-out or a known exchange deposit, Intercept estimates how long the withdrawal window is likely to stay
                  open and composes a complete freeze-request packet — attribution with its source, amounts in both currencies, the transaction, the
                  window — then seals it with SHA-256 and writes the audit entry.
                </p>
                <button onClick={() => run("demo")} className="mt-8 mono text-[11px] tracking-[0.12em] uppercase font-extrabold bg-amber text-[#12100c] px-6 py-3 hover:brightness-110">
                  Replay the demonstration case →
                </button>
              </div>
              <div className="border border-line bg-rail">
                <div className="h-[46px] border-b border-line flex items-center px-5 gap-3"><span className="c-label">What it does not do</span></div>
                <div className="px-5 py-4 space-y-3">
                  {[
                    ["Freeze funds", "only an authorised officer, through the exchange or bank, can do that"],
                    ["Transmit", "the packet is composed and sealed here; sending is a human act"],
                    ["Guarantee the window", "the estimate is measured from the wallet's own history where possible, otherwise a stated 2-hour policy default"],
                    ["Guess an owner", "attribution appears only where a public source is cited"],
                  ].map(([t, d]) => (
                    <div key={t} className="grid grid-cols-[150px_1fr] gap-3 items-baseline">
                      <span className="text-[13px] font-semibold">{t}</span>
                      <span className="c-note">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {loading && <div className="px-8 pt-6 mono text-[12px] text-faint">assessing the window and composing the packet…</div>}
        </div>
      )}

      {v && (
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-[1fr_1fr]">
          {/* window */}
          <div className="border-r border-line">
            <div className="px-7 py-6 border-b border-line">
              <div className="flex items-center gap-3">
                <span className="c-label">Estimated window before withdrawal</span>
                <Chip tone={v.replay.enabled ? "mut" : "green"}>{v.replay.enabled ? "replay · clock anchored at trigger + 12:38" : "live"}</Chip>
              </div>
              <div className="mono text-[72px] font-extrabold leading-none mt-4 tabular-nums">
                <Countdown closesAt={v.closesAt} anchorNow={v.replay.nowTs} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 max-w-lg">
                <div><div className="c-kv">Basis</div><div className="mono text-[13px] mt-0.5">{v.window.basis}</div></div>
                <div><div className="c-kv">Window</div><div className="mono text-[13px] mt-0.5">{hhmmss(v.window.seconds)}</div></div>
                <div><div className="c-kv">Observed inflow → outflow pairs</div><div className="mono text-[13px] mt-0.5">{v.window.pairs}{v.window.medianLagS !== null ? ` · median lag ${hhmmss(v.window.medianLagS)}` : ""}</div></div>
                <div><div className="c-kv">Closes at</div><div className="mono text-[13px] mt-0.5">{ist(v.closesAt)}</div></div>
              </div>
              <p className="c-note mt-4 max-w-lg leading-relaxed">
                {v.window.basis === "policy default"
                  ? "Fewer than three inflow→outflow pairs were available on this wallet, so the window is the stated 2-hour policy default — a planning figure, not a measurement."
                  : `The window is the median time this wallet historically took to move funds on after receiving them, across ${v.window.pairs} observed pairs. It is an estimate, not a guarantee.`}
              </p>
            </div>
            <div className="px-7 py-5">
              <div className="c-label mb-3">Trigger chain</div>
              <div className="space-y-2.5">
                <div className="flex gap-4 mono text-[13px]"><span className="text-faint w-[112px] shrink-0 whitespace-nowrap">{ist(v.trigger.ts)}</span><span className="text-amber">▸ {v.trigger.label}</span></div>
                <div className="flex gap-4 mono text-[13px]"><span className="text-faint w-[112px] shrink-0 whitespace-nowrap">{ist(v.trigger.ts)}</span><span className="text-ink/85">{v.amount.toLocaleString("en-IN")} {v.symbol} ≈ {inr(v.inrEstimate)} at ₹{v.fx.rate}/{v.symbol}{v.fx.fallback ? " (fallback rate)" : ""}</span></div>
                <div className="flex gap-4 mono text-[13px]"><span className="text-faint w-[112px] shrink-0 whitespace-nowrap">{ist(v.replay.nowTs)}</span><span className="text-ink/85">freeze packet composed{seal ? " · sealed" : " · unsealed"}</span></div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {v.sanctioned && <Chip tone="red">OFAC SDN</Chip>}
                {v.attribution ? <Chip tone="teal">{v.attribution.entity} · {v.attribution.type} · public attribution</Chip> : <Chip tone="mut">unattributed deposit wallet</Chip>}
              </div>
            </div>
            <div className="px-7 py-5 border-t border-line">
              <div className="c-label mb-3">How the window is derived</div>
              {[
                ["1 · measure", "every inflow to this wallet is paired with the next outflow; the lag between them is recorded", v.window.pairs > 0 ? `${v.window.pairs} pairs found` : "no pairs found"],
                ["2 · estimate", "with three or more pairs the median lag is the window, capped at 48 h", v.window.basis === "policy default" ? "not met" : `median ${hhmmss(v.window.medianLagS ?? 0)}`],
                ["3 · fall back", "with fewer than three pairs a stated 2-hour policy default is used and labelled as such", v.window.basis === "policy default" ? "applied" : "not needed"],
                ["4 · close", "the window closes at trigger time + window; the clock runs from the moment funds reached the wallet", ist(v.closesAt)],
              ].map(([k, d, r]) => (
                <div key={k} className="grid grid-cols-[110px_1fr_150px] gap-4 py-2.5 border-b border-line2 last:border-0 items-baseline">
                  <span className="mono text-[11px] tracking-[0.1em] uppercase text-faint">{k}</span>
                  <span className="c-note leading-relaxed">{d}</span>
                  <span className="mono text-[12px] text-ink/85 text-right">{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* packet */}
          <div className="bg-rail">
            <div className="px-7 py-5 border-b border-line flex items-center gap-3">
              <span className="c-label">Freeze request packet</span>
              {seal ? <Chip tone="green">sealed · sha256 {seal.sha256.slice(0, 12)}…</Chip> : <Chip tone="amber">unsealed preview</Chip>}
            </div>
            <div className="px-7 py-4">
              {[
                ["Case", v.packet.caseId],
                ["Requesting officer", v.packet.requestingOfficer],
                ["Subject wallet", v.packet.subject.address],
                ["Chain", v.packet.subject.chain.toUpperCase()],
                ["Attribution", v.packet.subject.attribution],
                ["Transaction", v.packet.transaction.txid ? short(v.packet.transaction.txid) : "—"],
                ["Amount", `${v.packet.transaction.amount.toLocaleString("en-IN")} ${v.packet.transaction.symbol} · ≈ ${inr(v.packet.transaction.inrEstimate)}`],
                ["Trigger", v.packet.transaction.triggerAt.replace("T", " ").slice(0, 19) + " UTC"],
                ["Window", `${hhmmss(v.packet.window.seconds)} · ${v.packet.window.basis}`],
                ["Requested action", v.packet.requestedAction],
              ].map(([k, val]) => (
                <div key={k} className="grid grid-cols-[170px_1fr] gap-4 py-2.5 border-b border-line2">
                  <span className="c-kv pt-0.5">{k}</span>
                  <span className={`text-[13px] leading-snug ${k === "Subject wallet" || k === "Transaction" ? "mono break-all" : ""}`}>{val}</span>
                </div>
              ))}
              {v.packet.subject.attributionSource && (
                <a href={v.packet.subject.attributionSource} target="_blank" rel="noreferrer" className="mono text-[11px] text-teal underline underline-offset-2 mt-3 inline-block">attribution source ↗</a>
              )}
              <div className="mt-5 flex items-center gap-3">
                <button onClick={doSeal} disabled={!!seal || sealing} className="mono text-[11px] tracking-[0.12em] uppercase font-extrabold bg-red text-[#12080a] px-5 py-3 hover:brightness-110 disabled:opacity-40">
                  {seal ? "sealed" : sealing ? "sealing…" : "seal packet · sha-256"}
                </button>
                {seal && <span className="mono text-[11px] text-mut">{seal.id} · by {seal.by} · {seal.sealedAt.replace("T", " ").slice(0, 19)} UTC</span>}
                {seal && !approved && (
                  <button onClick={approve} className="mono text-[10px] tracking-[0.1em] uppercase font-bold text-mut border border-line px-2.5 py-2 hover:text-ink">supervisor sign-off</button>
                )}
                {approved && <Chip tone="green">signed off · {approved}</Chip>}
              </div>
              {seal && (
                <Link href={`/evidence?case=${v.caseId}${v.replay.enabled ? "&demo=1" : `&address=${v.address}`}`} className="mt-3 inline-block mono text-[11px] tracking-[0.1em] uppercase font-bold text-amber border border-amber/50 px-3 py-2 hover:bg-amber hover:text-[#12100c] transition-colors">
                  Add to the evidence pack →
                </Link>
              )}
            </div>
            <div className="px-7 py-5 border-t border-line">
              <div className="flex items-center gap-3 mb-3"><span className="c-label">Delivery</span><Chip tone="mut">workflow status · no external delivery in this build</Chip></div>
              {[
                ["Authorised officer", seal ? "packet available for sign-off" : "awaiting sealed packet", seal ? "amber" : "mut"],
                ["Exchange compliance desk", v.attribution?.type === "exchange" ? "addressee identified from public attribution" : "no attributed exchange — records preservation only", v.attribution?.type === "exchange" ? "teal" : "mut"],
                ["CFCFRMS reference", "to be linked by the officer", "mut"],
              ].map(([k, s, tone]) => (
                <div key={k} className="flex items-center justify-between py-2.5 border-b border-line2 last:border-0">
                  <span className="text-[13px]">{k}</span>
                  <Chip tone={tone as "amber" | "teal" | "mut"}>{s}</Chip>
                </div>
              ))}
              <p className="c-note mt-4 leading-relaxed">{v.packet.notes.join(" ")}</p>
            </div>
          </div>
        </div>
      )}

      <StatusBar left="OFFRAMP does not freeze funds and does not transmit packets — it prepares the request an authorised officer sends" right={v ? (v.replay.enabled ? "replay · synthetic case" : "live public chain data") : "window: measured where possible, else policy default"} />
    </div>
  );
}

export default function InterceptPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
