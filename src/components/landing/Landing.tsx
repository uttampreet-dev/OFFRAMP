"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AddressSummary, Transfer } from "@/lib/chains/types";
import NetGraph, { type HoverInfo } from "./NetGraph";
import { ModulePreview, type ModuleKey } from "@/components/console/previews";
import type { DemoGraph } from "@/lib/demo-graph";

/* ───────────── reveal on scroll ───────────── */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-rv]"));
    const ob = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("on")),
      { threshold: 0.16 },
    );
    for (const el of els) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.95) el.classList.add("on");
      else ob.observe(el);
    }
    return () => ob.disconnect();
  }, []);
}

/* ───────────── count-up ───────────── */
function Count({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const ob = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        ob.disconnect();
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / 1300);
          el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString("en-IN");
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    ob.observe(el);
    // failsafe: whatever the observer or a throttled tab did, land on the true value
    const fallback = window.setTimeout(() => {
      cancelAnimationFrame(raf);
      el.textContent = to.toLocaleString("en-IN");
    }, 2600);
    return () => {
      ob.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
    };
  }, [to]);
  return <span ref={ref}>0</span>;
}

/* ───────────── live data for the hero wall ───────────── */
interface DemoResult {
  summary: AddressSummary;
  transfers: Transfer[];
  fromCache: boolean;
  screening: { ofacSanctioned: boolean; listSize: number };
}
const DEMO_CHIPS = [
  { address: "12HQDsicffSBaYdJ6BhnE22sfjTESmmzKx", label: "1,335 tx" },
  { address: "1295rkVyNfFpqZpXvKGhDqwhP1jZcNNDMV", label: "3,377 BTC" },
  { address: "134r8iHv69xdT6p5qVKTsHrcUEuBVZAYak", label: "1,538 BTC" },
];
const short = (a: string) => `${a.slice(0, 7)}…${a.slice(-5)}`;
const fmtV = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: v < 1 ? 5 : 2 });

