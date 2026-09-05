"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TraceResult, TraceNode, TraceEdge } from "@/lib/trace/engine";

/*
 * Value-proportional view of a trace: each hop is a column, each wallet a bar whose
 * height is the value that moved through it along traced edges, each edge a band
 * whose thickness is the value on that edge. Bars in later columns are ordered by
 * the weighted centre of their sources so bands cross as little as possible.
 */

const short = (a: string, compact = false) => (compact ? `${a.slice(0, 6)}…${a.slice(-4)}` : a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
const fmtV = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: v < 1 ? 5 : 2 });

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

type Bar = { n: TraceNode; x: number; y: number; h: number; v: number };
type Band = { e: TraceEdge; a: Bar; b: Bar; y0: number; y1: number; t: number; f: number };

/*
 * Value attributable to the seed at each wallet. The seed carries the sum of its traced
 * edges; a wallet further out carries what reached it along traced edges from the previous
 * hop. When a wallet forwards more than it received on the traced path, its outgoing edges
 * are scaled pro rata so the picture conserves value instead of inflating it.
 */
function attribute(res: TraceResult) {
  const hop = new Map(res.nodes.map((n) => [n.address, n.hop]));
  const near = (e: TraceEdge) => ((hop.get(e.from) ?? 0) <= (hop.get(e.to) ?? 0) ? e.from : e.to);
  const far = (e: TraceEdge) => (near(e) === e.from ? e.to : e.from);
  const edges = res.edges.filter((e) => hop.has(e.from) && hop.has(e.to));
  const outSum = new Map<string, number>();
  for (const e of edges) outSum.set(near(e), (outSum.get(near(e)) ?? 0) + e.value);
  const value = new Map<string, number>();
  const flow = new Map<TraceEdge, number>();
  const maxHop = Math.max(0, ...hop.values());
  for (const n of res.nodes) if (n.hop === 0) value.set(n.address, outSum.get(n.address) ?? 0);
  for (let h = 0; h < maxHop; h++) {
    for (const e of edges) {
      const a = near(e);
      if (hop.get(a) !== h) continue;
      const k = Math.min(1, (value.get(a) ?? 0) / Math.max(outSum.get(a) ?? 0, 1e-12));
      const f = e.value * k;
      flow.set(e, f);
      value.set(far(e), (value.get(far(e)) ?? 0) + f);
    }
  }
  return { value, flow, edges };
}

