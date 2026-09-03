"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { TraceResult, TraceNode, TraceEdge } from "@/lib/trace/engine";
import type { LookupResult } from "@/lib/chains/types";
import { TopBar, AddressInput, Seg, Primary, Chip, Section, KV, Flag, StatusBar, Empty } from "@/components/console";

type Lookup = LookupResult & { screening: { ofacSanctioned: boolean; listSize: number; listSyncedAt: string | null; reported: { source: string; category: string } | null; entity: { entity: string; type: string; source: string } | null } };

type BookEntry = { address: string; chain: string; txCount: number; received: number; symbol: string; verifiedOn: string; why: string };
const DEMO = [
  { address: "12HQDsicffSBaYdJ6BhnE22sfjTESmmzKx", chain: "btc", why: "OFAC SDN · 1,335 tx · reaches Binance at hop 1" },
  { address: "1295rkVyNfFpqZpXvKGhDqwhP1jZcNNDMV", chain: "btc", why: "OFAC SDN · 3,377 BTC received" },
  { address: "TA82wQ77kb9DieW4C8q7C4KwMfnCzfziqN", chain: "tron", why: "OFAC SDN · USDT · sanctioned neighbours" },
  { address: "0x0330070FD38Ec3bB94F58FA55D40368271E9e54A", chain: "eth", why: "OFAC SDN · ETH" },
] as const;

const short = (a: string) => (a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
const fmtV = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: v < 1 ? 5 : 2 });
const fmtT = (t: number | null) =>
  t ? new Date(t).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";

