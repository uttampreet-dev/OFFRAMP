/* Compact live-looking views of each module, drawn from the demonstration case.
   Used on the landing page's console preview and as the placeholder body of
   modules that are still being built. */
export type ModuleKey = "live-board" | "cases" | "trace" | "bridge" | "red-flags" | "syndicates" | "intercept" | "evidence";

export function Row({ l, m, r, tone }: { l: string; m: string; r: string; tone?: "red" | "amber" | "hit" }) {
  const cls = tone === "hit" ? "bg-[#2a1f0a] text-[#fbe9bc] shadow-[inset_2px_0_0_#e8b23a] -mx-2 px-2" : "";
  return (
    <div className={`mono flex justify-between gap-3 text-[12px] border-b border-line2 py-2.5 ${cls}`}>
      <span className="text-faint shrink-0">{l}</span>
      <span className={`truncate ${tone === "red" ? "text-red" : tone === "amber" ? "text-amber" : "text-ink/85"}`}>{m}</span>
      <span className="font-bold shrink-0">{r}</span>
    </div>
  );
}
export function Pill({ t, tone }: { t: string; tone: "red" | "amber" | "mut" }) {
  const c = tone === "red" ? "bg-[#2e1418] text-red" : tone === "amber" ? "bg-[#2c2410] text-amber" : "bg-[#161f2a] text-mut";
  return <span className={`mono text-[10px] px-2 py-1 rounded-sm ${c}`}>{t}</span>;
}
const H = ({ children }: { children: React.ReactNode }) => <div className="c-kv mb-2">{children}</div>;

export function ModulePreview({ k }: { k: ModuleKey }) {
  switch (k) {
    case "live-board":
      return (
        <>
          <H>Active cases</H>
          <Row l="2026-CHD-0417" m="TRON · CASH-OUT" r="₹8.00L" tone="hit" />
          <Row l="2026-CHD-0391" m="TRON · TRACING" r="₹3.10L" />
          <Row l="2026-LDH-0122" m="BTC · INTAKE" r="₹5.75L" />
          <div className="mt-5 flex items-center justify-between">
            <span className="c-kv">Open windows</span>
            <span className="mono text-[16px] font-bold text-red">01:47:22</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill t="rapid layering 14" tone="red" /><Pill t="P2P off-ramp 22" tone="amber" /><Pill t="sanctions hit 1" tone="red" /><Pill t="mixer 3" tone="mut" />
          </div>
        </>
      );
    case "cases":
      return (
        <>
          <H>Watchlist</H>
          <Row l="TVd6j…2Lm7" m="TRON · P2P off-ramp · NEW ACTIVITY" r="11:43" tone="amber" />
          <Row l="TQr7x…9Kp3" m="TRON · layered cluster" r="04 Aug" />
          <Row l="bc1q8…4mz2" m="BTC → TRON bridge" r="09 Aug" />
          <div className="c-note mt-4">re-evaluated every 10 minutes against live chain state</div>
        </>
      );
    case "trace":
      return (
        <>
          <Row l="0 · 11:02:16" m="TKx9c…7Ha2 · victim payment" r="9,412 USDT" />
          <Row l="1 · 11:09:44" m="TQm4v…1Bd8 · split ×3" r="9,410 USDT" tone="amber" />
          <Row l="2 · 11:16:02" m="TZp8s…4Kf1 · rapid layering" r="9,404 USDT" tone="red" />
          <Row l="3 · 11:28:31" m="TBn2w…9Rc5 · pass-through" r="9,398 USDT" />
          <Row l="4 · 11:43:09" m="TVd6j…2Lm7 · CASH-OUT" r="9,398 USDT" tone="amber" />
        </>
      );
    case "bridge":
      return (
        <div className="grid grid-cols-2 gap-6 relative">
          <div>
            <H>On-chain</H>
            <Row l="11:43:09" m="TVd6j…2Lm7 → sold" r="9,398 USDT" />
            <Row l="11:28:31" m="TBn2w…9Rc5" r="9,398 USDT" />
          </div>
          <div className="cash-paper -my-2 py-2 px-3 rounded-sm">
            <H>Bank statement · synthetic</H>
            <Row l="11:38:52" m="IMPS/P2P/ref 88120" r="₹1,15,000" />
            <Row l="11:49:20" m="IMPS/P2P/ref 88147" r="₹7,98,180" tone="hit" />
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-[#8a6f26] bg-[#0e0c08] px-4 py-2 text-center">
            <div className="mono text-[8px] tracking-[0.18em] font-extrabold text-amber">SEAM MATCH</div>
            <div className="mono text-[20px] font-bold text-amber2 leading-tight">97.4%</div>
          </div>
        </div>
      );
    case "red-flags":
      return (
        <>
          <H>Detectors · 4 of 10 fired</H>
          <div className="flex flex-wrap gap-2">
            <Pill t="rapid layering" tone="red" /><Pill t="structuring" tone="red" /><Pill t="P2P off-ramp" tone="amber" /><Pill t="velocity spike" tone="amber" />
            <Pill t="mixer — none" tone="mut" /><Pill t="sanctions — clear" tone="mut" /><Pill t="bridge hop — none" tone="mut" /><Pill t="dormant — no" tone="mut" />
            <Pill t="peel chain — none" tone="mut" /><Pill t="round-number — none" tone="mut" />
          </div>
          <div className="mt-5 border-t border-line2 pt-4">
            <H>Why rapid layering fired</H>
            <div className="mono text-[12px] text-ink/85 leading-relaxed">3 outputs reconsolidated within 13 min · FATF VA red-flag 2020 §layering</div>
          </div>
        </>
      );
    case "syndicates":
      return (
        <>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="mono text-[30px] font-extrabold text-mut">47</span>
            <span className="text-amber">→</span>
            <span className="mono text-[30px] font-extrabold text-amber">3</span>
            <span className="text-[11px] text-faint">complaints collapse into networks by shared cash-out wallet</span>
          </div>
          <Row l="SYN-A" m="P2P off-ramp cluster · 8 victims" r="₹41.2L" tone="red" />
          <Row l="SYN-B" m="layered, 2 hops deep · 7 victims" r="₹28.6L" tone="amber" />
          <Row l="SYN-C" m="cross-chain BTC→TRON · 6 victims" r="₹19.4L" />
        </>
      );
    case "intercept":
      return (
        <>
          <div className="flex items-baseline justify-between">
            <span className="c-kv">Est. window before withdrawal</span>
            <span className="mono text-[30px] font-extrabold text-red leading-none">01:47:22</span>
          </div>
          <div className="mt-4">
            <Row l="EXCHANGE" m="Known VASP · deposit cluster #DC-2210" r="" />
            <Row l="DEPOSIT" m="TVd6j…2Lm7" r="" />
            <Row l="AMOUNT" m="9,398 USDT · ≈ ₹7,99,960" r="" />
            <Row l="EVIDENCE" m="sha256 3f9a…c710 · BSA s.63 attached" r="" />
          </div>
          <div className="c-note mt-4">OFFRAMP does not freeze funds — it composes the request an authorised officer sends.</div>
        </>
      );
    case "evidence":
      return (
        <>
          <H>Pack contents</H>
          <Row l="trace_graph.json" m="" r="3f9a…c710" />
          <Row l="hop_log.csv" m="" r="88b1…4de2" />
          <Row l="detector_findings" m="" r="c04f…91aa" />
          <Row l="freeze_packet" m="" r="4e51…07c9" />
          <Row l="str_draft (FIU-IND)" m="" r="7c23…b108" />
          <div className="c-note mt-4">hash chain verified · 0 modifications since seal</div>
        </>
      );
  }
}