function layout(res: TraceResult, W: number, H: number) {
  const mirror = res.direction === "in";
  const attr = attribute(res);
  const nodeValue = (n: TraceNode) => attr.value.get(n.address) ?? 0;
  const edgeValue = (e: TraceEdge) => attr.flow.get(e) ?? 0;
  const byHop = new Map<number, TraceNode[]>();
  for (const n of res.nodes) byHop.set(n.hop, [...(byHop.get(n.hop) ?? []), n]);
  const maxHop = Math.max(...byHop.keys());
  const barW = 14;
  const labelW = 236;
  const padTop = 58;
  const padBot = 48;
  const gapY = 10;
  const innerW = W - labelW - 28;
  const colGap = maxHop === 0 ? 0 : (innerW - barW) / maxHop;
  const colX = (hop: number) => (mirror ? W - 14 - barW - hop * colGap : 14 + hop * colGap);

  // scale from the busiest column
  let maxTotal = 1e-9;
  let maxCount = 1;
  for (const list of byHop.values()) {
    maxTotal = Math.max(maxTotal, list.reduce((s, n) => s + nodeValue(n), 0));
    maxCount = Math.max(maxCount, list.length);
  }
  const usable = H - padTop - padBot - gapY * (maxCount - 1);
  const scale = usable / maxTotal;
  const minH = 5;

  const bars = new Map<string, Bar>();
  const order: Bar[][] = [];
  for (let hop = 0; hop <= maxHop; hop++) {
    const list = [...(byHop.get(hop) ?? [])];
    if (hop === 0) list.sort((a, b) => nodeValue(b) - nodeValue(a));
    else {
      // barycentre of the sources already placed
      const centre = (n: TraceNode) => {
        let wsum = 0;
        let vsum = 0;
        for (const e of res.edges) {
          const other = e.from === n.address ? e.to : e.to === n.address ? e.from : null;
          if (!other) continue;
          const src = bars.get(other);
          if (!src || src.n.hop !== hop - 1) continue;
          wsum += (src.y + src.h / 2) * edgeValue(e);
          vsum += edgeValue(e);
        }
        return vsum > 0 ? wsum / vsum : H;
      };
      const c = new Map(list.map((n) => [n.address, centre(n)] as const));
      list.sort((a, b) => c.get(a.address)! - c.get(b.address)! || nodeValue(b) - nodeValue(a));
    }
    const heights = list.map((n) => Math.max(minH, nodeValue(n) * scale));
    const total = heights.reduce((s, h) => s + h, 0) + gapY * (list.length - 1);
    let y = padTop + Math.max(0, (H - padTop - padBot - total) / 2);
    const col: Bar[] = [];
    list.forEach((n, i) => {
      const bar: Bar = { n, x: colX(hop), y, h: heights[i], v: nodeValue(n) };
      bars.set(n.address, bar);
      col.push(bar);
      y += heights[i] + gapY;
    });
    order.push(col);
  }

  // bands: allocate slots down each bar, ordered by the other end's y so bands do not tangle
  const edges = attr.edges.filter((e) => bars.has(e.from) && bars.has(e.to) && edgeValue(e) > 0);
  const leftOf = (e: TraceEdge) => (bars.get(e.from)!.n.hop <= bars.get(e.to)!.n.hop ? bars.get(e.from)! : bars.get(e.to)!);
  const rightOf = (e: TraceEdge) => (bars.get(e.from)!.n.hop <= bars.get(e.to)!.n.hop ? bars.get(e.to)! : bars.get(e.from)!);
  const outSlots = new Map<string, TraceEdge[]>();
  const inSlots = new Map<string, TraceEdge[]>();
  for (const e of edges) {
    const a = leftOf(e);
    const b = rightOf(e);
    outSlots.set(a.n.address, [...(outSlots.get(a.n.address) ?? []), e]);
    inSlots.set(b.n.address, [...(inSlots.get(b.n.address) ?? []), e]);
  }
  const y0 = new Map<TraceEdge, number>();
  const y1 = new Map<TraceEdge, number>();
  for (const [addr, list] of outSlots) {
    const bar = bars.get(addr)!;
    list.sort((p, q) => rightOf(p).y - rightOf(q).y);
    const sum = list.reduce((s, e) => s + edgeValue(e), 0);
    const k = Math.min(scale, bar.h / Math.max(sum, 1e-9));
    let off = 0;
    for (const e of list) {
      y0.set(e, bar.y + off);
      off += edgeValue(e) * k;
    }
  }
  for (const [addr, list] of inSlots) {
    const bar = bars.get(addr)!;
    list.sort((p, q) => leftOf(p).y - leftOf(q).y);
    const sum = list.reduce((s, e) => s + edgeValue(e), 0);
    const k = Math.min(scale, bar.h / Math.max(sum, 1e-9));
    let off = 0;
    for (const e of list) {
      y1.set(e, bar.y + off);
      off += edgeValue(e) * k;
    }
  }
  const bands: Band[] = edges.map((e) => ({ e, a: leftOf(e), b: rightOf(e), y0: y0.get(e)!, y1: y1.get(e)!, t: Math.max(1.2, edgeValue(e) * scale), f: edgeValue(e) }));
  bands.sort((p, q) => q.t - p.t);

  const totals = order.map((col) => col.reduce((s, b) => s + b.v, 0));
  const labelled = new Set<string>();
  for (const col of order) {
    let bottom = -Infinity;
    for (const bar of col) {
      const cy = bar.y + bar.h / 2;
      if (cy - 13 >= bottom) {
        labelled.add(bar.n.address);
        bottom = cy + 14;
      }
    }
  }
  return { bars, bands, order, totals, barW, mirror, colX, maxHop, labelW, labelled, compact: colGap > 0 && colGap < 230 };
}

function bandPath(b: Band, barW: number, mirror: boolean) {
  const xa = mirror ? b.a.x : b.a.x + barW;
  const xb = mirror ? b.b.x + barW : b.b.x;
  const ta = Math.min(b.t, b.a.h);
  const tb = Math.min(b.t, b.b.h);
  const m = (xa + xb) / 2;
  return `M ${xa} ${b.y0} C ${m} ${b.y0}, ${m} ${b.y1}, ${xb} ${b.y1} L ${xb} ${b.y1 + tb} C ${m} ${b.y1 + tb}, ${m} ${b.y0 + ta}, ${xa} ${b.y0 + ta} Z`;
}