/* ───────────── flow graph: fills its container, hop columns, value-weighted edges ───────────── */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 1000, h: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(400, e.contentRect.width), h: Math.max(300, e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

function layout(res: TraceResult, W: number, H: number) {
  const byHop = new Map<number, TraceNode[]>();
  for (const n of res.nodes) byHop.set(n.hop, [...(byHop.get(n.hop) ?? []), n]);
  const maxHop = Math.max(...byHop.keys());
  const pos = new Map<string, { x: number; y: number }>();
  const padL = 150;
  const padR = 250;
  const padY = 56;
  const colGap = maxHop === 0 ? 0 : (W - padL - padR) / maxHop;
  for (const [hop, list] of byHop) {
    list.sort((a, b) => b.inValue + b.outValue - (a.inValue + a.outValue));
    const gap = (H - padY * 2) / (list.length + 1);
    list.forEach((n, i) => pos.set(n.address, { x: padL + hop * colGap, y: padY + gap * (i + 1) }));
  }
  const maxEdge = Math.max(1e-9, ...res.edges.map((e) => e.value));
  return { pos, maxHop, maxEdge };
}

function Flow({ res, selected, onSelect }: { res: TraceResult; selected: string | null; onSelect: (a: string) => void }) {
  const { ref, size } = useSize<HTMLDivElement>();
  const { pos, maxEdge } = useMemo(() => layout(res, size.w, size.h), [res, size]);
  const adjacent = useMemo(() => {
    const s = new Set<string>();
    if (!selected) return s;
    for (const e of res.edges) {
      if (e.from === selected) s.add(e.to);
      if (e.to === selected) s.add(e.from);
    }
    return s;
  }, [res, selected]);
  const touches = (e: TraceEdge) => selected !== null && (e.from === selected || e.to === selected);

  return (
    <div ref={ref} className="absolute inset-0">
      <svg width={size.w} height={size.h} className="block">
        {res.edges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const w = 1.2 + 4 * (Math.log10(1 + e.value) / Math.log10(1 + maxEdge));
          const hi = touches(e);
          const dim = selected !== null && !hi;
          const mx = (a.x + b.x) / 2;
          return <path key={i} d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`} fill="none" stroke={hi ? "#e8b23a" : "#7a8ea3"} strokeOpacity={dim ? 0.28 : hi ? 0.95 : 0.6} strokeWidth={w} />;
        })}
        {res.edges
          .filter((e) => touches(e) || e.value >= maxEdge * 0.3)
          .slice(0, 16)
          .map((e, i) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            return (
              <text key={"l" + i} x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 7} textAnchor="middle" fontSize="11" fill={touches(e) ? "#e8b23a" : "#9fb0c1"} style={{ fontFamily: "var(--font-mono)" }}>
                {fmtV(e.value)}
              </text>
            );
          })}
        {res.nodes.map((n) => {
          const p = pos.get(n.address)!;
          const isSeed = n.hop === 0;
          const r = isSeed ? 13 : n.entity ? 10 : 8;
          const stroke = n.sanctioned ? "#e5484d" : n.entity ? "#46a5bf" : isSeed ? "#e8b23a" : "#9fb0c1";
          const isSel = selected === n.address;
          const dim = selected !== null && !isSel && !adjacent.has(n.address);
          const right = true;
          const lx = p.x + r + 9;
          return (
            <g key={n.address} onClick={() => onSelect(n.address)} style={{ cursor: "pointer", opacity: dim ? 0.5 : 1, transition: "opacity .2s" }}>
              {(n.sanctioned || isSel) && <circle cx={p.x} cy={p.y} r={r + 7} fill="none" stroke={isSel ? "#e8b23a" : "#e5484d"} strokeOpacity="0.5" strokeWidth="1.2" />}
              <circle cx={p.x} cy={p.y} r={r} fill={n.sanctioned ? "#12080a" : n.entity ? "#0a1a1f" : "#0b1119"} stroke={stroke} strokeWidth={isSel ? 2.5 : 1.8} />
              <text x={lx} y={p.y - 3} textAnchor={right ? "start" : "end"} fontSize="12.5" fill="#e3ebf2" style={{ fontFamily: "var(--font-mono)" }}>
                {short(n.address)}
              </text>
              <text x={lx} y={p.y + 12} textAnchor={right ? "start" : "end"} fontSize="10.5" fill={n.entity ? "#46a5bf" : n.sanctioned ? "#e5484d" : "#7a8ea3"} style={{ fontFamily: "var(--font-mono)" }}>
                {n.entity ? `${n.entity.entity} · ${n.entity.type}` : n.sanctioned ? "OFAC SDN" : n.expanded ? `${fmtV(n.inValue || n.outValue)} ${n.symbol}` : "not expanded"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ───────────── page ───────────── */
function TraceInner() {
  const params = useSearchParams();
  const [address, setAddress] = useState("");
  const [book, setBook] = useState<BookEntry[]>([]);
  useEffect(() => {
    fetch("/api/addresses").then((r) => r.json()).then((b) => setBook(b.addresses ?? [])).catch(() => {});
  }, []);
  const [depth, setDepth] = useState(2);
  const [fanout, setFanout] = useState(5);
  const [dir, setDir] = useState<"out" | "in">("out");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<TraceResult | null>(null);
  const [seedInfo, setSeedInfo] = useState<Lookup | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const run = useCallback(
    async (addr?: string, d = depth, f = fanout, dr = dir) => {
      const a = (addr ?? address).trim();
      if (!a) return;
      setLoading(true);
      setError(null);
      setSelected(null);
      try {
        const [t, l] = await Promise.all([
          fetch(`/api/trace?address=${encodeURIComponent(a)}&depth=${d}&fanout=${f}&dir=${dr}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
          fetch(`/api/lookup?address=${encodeURIComponent(a)}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
        ]);
        if (!t.ok) throw new Error(t.body.error ?? "HTTP error");
        setRes(t.body as TraceResult);
        setSeedInfo(l.ok ? (l.body as Lookup) : null);
        setSelected(a);
      } catch (e) {
        setRes(null);
        setError(e instanceof Error ? e.message : "trace failed");
      } finally {
        setLoading(false);
      }
    },
    [address, depth, fanout, dir],
  );

  useEffect(() => {
    const a = params.get("address");
    if (a) {
      const d = Math.min(4, Math.max(1, Number(params.get("depth") ?? 2) || 2));
      const f = [3, 5, 8].includes(Number(params.get("fanout"))) ? Number(params.get("fanout")) : 5;
      const dr = params.get("dir") === "in" ? "in" : "out";
      setAddress(a);
      setDepth(d);
      setFanout(f);
      setDir(dr);
      run(a, d, f, dr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selNode = res && selected ? res.nodes.find((n) => n.address === selected) ?? null : null;
  const selEdges = res && selected ? res.edges.filter((e) => e.from === selected || e.to === selected).sort((a, b) => b.value - a.value) : [];
  const s = seedInfo?.summary;
  const sanctionedBeyond = res ? res.nodes.filter((n) => n.sanctioned && n.hop > 0).length : 0;
  const entities = res ? res.nodes.filter((n) => n.entity) : [];
  const topCounterparties = useMemo(() => {
    if (!res) return [];
    const m = new Map<string, number>();
    for (const e of res.edges) {
      const other = e.from === res.seed ? e.to : e.to === res.seed ? e.from : null;
      if (other) m.set(other, (m.get(other) ?? 0) + e.value);
    }
    const total = [...m.values()].reduce((a, b) => a + b, 0) || 1;
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([addr, v]) => ({ addr, v, share: v / total, node: res.nodes.find((n) => n.address === addr) }));
  }, [res]);

  return (
    <div className="flex flex-col h-screen">
      <TopBar
        title="Trace"
        subtitle="BTC · ETH · TRON — auto-detected"
        secondRow={
          <>
            <Seg label="direction" value={dir} options={[["out", "where it went"], ["in", "where it came from"]]} onChange={(v) => setDir(v as "out" | "in")} />
            <Seg label="depth" value={String(depth)} options={[["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]]} onChange={(v) => setDepth(Number(v))} />
            <Seg label="fan-out" value={String(fanout)} options={[["3", "3"], ["5", "5"], ["8", "8"]]} onChange={(v) => setFanout(Number(v))} />
            <span className="ml-auto c-note">each hop follows the largest counterparties · stops at known entities</span>
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
          <AddressInput value={address} onChange={setAddress} />
          <Primary disabled={loading}>{loading ? "tracing…" : "trace"}</Primary>
        </form>
      </TopBar>

      {!res && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {error && <div className="mx-8 mt-6 border border-[#652225] bg-[#1a0c0e] text-red px-4 py-3 text-[13px] max-w-xl">{error}</div>}
          {loading && <div className="px-8 pt-6 mono text-[12px] text-faint">querying chain — {depth} hop{depth > 1 ? "s" : ""}, up to {fanout} counterparties each…</div>}
          {!error && !loading && (
            <div className="px-8 py-8 max-w-[1100px]">
              <div className="grid lg:grid-cols-[1fr_1fr] gap-10">
                <div>
                  <div className="c-label">Start a trace</div>
                  <h2 className="text-[22px] font-bold mt-2 leading-tight">Paste a wallet. Follow the money until it turns into cash.</h2>
                  <p className="c-body mt-3 max-w-md">
                    Each hop follows the largest counterparties on live public chain data. The trail stops at a known exchange or mixer — that is
                    where Intercept takes over. Every address on the OFAC SDN list is flagged on sight.
                  </p>
                  <div className="c-label mt-8">Verified demonstration wallets</div>
                  <div className="mt-3 flex flex-col gap-2">
                    {(book.length ? book.slice(0, 8).map((b) => ({ address: b.address, chain: b.chain, why: `${b.txCount.toLocaleString()} tx · ${b.received.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${b.symbol} · verified ${b.verifiedOn}` })) : DEMO).map((d) => (
                      <button
                        key={d.address}
                        onClick={() => {
                          setAddress(d.address);
                          run(d.address);
                        }}
                        className="group flex items-center gap-4 border border-line bg-rail px-4 py-3 text-left hover:border-amber/60 transition-colors"
                      >
                        <Chip tone={d.chain === "btc" ? "amber" : d.chain === "tron" ? "teal" : "mut"}>{d.chain}</Chip>
                        <span className="mono text-[12.5px] text-ink/90 truncate flex-1">{d.address}</span>
                        <span className="c-note shrink-0">{d.why}</span>
                        <span className="mono text-amber opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border border-line bg-rail">
                  <div className="h-[46px] border-b border-line flex items-center px-5 gap-3">
                    <span className="c-label">What you will get</span>
                    <span className="ml-auto"><Chip tone="green">live public chain data</Chip></span>
                  </div>
                  <div className="p-5 grid grid-cols-[1fr_1fr] gap-x-6 gap-y-5">
                    {[
                      ["Flow graph", "hop-layered, edge width ∝ value, sanctioned nodes ringed red"],
                      ["Screening", "OFAC SDN on the seed and every wallet reached"],
                      ["Known entities", "the trail stops at a publicly attributed exchange or mixer"],
                      ["Counterparties", "largest destinations with share of traced value"],
                      ["Trace from here", "re-seed from any intermediary in one click"],
                      ["Hand-off", "send the wallet to Bridge, Red Flags or Intercept"],
                    ].map(([t, d]) => (
                      <div key={t}>
                        <div className="text-[13px] font-semibold">{t}</div>
                        <div className="c-note mt-1">{d}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {res && (
        <div className="flex-1 min-h-0 grid grid-cols-[340px_1fr_360px]">
          {/* left: summary */}
          <aside className="border-r border-line bg-rail overflow-y-auto">
            <Section title="Address summary" chip={<Chip tone="green">{seedInfo?.fromCache ? "cached" : "live"}</Chip>}>
              <div className="mono text-[12.5px] break-all text-ink/90 leading-snug">{res.seed}</div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                <KV k="Chain" v={res.chain.toUpperCase()} />
                <KV k="Transfers seen" v={s ? s.txCount.toLocaleString() : "—"} />
                <KV k="Received" v={s ? `${fmtV(s.receivedTotal)} ${s.symbol}` : "—"} />
                <KV k="Sent" v={s ? `${fmtV(s.sentTotal)} ${s.symbol}` : "—"} />
                <KV k="First seen" v={fmtT(s?.firstSeen ?? null)} />
                <KV k="Last seen" v={fmtT(s?.lastSeen ?? null)} />
              </div>
            </Section>
            <Section title="Screening">
              <Flag on={!!seedInfo?.screening.ofacSanctioned} onText="OFAC SDN — sanctioned address" offText="Not on the OFAC SDN list" tone="red" />
              <Flag on={!!seedInfo?.screening.reported} onText={`Community report — ${seedInfo?.screening.reported?.category ?? "reported"} (a report, not a finding)`} offText="No community report on this address" tone="red" />
              {seedInfo?.screening.entity && <Flag on onText={`Known entity — ${seedInfo.screening.entity.entity} · ${seedInfo.screening.entity.type} · public source`} offText="" tone="teal" />}
              <Flag on={sanctionedBeyond > 0} onText={`${sanctionedBeyond} sanctioned wallet${sanctionedBeyond === 1 ? "" : "s"} within ${res.stats.hopsReached} hop${res.stats.hopsReached === 1 ? "" : "s"}`} offText="No sanctioned wallets in the traced neighbourhood" tone="red" />
              <Flag on={entities.length > 0} onText={entities.map((n) => `${n.entity!.entity} reached at hop ${n.hop} · ${fmtV(n.inValue)} ${n.symbol}`).join(" · ")} offText="No known exchange or mixer reached" tone="teal" />
              <div className="c-note mt-2">{seedInfo?.screening.listSize.toLocaleString()} SDN addresses · attribution only where publicly documented</div>
            </Section>
            <Section title="Top counterparties">
              {topCounterparties.map((c) => (
                <button key={c.addr} onClick={() => setSelected(c.addr)} className="w-full text-left py-2 border-b border-line2 last:border-0 hover:bg-panel/60">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`mono text-[12px] truncate ${c.node?.entity ? "text-teal" : c.node?.sanctioned ? "text-red" : "text-ink/90"}`}>
                      {c.node?.entity ? `${short(c.addr)} · ${c.node.entity.entity}` : short(c.addr)}
                    </span>
                    <span className="mono text-[12px] font-bold shrink-0">{fmtV(c.v)}</span>
                  </div>
                  <div className="mt-1.5 h-[3px] bg-line2">
                    <div className="h-full bg-amber/70" style={{ width: `${Math.max(2, c.share * 100)}%` }} />
                  </div>
                </button>
              ))}
            </Section>
            <Section title="This trace">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <KV k="Hops reached" v={String(res.stats.hopsReached)} />
                <KV k="Nodes / edges" v={`${res.nodes.length} / ${res.edges.length}`} />
                <KV k="Chain requests" v={`${res.stats.requests} · ${res.stats.fromCache} cached`} />
                <KV k="Time" v={`${(res.stats.ms / 1000).toFixed(1)} s`} />
              </div>
              <div className="c-note mt-3">
                Follows the {res.fanout} largest counterparties per hop, {res.direction === "out" ? "downstream" : "upstream"}. Stops at known entities. Heuristic — an
                investigative lead, not proof.
              </div>
            </Section>
            <Section title="Next">
              <div className="flex flex-col gap-2">
                {[
                  ["/bridge?address={a}", "Cross the seam in Bridge", "match the cash-out to an INR credit"],
                  ["/red-flags?address={a}", "Run the ten detectors", "named FATF rules with reasons"],
                  ["/intercept?address={a}", "Open Intercept", "compose the freeze packet"],
                  ["/cases?address={a}", "Open a case on this wallet", "case file with timeline and hand-offs"],
                  ["/live-board?watch={a}", "Watch on the Live Board", "re-evaluated against live chain state"],
                ].map(([href, t, d]) => (
                  <Link key={href} href={href.replace("{a}", encodeURIComponent(res.seed))} className="group flex items-center justify-between border border-line px-3.5 py-2.5 hover:border-amber/60 transition-colors">
                    <span>
                      <span className="block text-[13px] font-semibold group-hover:text-amber transition-colors">{t}</span>
                      <span className="block c-note">{d}</span>
                    </span>
                    <span className="mono text-amber">→</span>
                  </Link>
                ))}
              </div>
            </Section>
          </aside>

          {/* centre: flow */}
          <div className="relative min-w-0">
            <div className="absolute top-4 left-5 c-label z-10">
              Flow · {res.direction === "out" ? "downstream" : "upstream"} · hop 0 → {res.stats.hopsReached}
            </div>
            <div className="absolute top-4 right-5 c-note z-10">click a node · edge width ∝ value</div>
            <div className="absolute inset-0 top-10">
              <Flow res={res} selected={selected} onSelect={setSelected} />
            </div>
          </div>

          {/* right: selected node */}
          <aside className="border-l border-line bg-rail overflow-y-auto">
            {selNode ? (
              <>
                <Section
                  title={selNode.hop === 0 ? "Seed wallet" : `Hop ${selNode.hop}`}
                  chip={selNode.sanctioned ? <Chip tone="red">OFAC SDN</Chip> : selNode.entity ? <Chip tone="teal">{selNode.entity.entity}</Chip> : undefined}
                >
                  <div className="mono text-[12.5px] break-all text-ink/90 leading-snug">{selNode.address}</div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                    <KV k="In (traced)" v={`${fmtV(selNode.inValue)} ${selNode.symbol}`} />
                    <KV k="Out (traced)" v={`${fmtV(selNode.outValue)} ${selNode.symbol}`} />
                    <KV k="Transfers seen" v={selNode.txCount === null ? "not expanded" : selNode.txCount.toLocaleString()} />
                    <KV k="Role" v={selNode.entity ? `${selNode.entity.type}` : selNode.hop === 0 ? "seed" : "intermediary"} tone={selNode.entity ? "teal" : undefined} />
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    {selNode.entity && (
                      <a href={selNode.entity.source} target="_blank" rel="noreferrer" className="mono text-[10.5px] text-teal underline underline-offset-4">
                        attribution source ↗
                      </a>
                    )}
                    {selNode.hop > 0 && !selNode.entity && (
                      <button
                        onClick={() => {
                          setAddress(selNode.address);
                          run(selNode.address);
                        }}
                        className="mono text-[10.5px] tracking-[0.12em] uppercase font-extrabold text-amber border border-amber/50 px-3 py-1.5 hover:bg-amber hover:text-[#12100c]"
                      >
                        Trace from here →
                      </button>
                    )}
                  </div>
                </Section>
                <Section title={`Edges · ${selEdges.length}`}>
                  {selEdges.map((e, i) => {
                    const outgoing = e.from === selected;
                    const other = outgoing ? e.to : e.from;
                    const on = res.nodes.find((n) => n.address === other);
                    return (
                      <button key={i} onClick={() => setSelected(other)} className="w-full text-left border-b border-line2 last:border-0 py-2.5 hover:bg-panel/60">
                        <div className="flex items-center gap-3">
                          <Chip tone={outgoing ? "amber" : "green"}>{outgoing ? "out" : "in"}</Chip>
                          <span className={`mono text-[12.5px] flex-1 truncate ${on?.entity ? "text-teal" : on?.sanctioned ? "text-red" : "text-ink/90"}`}>{short(other)}</span>
                          <span className="mono text-[13px] font-bold shrink-0">{fmtV(e.value)}</span>
                        </div>
                        <div className="c-note mt-1">
                          {e.count} transfer{e.count === 1 ? "" : "s"} · {fmtT(e.firstTime)}
                          {e.lastTime && e.lastTime !== e.firstTime ? ` → ${fmtT(e.lastTime)}` : ""}
                          {on?.entity ? ` · ${on.entity.entity}` : on?.sanctioned ? " · OFAC SDN" : ""}
                        </div>
                      </button>
                    );
                  })}
                </Section>
              </>
            ) : (
              <Empty>Select a node in the flow.</Empty>
            )}
          </aside>
        </div>
      )}

      <StatusBar
        left={<>live public chain data{res ? ` · ${res.stats.hopsReached} hop${res.stats.hopsReached === 1 ? "" : "s"} resolved in ${(res.stats.ms / 1000).toFixed(1)} s` : ""}</>}
        right="counterparty grouping is heuristic · not proof of ownership"
      />
    </div>
  );
}

export default function TracePage() {
  return (
    <Suspense>
      <TraceInner />
    </Suspense>
  );
}
