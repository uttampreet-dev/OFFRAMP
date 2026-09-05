"use client";
import { useEffect, useRef } from "react";
import type { Transfer } from "@/lib/chains/types";

export interface GraphInput {
  center: string;
  sanctioned: boolean;
  transfers: Transfer[];
}
export interface HoverInfo {
  addr: string;
  value: number;
  symbol: string;
  dir: "in" | "out" | "self" | "center";
}

/* publicly documented attributions only — kept deliberately tiny */
const KNOWN: Record<string, string> = {
  "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s": "Binance · public attribution",
};
const shortA = (a: string) => `${a.slice(0, 7)}…${a.slice(-4)}`;
const fmtNum = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: v < 1 ? 4 : 2 });

interface Node {
  labeled: boolean;
  bx: number;
  by: number;
  x: number;
  y: number;
  r: number;
  addr: string;
  value: number;
  symbol: string;
  dir: "in" | "out" | "self" | "center";
  phase: number;
}
interface Pulse {
  edge: number;
  t: number;
  dir: 1 | -1;
}

/* layout · "seam": the landing composition (cloud sits left of the seam, route continues into the ledger) · "centered": a symmetrical circular cloud filling its box */
export default function NetGraph({ input, onHover, layout = "seam" }: { input: GraphInput | null; onHover: (h: HoverInfo | null) => void; layout?: "seam" | "centered" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<HoverInfo | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx0 = canvas.getContext("2d");
    if (!ctx0) return;
    const ctx: CanvasRenderingContext2D = ctx0;

    let W = 0;
    let H = 0;
    let raf = 0;
    let running = true;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const r = canvas.parentElement!.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      build();
    };

    /* decorative background dust — carries no data */
    const dust = Array.from({ length: 36 }, (_, i) => ({
      fx: (i * 0.618033) % 1,
      fy: ((i * 0.381966) % 1) * 0.96 + 0.02,
      r: 0.6 + ((i * 7) % 10) / 9,
      tw: (i % 9) / 9,
    }));

    let nodes: Node[] = [];
    let center: Node | null = null;
    let pulses: Pulse[] = [];

    function build() {
      nodes = [];
      pulses = [];
      center = null;
      if (!input) return;
      /* the cloud lives in the band between the headline (left) and the seam (right); taller than wide */
      const centered = layout === "centered";
      const wide = !centered && W >= 1100;
      const seamX = wide ? W - 254 : W;
      const copyEnd = !centered && W > 900 ? W * 0.505 : 0;
      const R = Math.min(W * 0.33, H * 0.3);
      const cx = centered ? W / 2 : wide ? (copyEnd + seamX) / 2 + 6 : W > 900 ? W * 0.66 : W * 0.5;
      const cy = centered ? H * 0.47 : H * 0.46;
      const rx = centered ? R : wide ? (seamX - copyEnd) / 2 + 24 : Math.min(Math.min(W, H) * 0.31 * 1.25, W - cx - 200, cx - 30);
      const ry = centered ? R : wide ? Math.min(H * 0.3, rx * 1.15) : Math.min(W, H) * 0.31 * 0.85;
      /* the headline band: nodes that would land on the copy are lifted above or dropped below it */
      const bandTop = H * 0.28;
      const bandBot = H * 0.7;
      const copyRight = W * 0.5;
      center = { labeled: false, bx: cx, by: cy, x: cx, y: cy, r: wide || centered ? 17 : 15, addr: input.center, value: 0, symbol: "", dir: "center", phase: 0 };
      const seen = new Map<string, { value: number; symbol: string; dir: "in" | "out" | "self" }>();
      for (const t of input.transfers) {
        const other = t.direction === "in" ? t.from : t.to;
        if (!other || other === input.center) continue;
        const prev = seen.get(other);
        if (prev) prev.value += t.value;
        else seen.set(other, { value: t.value, symbol: t.symbol, dir: t.direction });
        if (seen.size >= (wide ? 10 : centered ? 12 : 16)) break;
      }
      const list = [...seen.entries()];
      list.forEach(([addr, m], i) => {
        const a = (i / list.length) * Math.PI * 2 - Math.PI / 2 + (wide ? 0.2 : centered ? 0.26 : 0.35);
        const k = wide || centered ? 0.86 + ((i * 37) % 23) / 160 : 0.72 + ((i * 37) % 23) / 40;
        let bx = cx + Math.cos(a) * rx * k;
        let by = cy + Math.sin(a) * ry * k;
        if (wide && bx < copyRight - 60 && by > bandTop && by < bandBot) {
          by = by < cy ? bandTop - 24 : bandBot + 24;
          bx = Math.max(bx, copyRight - 40);
        }
        nodes.push({
          labeled: false,
          bx,
          by,
          x: 0,
          y: 0,
          r: (wide || centered ? 5.5 : 4.5) + Math.min(8, Math.log10(1 + m.value) * 2.4),
          addr,
          value: m.value,
          symbol: m.symbol,
          dir: m.dir,
          phase: i * 1.7,
        });
      });
      /* label the largest counterparties that sit clear of the headline block, and never on top of each other */
      const placed: Node[] = [];
      nodes
        .filter((n) => centered || n.bx > W * 0.55 || KNOWN[n.addr])
        .filter((n) => !wide || n.bx + 190 < seamX || Math.abs(n.by - cy) > ry * 0.5 || KNOWN[n.addr])
        .filter((n) => !centered || Math.abs(n.bx - cx) > rx * 0.45 || KNOWN[n.addr])
        .sort((a, b) => (KNOWN[b.addr] ? 1 : 0) - (KNOWN[a.addr] ? 1 : 0) || b.value - a.value)
        .forEach((n) => {
          if (placed.length >= (wide ? 3 : 4)) return;
          const clash = placed.some((p) => Math.abs(p.by - n.by) < 60 && Math.abs(p.bx - n.bx) < 260);
          if (clash) return;
          n.labeled = true;
          placed.push(n);
        });
    }

    let lastPulse = 0;
    let cashPulses: number[] = [];
    const mouse = { x: -1e4, y: -1e4 };
    /* the node the suspicious route ends on: the attributed exchange if one is reached, else the largest counterparty */
    const routeNode = () => nodes.find((n) => KNOWN[n.addr]) ?? [...nodes].sort((a, b) => b.value - a.value)[0] ?? null;

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = -1e4;
      mouse.y = -1e4;
    };

    function frame(t: number) {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);

      /* dust */
      for (const d of dust) {
        const a = 0.12 + 0.1 * Math.sin(t * 0.0012 + d.tw * 6.28);
        ctx.fillStyle = `rgba(133,152,170,${a * 0.22})`;
        ctx.beginPath();
        ctx.arc(d.fx * W, d.fy * H, d.r, 0, 6.28);
        ctx.fill();
      }

      if (center && nodes.length) {
        /* drift */
        const dr = still ? 0 : 1;
        center.x = center.bx + Math.sin(t * 0.00045) * 6 * dr;
        center.y = center.by + Math.cos(t * 0.00038) * 5 * dr;
        for (const n of nodes) {
          n.x = n.bx + Math.sin(t * 0.0005 + n.phase) * 9 * dr;
          n.y = n.by + Math.cos(t * 0.00042 + n.phase) * 7 * dr;
        }

        /* hover pick */
        let hov: Node | null = null;
        let hd = 3600;
        for (const n of nodes) {
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const dd = dx * dx + dy * dy;
          if (dd < hd) {
            hd = dd;
            hov = n;
          }
        }
        {
          const dx = center.x - mouse.x;
          const dy = center.y - mouse.y;
          if (dx * dx + dy * dy < 3600) hov = center;
        }
        const hi: HoverInfo | null = hov ? { addr: hov.addr, value: hov.value, symbol: hov.symbol, dir: hov.dir } : null;
        if ((hi?.addr ?? null) !== (hoverRef.current?.addr ?? null)) {
          hoverRef.current = hi;
          onHover(hi);
        }

        /* amber pool + radar sweep around the traced wallet */
        {
          const R = Math.min(W, H) * 0.36;
          const pool = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, R * 0.55);
          pool.addColorStop(0, "rgba(232,178,58,0.07)");
          pool.addColorStop(1, "rgba(232,178,58,0)");
          ctx.fillStyle = pool;
          ctx.beginPath();
          ctx.arc(center.x, center.y, R * 0.55, 0, 6.28);
          ctx.fill();
          if (typeof ctx.createConicGradient === "function") {
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.rotate((t * 0.00038) % 6.283);
            const sweep = ctx.createConicGradient(0, 0, 0);
            sweep.addColorStop(0, "rgba(232,178,58,0.05)");
            sweep.addColorStop(0.1, "rgba(232,178,58,0.01)");
            sweep.addColorStop(0.16, "rgba(232,178,58,0)");
            sweep.addColorStop(1, "rgba(232,178,58,0)");
            ctx.fillStyle = sweep;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, R, 0, 6.28);
            ctx.fill();
            ctx.restore();
          }
        }

        /* edges */
        nodes.forEach((n) => {
          const route = !!KNOWN[n.addr];
          const grad = ctx.createLinearGradient(center!.x, center!.y, n.x, n.y);
          if (route) {
            grad.addColorStop(0, "rgba(229,72,77,0.75)");
            grad.addColorStop(0.5, "rgba(232,178,58,0.8)");
            grad.addColorStop(1, "rgba(70,165,191,0.85)");
          } else {
            grad.addColorStop(0, "rgba(196,160,74,0.42)");
            grad.addColorStop(0.45, "rgba(110,124,140,0.34)");
            grad.addColorStop(1, "rgba(80,98,116,0.2)");
          }
          ctx.strokeStyle = n === hov ? "rgba(232,178,58,0.85)" : grad;
          ctx.lineWidth = n === hov ? 1.5 : route ? 2.2 : 1.1;
          ctx.beginPath();
          ctx.moveTo(center!.x, center!.y);
          const mx = (center!.x + n.x) / 2 + (n.by - center!.by) * 0.12;
          const my = (center!.y + n.y) / 2 - (n.bx - center!.bx) * 0.12;
          ctx.quadraticCurveTo(mx, my, n.x, n.y);
          ctx.stroke();
        });

        /* pulses along edges */
        if (!still && t - lastPulse > 620 && nodes.length) {
          lastPulse = t;
          const routeIdx = nodes.findIndex((n) => KNOWN[n.addr]);
          const edge = routeIdx >= 0 && Math.random() < 0.5 ? routeIdx : Math.floor(Math.random() * nodes.length);
          pulses.push({ edge, t: 0, dir: nodes[edge].dir === "in" ? -1 : 1 });
          if (pulses.length > 14) pulses.shift();
        }
        pulses.forEach((p) => {
          p.t += 0.011;
          const n = nodes[p.edge];
          if (!n) return;
          const k = p.dir === 1 ? p.t : 1 - p.t;
          const mx = (center!.x + n.x) / 2 + (n.by - center!.by) * 0.12;
          const my = (center!.y + n.y) / 2 - (n.bx - center!.bx) * 0.12;
          const om = 1 - k;
          const px = om * om * center!.x + 2 * om * k * mx + k * k * n.x;
          const py = om * om * center!.y + 2 * om * k * my + k * k * n.y;
          const col = n.dir === "in" ? "61,214,140" : "232,178,58";
          ctx.fillStyle = `rgba(${col},${0.95 * (1 - p.t * 0.4)})`;
          ctx.shadowColor = `rgba(${col},1)`;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(px, py, 2.8, 0, 6.28);
          ctx.fill();
          ctx.shadowBlur = 0;
        });
        pulses = pulses.filter((p) => p.t < 1);

        /* nodes */
        for (const n of nodes) {
          const known = !!KNOWN[n.addr];
          ctx.fillStyle = known ? "#0a1a1f" : "#0b1119";
          ctx.strokeStyle = n === hov ? "#e8b23a" : known ? "#46a5bf" : n.dir === "in" ? "rgba(61,214,140,0.8)" : "rgba(120,142,164,0.95)";
          ctx.lineWidth = n === hov || known ? 1.6 : 1.1;
          ctx.beginPath();
          ctx.arc(n.x, n.y, known ? n.r + 2 : n.r, 0, 6.28);
          ctx.fill();
          ctx.stroke();
          if (n.labeled && n !== hov) {
            const seamGuard = layout === "seam" && W >= 1100 ? W - 254 - 190 : W - 190;
            const right = layout === "centered" ? n.x >= center!.x : n.x < seamGuard;
            const lx = right ? n.x + n.r + 8 : n.x - n.r - 8;
            ctx.textAlign = right ? "left" : "right";
            ctx.font = "10px SF Mono, Menlo, monospace";
            ctx.fillStyle = "rgba(190,204,218,0.9)";
            ctx.fillText(shortA(n.addr), lx, n.y - 3);
            ctx.font = "9px SF Mono, Menlo, monospace";
            ctx.fillStyle = "rgba(133,152,170,0.85)";
            ctx.fillText(`${fmtNum(n.value)} ${n.symbol} ${n.dir === "in" ? "in" : "out"}`, lx, n.y + 9);
            if (known) {
              ctx.fillStyle = "rgba(70,165,191,0.95)";
              ctx.fillText(KNOWN[n.addr], lx, n.y + 21);
              ctx.fillStyle = "rgba(232,178,58,0.9)";
              ctx.font = "bold 8px SF Mono, Menlo, monospace";
              ctx.fillText("SUSPICIOUS ROUTE · HOP 1", lx, n.y + 33);
            }
            if (!known && layout === "seam" && W >= 1100 && n === routeNode()) {
              ctx.fillStyle = "rgba(232,178,58,0.9)";
              ctx.font = "bold 8px SF Mono, Menlo, monospace";
              ctx.fillText("LARGEST COUNTERPARTY · ROUTE FOLLOWED", lx, n.y + 21);
            }
          }
        }

        /* the seam and the off-chain continuation — drawn dashed: what follows the exchange is the demonstration case, not this wallet's history */
        if (layout === "seam" && W >= 1100) {
          const seamX = W - 254;
          const rn = routeNode();
          const ty = H * 0.5 - 8;
          // seam line
          const sg = ctx.createLinearGradient(0, H * 0.18, 0, H * 0.82);
          sg.addColorStop(0, "rgba(232,178,58,0)");
          sg.addColorStop(0.5, `rgba(232,178,58,${0.55 + 0.2 * Math.sin(t * 0.0016)})`);
          sg.addColorStop(1, "rgba(232,178,58,0)");
          ctx.strokeStyle = sg;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = "rgba(232,178,58,0.35)";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(seamX, H * 0.18);
          ctx.lineTo(seamX, H * 0.82);
          ctx.stroke();
          ctx.shadowBlur = 0;

          if (rn) {
            // dashed continuation: exchange → seam → ledger row
            ctx.setLineDash([5, 5]);
            ctx.lineDashOffset = -((t * 0.03) % 20);
            const cg = ctx.createLinearGradient(rn.x, rn.y, W - 226, ty);
            cg.addColorStop(0, "rgba(70,165,191,0.7)");
            cg.addColorStop(0.55, "rgba(232,178,58,0.75)");
            cg.addColorStop(1, "rgba(224,212,191,0.8)");
            ctx.strokeStyle = cg;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(rn.x, rn.y);
            ctx.quadraticCurveTo(rn.x + (seamX - rn.x) * 0.35, rn.y + Math.max(70, (ty - rn.y) * 0.6), seamX, ty);
            ctx.lineTo(W - 226, ty);
            ctx.stroke();
            ctx.setLineDash([]);
            // cash pulses along the continuation
            if (!still && Math.random() < 0.012) cashPulses.push(0);
            cashPulses = cashPulses.filter((k) => k < 1);
            for (let i = 0; i < cashPulses.length; i++) {
              cashPulses[i] += 0.006;
              const k = cashPulses[i];
              let px: number;
              let py: number;
              if (k < 0.75) {
                const u = k / 0.75;
                const mx = rn.x + (seamX - rn.x) * 0.35;
                const my = rn.y + Math.max(70, (ty - rn.y) * 0.6);
                const om = 1 - u;
                px = om * om * rn.x + 2 * om * u * mx + u * u * seamX;
                py = om * om * rn.y + 2 * om * u * my + u * u * ty;
              } else {
                const u = (k - 0.75) / 0.25;
                px = seamX + (W - 226 - seamX) * u;
                py = ty;
              }
              const crossed = k >= 0.75;
              ctx.fillStyle = crossed ? "rgba(224,212,191,0.95)" : "rgba(232,178,58,0.95)";
              ctx.shadowColor = crossed ? "rgba(224,212,191,1)" : "rgba(232,178,58,1)";
              ctx.shadowBlur = 12;
              ctx.beginPath();
              ctx.arc(px, py, 2.8, 0, 6.28);
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          }
        }

        /* center node — sanctioned ring */
        const ringR = center.r + 6 + Math.sin(t * 0.003) * 2.5;
        ctx.strokeStyle = input!.sanctioned ? "rgba(229,72,77,0.5)" : "rgba(232,178,58,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(center.x, center.y, ringR, 0, 6.28);
        ctx.stroke();
        ctx.fillStyle = "#12080a";
        ctx.strokeStyle = input!.sanctioned ? "#e5484d" : "#e8b23a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center.x, center.y, center.r, 0, 6.28);
        ctx.fill();
        ctx.stroke();

        /* labels: center + hovered */
        ctx.shadowColor = "rgba(6,9,14,0.95)";
        ctx.shadowBlur = 6;
        ctx.font = "10px SF Mono, Menlo, monospace";
        ctx.fillStyle = input!.sanctioned ? "#e5484d" : "#e8b23a";
        ctx.textAlign = "center";
        ctx.fillText(`${center.addr.slice(0, 7)}…${center.addr.slice(-4)}`, center.x, center.y - center.r - 14);
        if (input!.sanctioned) {
          ctx.fillStyle = "rgba(229,72,77,0.75)";
          ctx.font = "8px SF Mono, Menlo, monospace";
          ctx.fillText("OFAC SDN", center.x, center.y - center.r - 26);
        }
        ctx.shadowBlur = 0;
        if (hov && hov !== center) {
          ctx.textAlign = "center";
          ctx.font = "10px SF Mono, Menlo, monospace";
          ctx.fillStyle = "#e8b23a";
          ctx.fillText(`${shortA(hov.addr)} · ${fmtNum(hov.value)} ${hov.symbol}`, hov.x, hov.y - hov.r - 10);
        }
      }
      raf = requestAnimationFrame(frame);
    }

    const onVis = () => {
      running = document.visibilityState === "visible";
      if (running) raf = requestAnimationFrame(frame);
      else cancelAnimationFrame(raf);
    };

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [input, onHover, layout]);

  return <canvas ref={ref} className="absolute inset-0" role="img" aria-label={input ? `Live money-flow map of wallet ${input.center}${input.sanctioned ? ", an OFAC-sanctioned address" : ""}, showing its largest counterparties from public chain data` : "Money-flow map loading from public chain data"} />;
}