export default function Sankey({ res, selected, onSelect }: { res: TraceResult; selected: string | null; onSelect: (a: string) => void }) {
  const { ref, size } = useSize<HTMLDivElement>();
  const L = useMemo(() => layout(res, size.w, size.h), [res, size]);
  const [hover, setHover] = useState<string | null>(null);
  const focus = hover ?? selected;
  const touches = (b: Band) => focus !== null && (b.a.n.address === focus || b.b.n.address === focus);
  const symbol = res.nodes[0]?.symbol ?? "";
  const seedTotal = L.totals[0] || 1e-9;

  return (
    <div ref={ref} className="absolute inset-0">
      <svg width={size.w} height={size.h} className="block">
        {/* column headers */}
        {L.order.map((col, hop) => {
          const x = L.colX(hop);
          const share = L.totals[hop] / seedTotal;
          const anchor = L.mirror ? "end" : "start";
          const tx = L.mirror ? x + L.barW : x;
          return (
            <g key={"h" + hop}>
              <text x={tx} y={22} textAnchor={anchor} fontSize="10" fill="#9fb0c1" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
                {hop === 0 ? "seed" : `hop ${hop}`} · {col.length}
              </text>
              <text x={tx} y={37} textAnchor={anchor} fontSize="10.5" fill={hop === 0 ? "#e8b23a" : "#7a8ea3"} style={{ fontFamily: "var(--font-mono)" }}>
                {fmtV(L.totals[hop])} {symbol}{hop > 0 ? ` · ${share < 0.005 ? "<1" : (share * 100).toFixed(0)}%` : ""}
              </text>
            </g>
          );
        })}
        {/* bands */}
        {L.bands.map((b, i) => {
          const hi = touches(b);
          const dim = focus !== null && !hi;
          const fill = hi ? "#e8b23a" : b.b.n.sanctioned ? "#e5484d" : b.b.n.entity ? "#46a5bf" : "#9fb0c1";
          return (
            <path
              key={i}
              d={bandPath(b, L.barW, L.mirror)}
              fill={fill}
              fillOpacity={dim ? 0.08 : hi ? 0.6 : 0.34}
              stroke={fill}
              strokeOpacity={dim ? 0.1 : hi ? 0.9 : 0.35}
              strokeWidth={0.6}
              style={{ transition: "fill-opacity .15s" }}
              onMouseEnter={() => setHover(b.b.n.address)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${short(b.e.from)} → ${short(b.e.to)} · ${fmtV(b.f)} ${symbol} attributable${b.f < b.e.value * 0.999 ? ` of ${fmtV(b.e.value)} on the edge` : ""} · ${b.e.count} transfer${b.e.count === 1 ? "" : "s"}`}</title>
            </path>
          );
        })}
        <text x={14} y={size.h - 12} fontSize="10" fill="#5c6e82" style={{ fontFamily: "var(--font-mono)" }}>
          value attributable to the seed along traced edges · forwarders scaled pro rata · % = share reaching that hop
        </text>
        {/* bars + labels */}
        {[...L.bars.values()].map((bar) => {
          const n = bar.n;
          const isSeed = n.hop === 0;
          const stroke = n.sanctioned ? "#e5484d" : n.entity ? "#46a5bf" : isSeed ? "#e8b23a" : "#9fb0c1";
          const isSel = selected === n.address;
          const dim = focus !== null && !isSel && focus !== n.address && !L.bands.some((b) => touches(b) && (b.a === bar || b.b === bar));
          const lastCol = n.hop === L.maxHop;
          const labelRight = !L.mirror;
          const lx = labelRight ? bar.x + L.barW + 8 : bar.x - 8;
          const showLabel = L.labelled.has(n.address) || isSel;
          const cy = bar.y + bar.h / 2;
          return (
            <g key={n.address} onClick={() => onSelect(n.address)} onMouseEnter={() => setHover(n.address)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer", opacity: dim ? 0.45 : 1, transition: "opacity .15s" }}>
              <rect x={bar.x} y={bar.y} width={L.barW} height={bar.h} fill={n.sanctioned ? "#3a1416" : n.entity ? "#0f2a30" : isSeed ? "#3a2c10" : "#1b2431"} stroke={stroke} strokeWidth={isSel ? 2 : 1.2}>
                <title>{`${n.address} · ${fmtV(bar.v)} ${n.symbol} attributable to the seed${n.entity ? ` · ${n.entity.entity}` : n.sanctioned ? " · OFAC SDN" : ""}`}</title>
              </rect>
              {showLabel && (
                <>
                  <text x={lx} y={cy - 2} textAnchor={labelRight ? "start" : "end"} fontSize="11.5" fill="#e3ebf2" stroke="#0b1119" strokeWidth={3} paintOrder="stroke" style={{ fontFamily: "var(--font-mono)" }}>
                    {short(n.address, L.compact && !lastCol)}
                  </text>
                  <text x={lx} y={cy + 11} textAnchor={labelRight ? "start" : "end"} fontSize="10" fill={n.entity ? "#46a5bf" : n.sanctioned ? "#e5484d" : "#7a8ea3"} stroke="#0b1119" strokeWidth={3} paintOrder="stroke" style={{ fontFamily: "var(--font-mono)" }}>
                    {n.entity ? (L.compact && !lastCol ? n.entity.entity : `${n.entity.entity} · ${n.entity.type}`) : n.sanctioned ? "OFAC SDN" : `${fmtV(bar.v)} ${n.symbol}${!n.expanded && !lastCol && !L.compact ? " · not expanded" : ""}`}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