function Hero({ ofacCount, loggedIn, initial }: { ofacCount: number; loggedIn: boolean; initial: DemoGraph | null }) {
  const [active, setActive] = useState(DEMO_CHIPS[0].address);
  const [data, setData] = useState<DemoResult | null>(
    initial
      ? { summary: { chain: "btc", address: initial.center, txCount: initial.txCount, receivedTotal: initial.receivedTotal, sentTotal: 0, balance: 0, symbol: initial.symbol, firstSeen: null, lastSeen: null }, transfers: initial.transfers, fromCache: true, screening: { ofacSanctioned: initial.sanctioned, listSize: ofacCount } }
      : null,
  );
  const [state, setState] = useState<"loading" | "ok" | "err">(initial ? "ok" : "loading");
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const load = useCallback(async (address: string) => {
    setActive(address);
    setState("loading");
    try {
      const res = await fetch(`/api/demo-trace?address=${address}`);
      if (!res.ok) throw new Error();
      setData((await res.json()) as DemoResult);
      setState("ok");
    } catch {
      setState("err");
    }
  }, []);
  useEffect(() => {
    if (!initial) load(DEMO_CHIPS[0].address);
  }, [load, initial]);
  const onHover = useCallback((h: HoverInfo | null) => setHover(h), []);

  const s = data?.summary;
  const graph = state === "ok" && data ? { center: data.summary.address, sanctioned: data.screening.ofacSanctioned, transfers: data.transfers } : null;

  return (
    <section className="hero-wall relative h-[100dvh] min-h-[640px] overflow-hidden">
      {/* the wall: live money-flow constellation */}
      <NetGraph input={graph} onHover={onHover} />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgba(6,9,14,0.62)_0%,rgba(6,9,14,0.5)_36%,rgba(6,9,14,0.12)_60%,transparent_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 pointer-events-none bg-[linear-gradient(180deg,transparent,rgba(6,9,14,0.55))]" />

      {/* the cash side of the seam — the demonstration statement, labelled */}
      <div className="hidden min-[1100px]:block absolute right-5 top-1/2 -translate-y-1/2 w-[204px] cash-paper border border-[#3a2f18] shadow-[0_0_0_1px_rgba(232,178,58,0.08)] pointer-events-none" aria-hidden="true">
        <div className="px-4 pt-3 pb-2 border-b border-[#2b2318]">
          <div className="mono text-[7.5px] tracking-[0.18em] uppercase font-extrabold text-cashmut">Off-chain · bank statement</div>
          <div className="mono text-[7px] tracking-[0.12em] uppercase text-[#b09a76] mt-0.5">demonstration · synthetic</div>
        </div>
        <div className="px-4 py-1">
          {(
            [
              ["11:38:52", "IMPS/P2P/ref 88120", "1,15,000", false],
              ["11:49:20", "IMPS/P2P/ref 88147", "7,98,180", true],
              ["11:56:44", "UPI/collect/…9903", "64,500", false],
            ] as const
          ).map(([t, n, v, hit]) => (
            <div key={t} className={`mono flex justify-between gap-2 text-[10px] py-[7px] border-b border-[#2b2318] last:border-0 ${hit ? "bg-[#2a1f0a] -mx-2 px-2 text-[#fbe9bc] shadow-[inset_2px_0_0_#e8b23a]" : "text-cashink"}`}>
              <span className={hit ? "" : "text-[#8a7659]"}>{t}</span>
              <span className="truncate">{n}</span>
              <span className="font-bold">₹{v}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-2.5 border-t border-[#2b2318] flex items-baseline justify-between">
          <span className="mono text-[7.5px] tracking-[0.16em] uppercase font-extrabold text-amber">candidate linkage</span>
          <span className="mono text-[15px] font-bold text-amber2 leading-none">96.9%</span>
        </div>
        <div className="px-4 pb-3 mono text-[7px] text-[#8c7a50]">Δ 0.22% · Δt 6 min 11 s</div>
      </div>

      {/* HUD — top */}
      <header className="absolute inset-x-0 top-0 flex items-center justify-between px-8 h-[68px] pointer-events-none">
        <div className="pointer-events-auto">
          <span className="text-[19px] font-extrabold tracking-[0.16em]">
            OFF<span className="text-amber">RAMP</span>
          </span>
          <span className="mono hidden sm:inline text-[8.5px] tracking-[0.15em] text-faint uppercase ml-3">Crypto flow intelligence</span>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
          <span className="mono hidden md:inline text-[9px] tracking-[0.12em] uppercase font-bold text-[#c9a0a3] border border-[#652225] bg-[#1a0c0e]/70 px-2.5 py-1">
            Restricted access
          </span>
          <Link
            href="/login"
            className="mono text-[10px] tracking-[0.12em] uppercase font-extrabold text-amber border border-amber/60 px-3.5 py-1.5 hover:bg-amber hover:text-[#12100c] transition-colors"
          >
            Console →
          </Link>
        </div>
      </header>

      {/* headline block */}
      <div className="absolute left-8 md:left-16 top-1/2 -translate-y-[56%] max-w-[760px] pointer-events-none">
        <p className="mono hlabel text-[9.5px] kin">
          <span>For cyber-crime units · investigator console</span>
        </p>
        <h1 className="text-[clamp(32px,4.2vw,54px)] leading-[1.06] font-extrabold mt-5 tracking-[-0.01em]">
          <span className="kin"><span>Follows the money</span></span>
          <span className="kin"><span style={{ animationDelay: "0.09s" }}>across the seam where it</span></span>
          <span className="kin"><span style={{ animationDelay: "0.18s" }}><span className="text-mut">stops being crypto</span></span></span>
          <span className="kin"><span style={{ animationDelay: "0.27s" }}>and <span className="text-amber">starts being cash.</span></span></span>
        </h1>
        <p className="rv text-[14px] text-mut leading-relaxed mt-6 max-w-[440px]" data-rv style={{ transitionDelay: "0.3s" }}>
          Trace stolen funds across BTC, ETH and TRON. Correlate the cash-out with the INR bank credit. Hand the
          officer a sealed freeze request while the withdrawal window is still open.
        </p>
        <div className="rv flex items-center gap-5 mt-8 pointer-events-auto" data-rv style={{ transitionDelay: "0.38s" }}>
          <Link
            href="/login"
            className="mono inline-flex items-center gap-2 bg-amber text-[#12100c] px-6 py-3 text-[11.5px] tracking-[0.12em] uppercase font-extrabold hover:brightness-110 transition"
          >
            Enter console →
          </Link>
          <a href="#seam" className="mono text-[10.5px] tracking-[0.1em] uppercase font-bold text-mut hover:text-ink transition-colors">
            How it works ↓
          </a>
        </div>
      </div>

      {/* HUD — bottom readout */}
      <div className="absolute inset-x-0 bottom-0 border-t border-line/70">
        <div className="px-8 h-[52px] flex items-center gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${state === "err" ? "bg-red" : "bg-green"} shadow-[0_0_0_3px_rgba(61,214,140,0.15)]`} />
            <span className="mono text-[8.5px] tracking-[0.16em] uppercase font-extrabold text-faint">
              {state === "loading" ? "querying chain" : state === "err" ? "chain unreachable" : "live · public chain data"}
            </span>
          </div>
          <div className="mono text-[11px] text-ink/90 truncate flex-1 min-w-0">
            {hover ? (
              hover.dir === "center" ? (
                <>
                  <span className="text-amber">{short(hover.addr)}</span> · traced wallet
                </>
              ) : (
                <>
                  <span className="text-amber">{short(hover.addr)}</span> · {fmtV(hover.value)} {hover.symbol}{" "}
                  <span className="text-faint">{hover.dir === "in" ? "received from" : "sent to"} this counterparty</span>
                </>
              )
            ) : s ? (
              <>
                {data?.screening.ofacSanctioned && <span className="text-red font-extrabold mr-2">OFAC SDN</span>}
                <span className="text-amber">{short(s.address)}</span> · {fmtV(s.receivedTotal)} {s.symbol} in ·{" "}
                {s.txCount.toLocaleString()} tx <span className="text-faint">· hover a node</span>
              </>
            ) : state === "err" ? (
              <span className="text-mut">cached demonstration set available inside the console</span>
            ) : (
              <span className="text-faint">—</span>
            )}
          </div>
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            {DEMO_CHIPS.map((c) => (
              <button
                key={c.address}
                onClick={() => load(c.address)}
                className={`mono text-[9px] px-2 py-1 border transition-colors ${
                  active === c.address ? "border-amber/70 text-amber bg-[#17130a]" : "border-line text-mut hover:text-ink hover:border-[#2c3a4c]"
                }`}
              >
                {c.address.slice(0, 6)}… · {c.label}
              </button>
            ))}
          </div>
          <Link
            href={loggedIn ? `/trace?address=${active}` : `/login?next=${encodeURIComponent(`/trace?address=${active}`)}`}
            className="mono shrink-0 text-[9px] tracking-[0.12em] uppercase font-extrabold text-amber border border-amber/50 px-2.5 py-1 hover:bg-amber hover:text-[#12100c] transition-colors"
          >
            Open in console →
          </Link>
          <div className="mono hidden xl:block text-[9px] text-faint shrink-0 tracking-[0.1em] uppercase">
            {ofacCount.toLocaleString("en-IN")} SDN screened
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────── the 41 minutes — auto-plays once in view ───────────── */
const EVENTS = [
  { x: 30, t: "11:02", label: "victim pays 9,412 USDT", tone: "mut" },
  { x: 215, t: "11:09", label: "split ×3 · structuring", tone: "amber" },
  { x: 375, t: "11:16", label: "rapid layering fires", tone: "red" },
  { x: 655, t: "11:28", label: "pass-through wallet", tone: "mut" },
  { x: 875, t: "11:43", label: "CASH-OUT · P2P merchant", tone: "amber" },
  { x: 975, t: "11:49", label: "₹7,98,180 credited", tone: "amber" },
] as const;

function CaseBand({ capture = false }: { capture?: boolean }) {
  const sec = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(capture ? 1 : 0);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const el = sec.current;
    if (!el || capture) return;
    let raf = 0;
    let started = false;
    const run = () => {
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / 4200);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        setP(e);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const ob = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started) {
          started = true;
          run();
        }
      },
      { threshold: 0.15 },
    );
    if (runId > 0) run();
    else ob.observe(el);
    return () => {
      ob.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [runId, capture]);

  const mins = p * 41;
  const clock = `${String(Math.floor(mins)).padStart(2, "0")}:${String(Math.floor((mins % 1) * 60)).padStart(2, "0")}`;

  return (
    <section id="case" ref={sec} className="border-b border-line">
      <div className="max-w-[1180px] mx-auto px-8 py-16 grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center">
        <div>
          <p className="mono hlabel text-[9.5px]">The case that does not get solved <span className="text-amber/80 ml-2">· demonstration · synthetic narrative</span></p>
          <h2 className="text-[clamp(26px,3vw,38px)] font-extrabold mt-4 leading-[1.1]">
            ₹8 lakh. Four wallets.
            <br />
            <span className="text-red">Forty-one minutes.</span>
          </h2>
          <div className="mono text-[clamp(44px,5vw,64px)] font-bold mt-6 tabular-nums tracking-tight leading-none">
            <span className="text-faint">T+</span>
            <span className={p > 0.93 ? "text-red" : "text-amber"}>{clock}</span>
          </div>
          <p className="text-[12.5px] text-mut leading-relaxed mt-6 max-w-[400px] transition-opacity duration-700" style={{ opacity: p > 0.88 ? 1 : 0.35 }}>
            By the time the FIR is registered, the money is rupees in a mule account in another state. The 1930
            pipeline can freeze a bank account — <span className="text-ink font-semibold">it cannot follow a wallet.</span>
          </p>
          <button onClick={() => setRunId((r) => r + 1)} className="mono mt-5 text-[9px] tracking-[0.14em] uppercase font-bold text-faint hover:text-amber transition-colors">
            ▶ replay
          </button>
        </div>
        <div>
          <svg viewBox="0 0 1000 130" className="w-full overflow-visible">
            <line x1="30" y1="65" x2="975" y2="65" stroke="#1b2431" strokeWidth="2" />
            <line x1="30" y1="65" x2={30 + 945 * p} y2="65" stroke="#e8b23a" strokeWidth="2.5" style={{ filter: "drop-shadow(0 0 6px rgba(232,178,58,0.6))" }} />
            {EVENTS.map((ev, i) => {
              const on = 30 + 945 * p >= ev.x;
              const col = !on ? "#26313f" : ev.tone === "red" ? "#e5484d" : ev.tone === "mut" ? "#8598aa" : "#e8b23a";
              const up = i % 2 === 0;
              const anchor = i === 0 ? "start" : i === EVENTS.length - 1 ? "end" : "middle";
              return (
                <g key={ev.x}>
                  <circle cx={ev.x} cy={65} r={on ? 7 : 5} fill="#070a0f" stroke={col} strokeWidth="2.5" style={{ transition: "all .3s" }} />
                  <text x={ev.x} y={up ? 40 : 96} textAnchor={anchor} fontSize="12.5" fontWeight="700" fill={on ? col : "#3d4c5c"} style={{ transition: "fill .3s", fontFamily: "var(--font-mono)" }}>
                    {ev.t}
                  </text>
                  <text x={ev.x} y={up ? 22 : 114} textAnchor={anchor} fontSize="11" fill={on ? "#aab8c6" : "#2c3a4c"} style={{ transition: "fill .3s" }}>
                    {ev.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="mono text-[9px] text-faint mt-3 text-right">MHA, Lok Sabha U.Q. 432 · 02.12.2025 — bank-side pipeline saved ₹7,130 cr; no crypto leg</div>
        </div>
      </div>
    </section>
  );
}


/* ───────────── console preview: the rail + a live mini-view per module ───────────── */
const MODULES = [
  { g: "TRIAGE", key: "live-board", name: "Live Board", n: 8, sub: "8 watched · 940 SDN · alerts once per event", chip: ["c-live", "live"], data: "live" },
  { g: "TRIAGE", key: "cases", name: "Cases", n: 1, sub: "one file per wallet · audited timeline · search", chip: ["c-mut", "demonstration case"], data: "demo" },
  { g: "INVESTIGATE", key: "trace", name: "Trace", n: 0, sub: "12HQDsi…mmzKx · OFAC SDN · Binance at hop 1", chip: ["c-live", "live · btc"], data: "live" },
  { g: "INVESTIGATE", key: "bridge", name: "Bridge", n: 0, sub: "on-chain → INR · amount × FX × time", chip: ["c-amb", "96.9% candidate"], data: "demo" },
  { g: "INVESTIGATE", key: "red-flags", name: "Red Flags", n: 3, sub: "FATF indicator suite · 3 of 10 fired", chip: ["c-red", "3 fired"], data: "live" },
  { g: "INVESTIGATE", key: "syndicates", name: "Syndicates", n: 3, sub: "47 complaints · Chandigarh · Ludhiana · Mohali · Panchkula", chip: ["c-amb", "3 groups"], data: "demo" },
  { g: "ACT", key: "intercept", name: "Intercept", n: 1, sub: "case 2026-CHD-0417 · trigger 11:43:09 IST", chip: ["c-red", "window open"], data: "demo" },
  { g: "ACT", key: "evidence", name: "Evidence", n: 0, sub: "4 artefacts · hash chain · STR · s.63", chip: ["c-live", "sealed"], data: "live" },
] as const;
/* the order an investigator actually works in — what the preview cycles through */
const FLOW: ModuleKey[] = ["trace", "red-flags", "bridge", "intercept", "evidence", "live-board", "cases", "syndicates"];

const chipCls: Record<string, string> = {
  "c-live": "text-green border-[#1c5943] bg-[#08170f]",
  "c-red": "text-red border-[#652225] bg-[#1a0c0e]",
  "c-amb": "text-amber border-[#66501e] bg-[#17130a]",
  "c-mut": "text-mut border-line bg-panel2",
};

function ConsolePreview() {
  const [active, setActive] = useState<ModuleKey>("trace");
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched) return;
    const id = setInterval(() => setActive((k) => FLOW[(FLOW.indexOf(k) + 1) % FLOW.length]), 3400);
    return () => clearInterval(id);
  }, [touched]);
  const mod = MODULES.find((m) => m.key === active)!;
  const step = FLOW.indexOf(active) + 1;
  const groups = ["TRIAGE", "INVESTIGATE", "ACT"] as const;

  return (
    <div className="rv grid lg:grid-cols-[214px_1fr] border border-line" data-rv style={{ transitionDelay: "0.1s" }} onMouseEnter={() => setTouched(true)}>
      {/* the rail, as it is in the console */}
      <aside className="border-b lg:border-b-0 lg:border-r border-line py-4">
        <div className="px-[18px] pb-3">
          <div className="text-[15px] font-extrabold tracking-[0.16em]">OFF<span className="text-amber">RAMP</span></div>
          <div className="text-[7.5px] tracking-[0.15em] text-faint uppercase mt-1">Crypto flow intelligence</div>
        </div>
        {groups.map((g) => (
          <div key={g} className="px-2.5 mt-2.5">
            <div className="text-[7.5px] tracking-[0.2em] text-[#3d4c5c] px-[11px] pb-1 uppercase font-bold">{g}</div>
            {MODULES.filter((m) => m.g === g).map((m) => (
              <button
                key={m.key}
                onMouseEnter={() => setActive(m.key)}
                onFocus={() => setActive(m.key)}
                onClick={() => setActive(m.key)}
                className={`w-full flex items-center justify-between text-[11.5px] px-[11px] py-[6px] rounded-sm text-left ${
                  active === m.key ? "bg-[#141e29] text-[#f2f7fb] font-semibold shadow-[inset_2px_0_0_#e8b23a]" : "text-mut hover:text-ink"
                }`}
              >
                {m.name}
                {m.n > 0 && <span className="text-[8px] text-[#55677a] font-semibold">{m.n}</span>}
              </button>
            ))}
          </div>
        ))}
      </aside>
      {/* the module, live */}
      <div className="flex flex-col min-h-[360px]">
        <div className="h-[46px] border-b border-line flex items-center px-5 gap-3">
          <div>
            <div className="text-[12px] font-bold leading-tight">{mod.name}</div>
            <div className="mono text-[9px] text-[#657a8e]">{mod.sub}</div>
          </div>
          <span className="mono ml-auto text-[8.5px] tracking-[0.12em] uppercase text-faint hidden sm:inline">step {step} of {FLOW.length}</span>
          <span className={`mono text-[8.5px] tracking-[0.08em] uppercase font-bold border px-2 py-0.5 ${mod.data === "live" ? chipCls["c-live"] : chipCls["c-mut"]}`}>{mod.data === "live" ? "live chain data" : "synthetic · labelled"}</span>
          <span className={`mono text-[8.5px] tracking-[0.08em] uppercase font-bold border px-2 py-0.5 ${chipCls[mod.chip[0]]}`}>{mod.chip[1]}</span>
        </div>
        <div key={active} className="row-in p-5 flex-1">
          <ModulePreview k={active} />
        </div>
        <div className="border-t border-line px-5 h-[38px] flex items-center justify-between">
          <span className="mono text-[8.5px] text-faint">{touched ? "hover a module on the left" : "walking the investigation in order · hover to take control"}</span>
          <Link href={`/login?next=${encodeURIComponent(`/${mod.key}`)}`} className="mono text-[9px] tracking-[0.12em] uppercase font-extrabold text-amber hover:brightness-110">
            Open {mod.name} in console →
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════ page ═════════════════════════ */
export default function Landing({ ofacCount, syncedAt, tickerAddrs, capture = false, loggedIn = false, initial = null }: { ofacCount: number; syncedAt: string | null; tickerAddrs: string[]; capture?: boolean; loggedIn?: boolean; initial?: DemoGraph | null }) {
  useReveal();
  const tick = [...tickerAddrs, ...tickerAddrs];
  return (
    <div className={`ground grain min-h-screen text-ink overflow-x-clip ${capture ? "capture" : ""}`}>
      <Hero ofacCount={ofacCount} loggedIn={loggedIn} initial={initial} />

      {/* SDN ticker */}
      <div className="border-b border-line overflow-hidden py-2.5">
        <div className="ticker flex gap-8 w-max">
          {tick.map((a, i) => (
            <span key={i} className="mono text-[9.5px] text-faint whitespace-nowrap">
              <span className="text-red/80 font-bold">SDN</span> {a}
            </span>
          ))}
        </div>
        <div className="mono text-center text-[8.5px] tracking-[0.16em] uppercase text-faint mt-1.5">
          {ofacCount.toLocaleString("en-IN")} sanctioned addresses screened on every trace{syncedAt ? ` · synced ${syncedAt.slice(0, 10)}` : ""}
        </div>
      </div>

      <CaseBand capture={capture} />

      {/* the seam — full bleed */}
      <section id="seam" className="relative">
        <div className="max-w-[1180px] mx-auto px-8 pt-20 pb-8">
          <p className="rv mono hlabel text-[9.5px]" data-rv>How it works</p>
          <h2 className="rv text-[clamp(26px,3vw,38px)] font-extrabold mt-4 leading-[1.1]" data-rv style={{ transitionDelay: "0.05s" }}>
            One screen. Both sides of the money.
          </h2>
        </div>
        <div className="rv relative border-y border-line" data-rv style={{ transitionDelay: "0.1s" }}>
          <div className="hidden md:grid grid-cols-[1fr_auto_1fr] items-center border-b border-line">
            <div className="mono text-[9px] tracking-[0.2em] uppercase font-extrabold text-ink/80 py-2.5 pl-[max(2rem,calc((100vw-1180px)/2+2rem))]">Crypto <span className="text-faint font-bold">· public chain, traceable</span></div>
            <div className="mono text-[8.5px] tracking-[0.22em] uppercase font-extrabold text-amber px-5 py-2.5 border-x border-line">the seam</div>
            <div className="mono text-[9px] tracking-[0.2em] uppercase font-extrabold text-cashink py-2.5 pr-[max(2rem,calc((100vw-1180px)/2+2rem))] text-right">Cash <span className="text-[#9c8663] font-bold">· INR bank credit, freezable</span></div>
          </div>
          <div className="grid md:grid-cols-2">
            <div className="px-8 md:pl-[max(2rem,calc((100vw-1180px)/2+2rem))] md:pr-32 py-10">
              <div className="mono text-[8.5px] tracking-[0.18em] uppercase font-extrabold text-mut mb-5">
                On-chain · TRC-20 USDT <span className="text-amber ml-2">demonstration case · synthetic — labelled</span>
              </div>
              {[
                ["11:43:09", "TVd6j…2Lm7 → sold off-chain", "9,398 USDT"],
                ["11:28:31", "TBn2w…9Rc5 · pass-through", "9,398 USDT"],
                ["11:16:02", "TZp8s…4Kf1 · rapid layering", "9,404 USDT"],
                ["11:09:44", "TQm4v…1Bd8 · split ×3", "9,410 USDT"],
              ].map(([t, a, v]) => (
                <div key={t} className="mono flex justify-between gap-3 text-[11.5px] border-b border-line2 py-3">
                  <span className="text-faint shrink-0">{t}</span>
                  <span className="text-ink/85 truncate">{a}</span>
                  <span className="text-ink font-bold shrink-0">{v}</span>
                </div>
              ))}
            </div>
            <div className="cash-paper px-8 md:pl-32 md:pr-[max(2rem,calc((100vw-1180px)/2+2rem))] py-10">
              <div className="mono text-[8.5px] tracking-[0.18em] uppercase font-extrabold text-cashmut mb-5">
                Off-chain · bank statement <span className="text-[#b09a76] ml-2">synthetic — labelled</span>
              </div>
              {(
                [
                  ["11:31:07", "UPI/collect/…4471", "42,000", false],
                  ["11:38:52", "IMPS/P2P/ref 88120", "1,15,000", false],
                  ["11:49:20", "IMPS/P2P/ref 88147", "7,98,180", true],
                  ["11:56:44", "UPI/collect/…9903", "64,500", false],
                ] as const
              ).map(([t, n, v, hit]) => (
                <div
                  key={t}
                  className={`mono flex justify-between gap-3 text-[11.5px] border-b border-[#2b2318] py-3 ${
                    hit ? "bg-[#2a1f0a] -mx-3 px-3 text-[#fbe9bc] shadow-[inset_2px_0_0_#e8b23a]" : "text-cashink"
                  }`}
                >
                  <span className={hit ? "" : "text-[#8a7659]"}>{t}</span>
                  <span className="truncate">{n}</span>
                  <span className="font-bold">₹{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden md:block absolute left-1/2 top-[38px] bottom-0 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-amber to-transparent seam-line" />
          <div className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-[#8a6f26] bg-[#0e0c08] px-5 py-3 text-center z-10">
            <div className="mono text-[8px] tracking-[0.18em] font-extrabold text-amber">CANDIDATE LINKAGE</div>
            <div className="mono text-[24px] font-bold text-amber2 leading-tight">96.9%</div>
            <div className="mono text-[7.5px] text-[#8c7a50] mt-0.5">amount × FX × time · Δ 0.22% · Δt 6 min 11 s</div>
          </div>
        </div>
        <div className="max-w-[1180px] mx-auto px-8 py-10 grid sm:grid-cols-3 gap-10">
          {[
            ["01", "Trace the chain", "Follow the funds hop by hop across BTC, ETH and TRON, on live public data."],
            ["02", "Correlate the credit", "Match the cash-out to an INR credit on amount × FX × time — a candidate linkage, stated as such. The statement is synthetic here; in a case it is the one the bank supplies."],
            ["03", "Seal the packet", "A hash-chained freeze request and evidence pack, ready for the authorised officer."],
          ].map(([n, t, d], i) => (
            <div key={n} className="rv border-t border-line pt-4" data-rv style={{ transitionDelay: `${0.08 * i}s` }}>
              <div className="mono text-[10px] font-extrabold text-amber">{n}</div>
              <div className="text-[15px] font-bold mt-2">{t}</div>
              <p className="text-[12.5px] text-mut leading-relaxed mt-1.5">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* the console — live preview of every module */}
      <section id="console" className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-8 py-16">
          <p className="rv mono hlabel text-[9.5px]" data-rv>The console</p>
          <h2 className="rv text-[clamp(26px,3vw,38px)] font-extrabold mt-4 leading-[1.1]" data-rv style={{ transitionDelay: "0.05s" }}>
            Eight modules, grouped the way an investigator works.
          </h2>
          <p className="rv text-[13px] text-mut mt-3 max-w-xl" data-rv style={{ transitionDelay: "0.08s" }}>
            Triage what needs attention, investigate one case end to end, then act — every module below is a screen in the console.
          </p>
          <div className="mt-9">
            <ConsolePreview />
          </div>
        </div>
      </section>

      {/* readouts + cta */}
      <section id="trust" className="max-w-[1180px] mx-auto px-8 py-20">
        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line border-y border-line">
          {[
            { pre: "₹", n: 22845, post: " cr", l: "lost to cyber fraud in India in 2024 · MHA, Lok Sabha Q.432", c: "text-red" },
            { pre: "₹", n: 7130, post: " cr", l: "frozen by the bank-side 1930 / CFCFRMS pipeline — which has no crypto leg", c: "text-green" },
            { pre: "", n: ofacCount, post: "", l: `OFAC SDN addresses screened on every node of every trace${syncedAt ? ` · synced ${syncedAt.slice(0, 10)}` : ""}`, c: "text-amber" },
          ].map((x, i) => (
            <div key={x.l} className="rv py-7 sm:px-8 first:pl-0" data-rv style={{ transitionDelay: `${i * 0.08}s` }}>
              <div className={`mono text-[30px] font-bold whitespace-nowrap ${x.c}`}>
                {x.pre}
                <Count to={x.n} />
                {x.post}
              </div>
              <div className="text-[11px] text-mut mt-2">{x.l}</div>
            </div>
          ))}
        </div>
        <div className="mt-16 grid lg:grid-cols-[1fr_auto] gap-8 items-end">
          <div>
            <h2 className="rv text-[clamp(24px,2.8vw,34px)] font-extrabold leading-[1.15]" data-rv>
              Every trace it outputs can be checked on a <span className="text-amber">public block explorer.</span>
            </h2>
            <p className="rv text-[13px] text-mut mt-4 max-w-xl leading-relaxed" data-rv style={{ transitionDelay: "0.07s" }}>
              No black boxes. Detection is named, explainable rules — not a score out of a hundred. On-chain data is
              live; bank-side and complaint records are synthetic and labelled, on screen, every time.
            </p>
          </div>
          <div className="rv" data-rv style={{ transitionDelay: "0.14s" }}>
            <Link
              href="/login"
              className="mono inline-flex items-center gap-2 bg-amber text-[#12100c] px-7 py-3.5 text-[11.5px] tracking-[0.12em] uppercase font-extrabold hover:brightness-110 transition"
            >
              Enter console →
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-[1180px] mx-auto px-8 py-5 flex flex-wrap items-center justify-between gap-3">
          <span className="mono text-[9px] text-faint tracking-wide">OFFRAMP — evaluation build · on-chain data live</span>
          <span className="mono text-[9px] text-faint tracking-wide">Built for the unit that files the FIR.</span>
        </div>
      </footer>
    </div>
  );
}
