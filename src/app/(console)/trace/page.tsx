"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { TraceResult, TraceNode, TraceEdge } from "@/lib/trace/engine";
import type { LookupResult } from "@/lib/chains/types";

type Lookup = LookupResult & { screening: { ofacSanctioned: boolean; listSize: number; listSyncedAt: string | null } };

const short = (a: string) => (a.length > 16 ? `${a.slice(0, 7)}…${a.slice(-5)}` : a);
const fmtV = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: v < 1 ? 5 : 2 });
const fmtT = (t: number | null) =>
  t ? new Date(t).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";

/* ───────────── layout: nodes in hop columns, ordered by value ───────────── */
function layout(res: TraceResult, W: number, H: number) {
  const byHop = new Map<number, TraceNode[]>();
  for (const n of res.nodes) byHop.set(n.hop, [...(byHop.get(n.hop) ?? []), n]);
  const maxHop = Math.max(...byHop.keys());
  const pos = new Map<string, { x: number; y: number }>();
  const padX = 90;
  const colGap = maxHop === 0 ? 0 : (W - padX * 2) / maxHop;
  for (const [hop, list] of byHop) {
    list.sort((a, b) => b.inValue + b.outValue - (a.inValue + a.outValue));
    const gap = H / (list.length + 1);
    list.forEach((n, i) => pos.set(n.address, { x: padX + hop * colGap, y: gap * (i + 1) }));
  }
  const maxEdge = Math.max(1e-9, ...res.edges.map((e) => e.value));
  return { pos, maxHop, maxEdge };
}

function Flow({ res, selected, onSelect }: { res: TraceResult; selected: string | null; onSelect: (a: string) => void }) {
  const W = 1000;
  const H = 560;
  const { pos, maxEdge } = useMemo(() => layout(res, W, H), [res]);
  const byAddr = useMemo(() => new Map(res.nodes.map((n) => [n.address, n])), [res]);
  const sel = selected ? byAddr.get(selected) : null;
  const touches = (e: TraceEdge) => selected !== null && (e.from === selected || e.to === selected);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {/* edges */}
      {res.edges.map((e, i) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return null;
        const w = 1 + 3.2 * (Math.log10(1 + e.value) / Math.log10(1 + maxEdge));
        const hi = touches(e);
        const dim = selected !== null && !hi;
        const mx = (a.x + b.x) / 2;
        return (
          <path
            key={i}
            d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
            fill="none"
            stroke={hi ? "#e8b23a" : "#6b7f94"}
            strokeOpacity={dim ? 0.3 : hi ? 0.95 : 0.6}
            strokeWidth={w}
          />
        );
      })}
      {/* edge value labels for the largest few / selected */}
      {res.edges
        .filter((e) => touches(e) || e.value >= maxEdge * 0.35)
        .slice(0, 14)
        .map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          return (
            <text key={"l" + i} x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 5} textAnchor="middle" fontSize="9" fill={touches(e) ? "#e8b23a" : "#8598aa"} style={{ fontFamily: "var(--font-mono)" }}>
              {fmtV(e.value)}
            </text>
          );
        })}
      {/* nodes */}
      {res.nodes.map((n) => {
        const p = pos.get(n.address)!;
        const isSeed = n.hop === 0;
        const r = isSeed ? 10 : n.entity ? 8 : 6;
        const stroke = n.sanctioned ? "#e5484d" : n.entity ? "#46a5bf" : isSeed ? "#e8b23a" : "#8598aa";
        const isSel = selected === n.address;
        const dim = selected !== null && !isSel && !res.edges.some((e) => (e.from === selected && e.to === n.address) || (e.to === selected && e.from === n.address));
        const labelRight = p.x < W - 150;
        return (
          <g key={n.address} onClick={() => onSelect(n.address)} style={{ cursor: "pointer", opacity: dim ? 0.55 : 1, transition: "opacity .2s" }}>
            {(n.sanctioned || isSel) && <circle cx={p.x} cy={p.y} r={r + 6} fill="none" stroke={isSel ? "#e8b23a" : "#e5484d"} strokeOpacity="0.45" strokeWidth="1" />}
            <circle cx={p.x} cy={p.y} r={r} fill={n.sanctioned ? "#12080a" : n.entity ? "#0a1a1f" : "#0b1119"} stroke={stroke} strokeWidth={isSel ? 2.2 : 1.6} />
            <text x={labelRight ? p.x + r + 7 : p.x - r - 7} y={p.y - 2} textAnchor={labelRight ? "start" : "end"} fontSize="10" fill="#dbe4ec" style={{ fontFamily: "var(--font-mono)" }}>
              {short(n.address)}
            </text>
            <text x={labelRight ? p.x + r + 7 : p.x - r - 7} y={p.y + 10} textAnchor={labelRight ? "start" : "end"} fontSize="8.5" fill={n.entity ? "#46a5bf" : n.sanctioned ? "#e5484d" : "#6b7f94"} style={{ fontFamily: "var(--font-mono)" }}>
              {n.entity ? `${n.entity.entity} · ${n.entity.type}` : n.sanctioned ? "OFAC SDN" : n.expanded ? `${fmtV(n.inValue || n.outValue)} ${n.symbol}` : "not expanded"}
            </text>
          </g>
        );
      })}
      {sel && null}
    </svg>
  );
}

