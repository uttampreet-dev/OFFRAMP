"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SyndicateReport, Syndicate } from "@/lib/syndicates";
import { TopBar, Chip, StatusBar } from "@/components/console";

const short = (a: string) => (a.length > 18 ? `${a.slice(0, 7)}…${a.slice(-5)}` : a);
const inr = (v: number) => "₹" + v.toLocaleString("en-IN");
const lakh = (v: number) => `₹${(v / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} L`;
const PALETTE = ["#e8b23a", "#46a5bf", "#e5484d", "#3dd68c", "#c084fc", "#f97316", "#a3e635"];

/* Bipartite constellation: complaints (small) orbit their cash-out wallet (large); cities sit on the left rail. */
function Graph({ rep, sel, onSelect }: { rep: SyndicateReport; sel: string | null; onSelect: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(400, e.contentRect.width), h: Math.max(300, e.contentRect.height) }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const layout = useMemo(() => {
    const pos = new Map<string, { x: number; y: number; r: number; color: string; label: string; kind: string; group: string | null }>();
    const syn = rep.syndicates;
    const cols = Math.max(1, Math.min(syn.length, 4));
    const rows = Math.ceil(syn.length / cols);
    const cellW = (size.w - 140) / cols;
    const cellH = size.h / rows;
    syn.forEach((s, i) => {
      const cx = 140 + (i % cols) * cellW + cellW / 2;
      const cy = Math.floor(i / cols) * cellH + cellH / 2;
      const color = PALETTE[i % PALETTE.length];
      const wallets = s.wallets;
      wallets.forEach((w, wi) => {
        const ang = (wi / wallets.length) * Math.PI * 2;
        const rad = wallets.length > 1 ? Math.min(cellW, cellH) * 0.16 : 0;
        pos.set(`w:${w.address}`, { x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad, r: 9 + Math.min(10, w.complaints * 1.6), color, label: short(w.address), kind: "wallet", group: s.id });
      });
      s.complaints.forEach((c, ci) => {
        const ang = (ci / s.complaints.length) * Math.PI * 2 - Math.PI / 2;
        const rad = Math.min(cellW, cellH) * 0.36;
        pos.set(`c:${c.id}`, { x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad, r: 3.5 + Math.min(4, c.amountInr / 400000), color, label: c.id, kind: "complaint", group: s.id });
      });
    });
    const cities = rep.graph.nodes.filter((n) => n.kind === "city");
    cities.forEach((c, i) => pos.set(c.id, { x: 60, y: (size.h / (cities.length + 1)) * (i + 1), r: 6, color: "#8598aa", label: c.label, kind: "city", group: null }));
    return pos;
  }, [rep, size]);
  return (
    <div ref={ref} className="w-full h-full">
      <svg width={size.w} height={size.h}>
        {rep.graph.edges.map((e, i) => {
          const a = layout.get(e.from);
          const b = layout.get(e.to);
          if (!a || !b) return null;
          const active = sel === null || a.group === sel || b.group === sel;
          const city = a.kind === "city";
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={city ? "#1b2431" : b.color} strokeOpacity={active ? (city ? 0.6 : 0.5) : 0.08} strokeWidth={city ? 1 : 1.2} />;
        })}
        {[...layout.entries()].map(([id, p]) => {
          const active = sel === null || p.group === sel || p.kind === "city";
          return (
            <g key={id} opacity={active ? 1 : 0.18} onClick={() => p.group && onSelect(p.group)} className={p.group ? "cursor-pointer" : ""}>
              {p.kind === "wallet" && <circle cx={p.x} cy={p.y} r={p.r + 6} fill={p.color} fillOpacity={0.12} />}
              <circle cx={p.x} cy={p.y} r={p.r} fill={p.kind === "complaint" ? "#0c121a" : p.color} stroke={p.color} strokeWidth={p.kind === "complaint" ? 1.5 : 0} />
              {p.kind !== "complaint" && (
                <text x={p.x} y={p.y + p.r + 14} textAnchor="middle" fontSize={p.kind === "city" ? 11 : 10.5} fill={p.kind === "city" ? "#8598aa" : "#e9eff5"} fontFamily="ui-monospace, Menlo, monospace">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
        {rep.syndicates.map((s, i) => {
          const w = layout.get(`w:${s.wallets[0].address}`);
          if (!w) return null;
          return (
            <text key={s.id} x={w.x} y={w.y - 34 - Math.min(10, s.wallets[0].complaints * 1.6)} textAnchor="middle" fontSize={11} fontWeight={700} fill={PALETTE[i % PALETTE.length]} fontFamily="ui-monospace, Menlo, monospace" opacity={sel === null || sel === s.id ? 1 : 0.2}>
              {s.id} · {s.complaints.length} complaints · {lakh(s.amountInr)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function SyndicatesPage() {
  const [rep, setRep] = useState<SyndicateReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/syndicates")
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error ?? "failed");
        setRep(b as SyndicateReport);
        setSel((b as SyndicateReport).syndicates[0]?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "failed"));
  }, []);
  const s: Syndicate | undefined = rep?.syndicates.find((x) => x.id === sel);
  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Syndicates" subtitle="complaints that share a cash-out wallet · operator groups" secondRow={<span className="c-note">a syndicate is the set of complaints whose money reached the same cash-out wallet, joined transitively · the complaints dataset is synthetic and every number here is a property of that dataset</span>}>
        <div className="flex-1 flex items-center gap-3">
          {rep && (
            <>
              <Chip tone="mut">synthetic complaints · {rep.complaints}</Chip>
              <Chip tone="amber">{rep.syndicates.length} syndicates</Chip>
              <Chip tone="mut">{rep.singletons.length} unlinked</Chip>
              <span className="c-note">{lakh(rep.syndicates.reduce((a, x) => a + x.amountInr, 0))} across linked complaints</span>
            </>
          )}
        </div>
      </TopBar>
      {error && <div className="mx-8 mt-6 border border-[#652225] bg-[#1a0c0e] text-red px-4 py-3 text-[13px] max-w-xl">{error}</div>}
      {rep && (
        <div className="flex-1 min-h-0 grid grid-cols-[300px_1fr_420px] overflow-hidden">
          <div className="border-r border-line overflow-y-auto">
            <div className="px-5 py-4 border-b border-line"><span className="c-label">Syndicates · by loss</span></div>
            {rep.syndicates.map((x, i) => (
              <button key={x.id} onClick={() => setSel(x.id)} className={`w-full text-left px-5 py-3.5 border-b border-line2 hover:bg-panel ${sel === x.id ? "bg-panel" : ""}`} style={sel === x.id ? { boxShadow: `inset 2px 0 0 ${PALETTE[i % PALETTE.length]}` } : undefined}>
                <div className="flex items-center justify-between"><span className="mono text-[13px] font-bold" style={{ color: PALETTE[i % PALETTE.length] }}>{x.id}</span><span className="mono text-[12px]">{lakh(x.amountInr)}</span></div>
                <div className="c-note mt-0.5">{x.complaints.length} complaints · {x.wallets.length} cash-out wallet{x.wallets.length > 1 ? "s" : ""} · {Object.keys(x.cities).length} cities</div>
                <div className="mono text-[10.5px] text-faint mt-0.5">{x.firstDate} → {x.lastDate} · {x.tempoPerWeek}/week</div>
              </button>
            ))}
            <div className="px-5 py-3 c-note">{rep.singletons.length} complaints share no cash-out wallet with any other and stay unlinked.</div>
          </div>
          <div className="min-h-0 relative">
            <div className="absolute top-3 left-4 z-10 flex gap-2"><span className="c-label">Complaints ↔ cash-out wallets</span><span className="c-note">click a group · cities on the left</span></div>
            <Graph rep={rep} sel={sel} onSelect={setSel} />
          </div>
          <aside className="border-l border-line bg-rail overflow-y-auto">
            {s ? (
              <>
                <div className="px-6 py-5 border-b border-line">
                  <div className="flex items-center gap-2"><span className="mono text-[20px] font-extrabold">{s.id}</span><Chip tone="mut">synthetic</Chip></div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4">
                    <div><div className="c-kv">Loss</div><div className="mono text-[15px] font-bold mt-0.5">{inr(s.amountInr)}</div></div>
                    <div><div className="c-kv">Complaints</div><div className="mono text-[15px] font-bold mt-0.5">{s.complaints.length}</div></div>
                    <div><div className="c-kv">Active</div><div className="mono text-[12.5px] mt-0.5">{s.firstDate} → {s.lastDate} · {s.spanDays} d</div></div>
                    <div><div className="c-kv">Tempo</div><div className="mono text-[12.5px] mt-0.5">{s.tempoPerWeek} complaints / week</div></div>
                    <div><div className="c-kv">Cities</div><div className="mono text-[12px] mt-0.5">{Object.entries(s.cities).map(([c, n]) => `${c} ${n}`).join(" · ")}</div></div>
                    <div><div className="c-kv">Rails</div><div className="mono text-[12px] mt-0.5">{Object.entries(s.rails).map(([c, n]) => `${c} ${n}`).join(" · ")}</div></div>
                  </div>
                </div>
                <div className="px-6 py-4 border-b border-line">
                  <div className="c-label mb-2">Cash-out wallets</div>
                  {s.wallets.map((w) => (
                    <div key={w.address} className="py-2.5 border-b border-line2 last:border-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="mono text-[12.5px]">{short(w.address)}</span>
                        <Chip tone="amber">{w.complaints} complaints · {lakh(w.amountInr)}</Chip>
                        {w.sanctioned && <Chip tone="red">OFAC SDN</Chip>}
                        {w.entity && <Chip tone="teal">{w.entity}</Chip>}
                        {w.reported && <Chip tone="red">community report</Chip>}
                        {w.cases.map((c) => (
                          <Link key={c} href={`/cases?id=${c}`} className="mono text-[10px] text-amber underline underline-offset-2">{c}</Link>
                        ))}
                      </div>
                      <div className="mt-1.5 flex gap-3">
                        <Link href={`/trace?address=${w.address}`} className="mono text-[10.5px] text-amber underline underline-offset-2">trace →</Link>
                        <Link href={`/live-board?watch=${w.address}`} className="mono text-[10.5px] text-mut underline underline-offset-2 hover:text-ink">watch →</Link>
                        <Link href={`/cases?address=${w.address}`} className="mono text-[10.5px] text-mut underline underline-offset-2 hover:text-ink">open case →</Link>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-4">
                  <div className="c-label mb-2">Complaints in this syndicate</div>
                  {s.complaints.map((c) => (
                    <div key={c.id} className="py-2.5 border-b border-line2 last:border-0">
                      <div className="flex items-baseline justify-between"><span className="mono text-[12px] font-bold">{c.id}</span><span className="mono text-[12px]">{inr(c.amountInr)}</span></div>
                      <div className="mono text-[10.5px] text-faint">{c.date} · {c.city} · {c.paidAs} · paid to {short(c.paidTo)}</div>
                      <div className="c-note mt-1 leading-relaxed">{c.notes}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="c-note px-6 py-6">Select a syndicate.</p>
            )}
          </aside>
        </div>
      )}
      <StatusBar left="complaints, victims, wallets and amounts are synthetic · grouping is by shared cash-out wallet, a strong but not conclusive link" right={rep ? `${rep.graph.nodes.length} nodes · ${rep.graph.edges.length} edges` : ""} />
    </div>
  );
}