/* ───────────── page ───────────── */
function TraceInner() {
  const params = useSearchParams();
  const [address, setAddress] = useState("");
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
        if (!t.ok) throw new Error(t.body.error ?? `HTTP error`);
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
      setAddress(a);
      run(a);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selNode = res && selected ? res.nodes.find((n) => n.address === selected) ?? null : null;
  const selEdges = res && selected ? res.edges.filter((e) => e.from === selected || e.to === selected).sort((a, b) => b.value - a.value) : [];
  const s = seedInfo?.summary;
  const sanctionedBeyond = res ? res.nodes.filter((n) => n.sanctioned && n.hop > 0).length : 0;
  const entities = res ? res.nodes.filter((n) => n.entity) : [];

  return (
    <div className="flex flex-col h-screen">
      {/* top bar */}
      <div className="h-[58px] shrink-0 border-b border-line bg-rail flex items-center px-5 gap-3">
        <div className="shrink-0">
          <div className="text-[13.5px] font-bold">Trace</div>
          <div className="mono text-[10px] text-[#657a8e]">BTC · ETH · TRON — auto-detected</div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="flex-1 flex items-center gap-2 min-w-0"
        >
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Paste a wallet address…"
            spellCheck={false}
            className="mono flex-1 min-w-0 bg-panel border border-line px-3 py-1.5 text-[12px] placeholder:text-faint outline-none focus:border-[#3a4e63]"
          />
          <Seg label="dir" value={dir} options={[["out", "where it went"], ["in", "where it came from"]]} onChange={(v) => setDir(v as "out" | "in")} />
          <Seg label="depth" value={String(depth)} options={[["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]]} onChange={(v) => setDepth(Number(v))} />
          <Seg label="fan-out" value={String(fanout)} options={[["3", "3"], ["5", "5"], ["8", "8"]]} onChange={(v) => setFanout(Number(v))} />
          <button className="mono text-[10px] tracking-[0.12em] uppercase font-extrabold bg-amber text-[#12100c] px-4 py-2 hover:brightness-110 disabled:opacity-50" disabled={loading}>
            {loading ? "tracing…" : "trace"}
          </button>
        </form>
      </div>

      {error && <div className="mx-5 mt-4 border border-[#652225] bg-[#1a0c0e] text-red px-4 py-3 text-[12px] max-w-xl">{error}</div>}

      {!res && !error && !loading && (
        <div className="p-6 text-mut text-[12px] max-w-md leading-relaxed">
          Paste an address and trace where the money went. Each hop follows the largest counterparties; the trail stops at a known
          exchange or mixer. Everything shown comes from live public chain data.
        </div>
      )}

      {loading && !res && (
        <div className="p-6 mono text-[11px] text-faint">querying chain — {depth} hop{depth > 1 ? "s" : ""}, up to {fanout} counterparties each…</div>
      )}

      {res && (
        <div className="flex-1 min-h-0 grid grid-cols-[300px_1fr_320px]">
          {/* summary */}
          <aside className="border-r border-line overflow-y-auto">
            <Section title="Address summary" tag={seedInfo?.fromCache ? "cached" : "live"} tagTone="green">
              <div className="mono text-[11px] break-all text-ink/90">{res.seed}</div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                <KV k="Chain" v={res.chain.toUpperCase()} />
                <KV k="Transfers seen" v={s ? String(s.txCount) : "—"} />
                <KV k={`Received`} v={s ? `${fmtV(s.receivedTotal)} ${s.symbol}` : "—"} />
                <KV k={`Sent`} v={s ? `${fmtV(s.sentTotal)} ${s.symbol}` : "—"} />
                <KV k="First seen" v={fmtT(s?.firstSeen ?? null)} />
                <KV k="Last seen" v={fmtT(s?.lastSeen ?? null)} />
              </div>
            </Section>
            <Section title="Screening">
              <Flag on={!!seedInfo?.screening.ofacSanctioned} onText="OFAC SDN — sanctioned" offText="Not on OFAC SDN" tone="red" />
              <Flag on={sanctionedBeyond > 0} onText={`${sanctionedBeyond} sanctioned wallet${sanctionedBeyond === 1 ? "" : "s"} within ${res.depth} hop${res.depth > 1 ? "s" : ""}`} offText="No sanctioned wallets in the traced neighbourhood" tone="red" />
              <Flag on={entities.length > 0} onText={entities.map((n) => `${n.entity!.entity} reached at hop ${n.hop} · ${fmtV(n.inValue)} ${n.symbol}`).join(" · ")} offText="No known exchange or mixer reached" tone="teal" />
              <div className="mono text-[8.5px] text-faint mt-2">{seedInfo?.screening.listSize.toLocaleString()} SDN addresses · attribution only where publicly documented</div>
            </Section>
            <Section title="This trace">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <KV k="Hops reached" v={String(res.stats.hopsReached)} />
                <KV k="Nodes / edges" v={`${res.nodes.length} / ${res.edges.length}`} />
                <KV k="Chain requests" v={`${res.stats.requests} (${res.stats.fromCache} cached)`} />
                <KV k="Time" v={`${(res.stats.ms / 1000).toFixed(1)} s`} />
              </div>
              <div className="mono text-[8.5px] text-faint mt-3 leading-relaxed">
                Follows the {res.fanout} largest counterparties per hop, {res.direction === "out" ? "downstream" : "upstream"}. Stops at known entities. Heuristic — an investigative lead, not proof.
              </div>
            </Section>
          </aside>

          {/* flow */}
          <div className="relative min-w-0 chain-grid">
            <div className="absolute top-3 left-4 hlabel text-[8.5px] z-10">Flow · {res.direction === "out" ? "downstream" : "upstream"} · hop 0 → {res.stats.hopsReached}</div>
            <div className="absolute top-3 right-4 mono text-[8.5px] text-faint z-10">click a node · edge width ∝ value</div>
            <div className="absolute inset-0 pt-8 pb-2 px-2">
              <Flow res={res} selected={selected} onSelect={setSelected} />
            </div>
          </div>

          {/* selected node */}
          <aside className="border-l border-line overflow-y-auto">
            {selNode ? (
              <>
                <Section title={selNode.hop === 0 ? "Seed wallet" : `Hop ${selNode.hop}`} tag={selNode.sanctioned ? "OFAC SDN" : selNode.entity ? selNode.entity.entity : undefined} tagTone={selNode.sanctioned ? "red" : "teal"}>
                  <div className="mono text-[11px] break-all text-ink/90">{selNode.address}</div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                    <KV k="In (traced)" v={`${fmtV(selNode.inValue)} ${selNode.symbol}`} />
                    <KV k="Out (traced)" v={`${fmtV(selNode.outValue)} ${selNode.symbol}`} />
                    <KV k="Transfers seen" v={selNode.txCount === null ? "not expanded" : String(selNode.txCount)} />
                    <KV k="Expanded" v={selNode.expanded ? "yes" : "no"} />
                  </div>
                  {selNode.entity && (
                    <a href={selNode.entity.source} target="_blank" rel="noreferrer" className="mono text-[9px] text-teal underline underline-offset-2 mt-2 inline-block">
                      attribution source ↗
                    </a>
                  )}
                  {selNode.hop > 0 && !selNode.entity && (
                    <button
                      onClick={() => {
                        setAddress(selNode.address);
                        run(selNode.address);
                      }}
                      className="mono mt-3 text-[9px] tracking-[0.12em] uppercase font-extrabold text-amber border border-amber/50 px-2.5 py-1 hover:bg-amber hover:text-[#12100c]"
                    >
                      Trace from here →
                    </button>
                  )}
                </Section>
                <Section title={`Edges · ${selEdges.length}`}>
                  {selEdges.map((e, i) => {
                    const outgoing = e.from === selected;
                    const other = outgoing ? e.to : e.from;
                    return (
                      <button key={i} onClick={() => setSelected(other)} className="w-full text-left border-b border-line2 py-2 hover:bg-panel/60 px-1 -mx-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`mono text-[8px] px-1.5 py-0.5 rounded-sm font-bold ${outgoing ? "bg-[#17130a] text-amber" : "bg-[#08170f] text-green"}`}>{outgoing ? "OUT" : "IN"}</span>
                          <span className="mono text-[10.5px] text-ink/85 flex-1 truncate">{short(other)}</span>
                          <span className="mono text-[10.5px] font-bold shrink-0">{fmtV(e.value)}</span>
                        </div>
                        <div className="mono text-[8.5px] text-faint mt-0.5">
                          {e.count} transfer{e.count === 1 ? "" : "s"} · {fmtT(e.firstTime)}{e.lastTime && e.lastTime !== e.firstTime ? ` → ${fmtT(e.lastTime)}` : ""}
                        </div>
                      </button>
                    );
                  })}
                </Section>
              </>
            ) : (
              <div className="p-4 text-[11px] text-faint">Select a node in the flow.</div>
            )}
          </aside>
        </div>
      )}

      <div className="h-[32px] shrink-0 border-t border-line bg-rail flex items-center px-5 gap-5 mono text-[9.5px] text-faint">
        <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-green mr-1.5" />live public chain data</span>
        {res && <span>{res.stats.hopsReached} hop{res.stats.hopsReached === 1 ? "" : "s"} resolved in {(res.stats.ms / 1000).toFixed(1)} s</span>}
        <span className="ml-auto">counterparty grouping is heuristic · not proof of ownership</span>
      </div>
    </div>
  );
}

function Seg({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <span className="mono text-[8px] tracking-[0.12em] uppercase text-faint">{label}</span>
      {options.map(([v, t]) => (
        <button
          type="button"
          key={v}
          onClick={() => onChange(v)}
          className={`mono text-[9px] px-2 py-1 border ${value === v ? "border-amber/70 text-amber bg-[#17130a]" : "border-line text-mut hover:text-ink"}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
function Section({ title, tag, tagTone, children }: { title: string; tag?: string; tagTone?: "green" | "red" | "teal"; children: React.ReactNode }) {
  const tone = tagTone === "red" ? "bg-[#1a0c0e] text-red" : tagTone === "teal" ? "bg-[#0a1a1f] text-teal" : "bg-[#08170f] text-green";
  return (
    <div className="px-4 py-3 border-b border-line">
      <div className="flex items-center gap-2 mb-2">
        <span className="hlabel text-[8.5px]">{title}</span>
        {tag && <span className={`mono text-[8px] px-1.5 py-0.5 rounded-sm font-bold uppercase ${tone}`}>{tag}</span>}
      </div>
      {children}
    </div>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="hlabel text-[7.5px]">{k}</div>
      <div className="mono text-[11px] mt-0.5 break-words">{v}</div>
    </div>
  );
}
function Flag({ on, onText, offText, tone }: { on: boolean; onText: string; offText: string; tone: "red" | "teal" }) {
  const c = !on ? "text-faint" : tone === "red" ? "text-red" : "text-teal";
  return (
    <div className={`flex items-start gap-2 text-[10.5px] leading-snug py-1 ${c}`}>
      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${!on ? "bg-[#26313f]" : tone === "red" ? "bg-red" : "bg-teal"}`} />
      <span>{on ? onText : offText}</span>
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
