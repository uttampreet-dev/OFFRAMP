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
          <H>Watched addresses · re-evaluated every 60 s</H>
          <Row l="12aNKp2…TKupL" m="BTC · OFAC SDN · 102 tx" r="0 BTC" tone="red" />
          <Row l="TA3rH2A…mZdFg" m="TRON · OFAC SDN · 1 tx" r="9,994.74 USDT" tone="red" />
          <Row l="12HQDsi…mmzKx" m="BTC · OFAC SDN · 1,335 tx" r="0 BTC" tone="red" />
          <div className="mt-5 flex items-center justify-between">
            <span className="c-kv">Open window · replay of the demonstration case</span>
            <span className="mono text-[16px] font-bold text-amber">01:47:22</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill t="alert · outflow" tone="amber" /><Pill t="alert · sanctions contact" tone="red" /><Pill t="alert · velocity" tone="amber" /><Pill t="alert · window < 15 min" tone="red" />
          </div>
        </>
      );
    case "cases":
      return (
        <>
          <H>Case files</H>
          <Row l="2026-CHD-0417" m="TRON · CASH-OUT · demonstration · synthetic" r="₹8.00L" tone="hit" />
          <div className="mt-4">
            <H>Timeline · audited under the officer's login</H>
            <Row l="11:43 IST" m="case.opened · seed TVd6j…g0Lm7" r="investigator" />
            <Row l="—" m="packet.sealed · pack.sealed · pack.exported" r="on demand" />
          </div>
          <div className="c-note mt-4">search: case id · wallet · transaction hash · account · complaint · entity</div>
        </>
      );
    case "trace":
      return (
        <>
          <H>12HQDsi…mmzKx · OFAC SDN · 2 hops · live</H>
          <Row l="hop 1" m="1NDyJtN…tobu1s · Binance · public attribution" r="925.38 BTC" tone="hit" />
          <Row l="hop 1" m="38ogm5u…gWbtN8" r="0.01511 BTC" />
          <Row l="hop 1" m="3DT1c4X…46sk89" r="0.01237 BTC" />
          <Row l="hop 1" m="3Fc8xEd…8TU4TX" r="0.01218 BTC" />
          <div className="c-note mt-4">co-spend cluster · 731 addresses · common-input heuristic · not proof</div>
        </>
      );
    case "bridge":
      return (
        <div className="grid grid-cols-[1fr_auto_1fr] gap-x-5 items-center">
          <div>
            <H>On-chain · demonstration case</H>
            <Row l="11:43:09" m="TBn2wY…e0Rc5 → TVd6j…g0Lm7 · cash-out" r="9,398 USDT" tone="amber" />
            <Row l="11:28:31" m="TZp8sQ…d0Kf1 · pass-through" r="9,398 USDT" />
          </div>
          <div className="border border-[#8a6f26] bg-[#0e0c08] px-4 py-2 text-center self-center">
            <div className="mono text-[8px] tracking-[0.18em] font-extrabold text-amber">CANDIDATE LINKAGE</div>
            <div className="mono text-[20px] font-bold text-amber2 leading-tight">96.9%</div>
            <div className="mono text-[7.5px] text-[#8c7a50]">Δ 0.22% · Δt 6 min 11 s</div>
          </div>
          <div className="cash-paper -my-2 py-2 px-3 rounded-sm">
            <H>Bank statement 4471 · synthetic</H>
            <Row l="11:38:52" m="IMPS/P2P/ref 88120" r="₹1,15,000" />
            <Row l="11:49:20" m="IMPS/P2P/ref 88147" r="₹7,98,180" tone="hit" />
          </div>
        </div>
      );
    case "red-flags":
      return (
        <>
          <H>TA82wQ7…fziqN · sanctioned TRON seed · 3 of 10 fired</H>
          <div className="flex flex-wrap gap-2">
            <Pill t="rapid layering" tone="red" /><Pill t="sanctions list hit" tone="red" /><Pill t="round-number transfers" tone="mut" />
            <Pill t="structuring — clear" tone="mut" /><Pill t="mixer — clear" tone="mut" /><Pill t="P2P off-ramp — clear" tone="mut" /><Pill t="velocity — clear" tone="mut" />
            <Pill t="bridge hop — clear" tone="mut" /><Pill t="peel chain — clear" tone="mut" /><Pill t="dormant — clear" tone="mut" />
          </div>
          <div className="mt-5 border-t border-line2 pt-4">
            <H>Why rapid layering fired</H>
            <div className="mono text-[12px] text-ink/85 leading-relaxed">THabxpQ…kFAEf received 15,003 USDT and forwarded 15,045 USDT 11 min later · 5 intermediaries within 2 h · FATF 2020, immediate onward transfer</div>
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
            <span className="text-[11px] text-faint">synthetic complaints join into operator groups by shared cash-out wallet</span>
          </div>
          <Row l="SYN-01" m="7 complaints · 4 cities · 4.1 / week" r="₹33.2L" tone="amber" />
          <Row l="SYN-02" m="7 complaints · 4 cities · 3.5 / week" r="₹28.6L" />
          <Row l="SYN-03" m="6 complaints · 4 cities · 3.2 / week" r="₹19.4L" />
        </>
      );
    case "intercept":
      return (
        <>
          <div className="flex items-baseline justify-between">
            <span className="c-kv">Window before withdrawal · replay</span>
            <span className="mono text-[30px] font-extrabold text-amber leading-none">01:47:22</span>
          </div>
          <div className="mt-4">
            <Row l="CASE" m="2026-CHD-0417 · demonstration" r="" />
            <Row l="WALLET" m="TVd6j…g0Lm7 · unattributed · no public owner" r="" />
            <Row l="AMOUNT" m="9,398 USDT · ≈ ₹7,99,958" r="" />
            <Row l="WINDOW" m="02:00:00 · policy default · fewer than 3 pairs" r="" />
            <Row l="SEAL" m="SHA-256 · supervisor sign-off · audited" r="" />
          </div>
          <div className="c-note mt-4">OFFRAMP does not freeze funds — it composes the request an authorised officer sends.</div>
        </>
      );
    case "evidence":
      return (
        <>
          <H>Pack · case 2026-CHD-0417 · 4 artefacts</H>
          <Row l="bridge_correlation.json" m="synthetic" r="sha-256" />
          <Row l="bank_statement_4471.csv" m="synthetic" r="sha-256" />
          <Row l="chain_events.json" m="synthetic" r="sha-256" />
          <Row l="freeze_packet.json" m="sealed" r="sha-256" tone="hit" />
          <div className="c-note mt-4">hᵢ = sha256(hᵢ₋₁ ∥ aᵢ) · root recomputed on demand · exports: STR draft · s.63 certificate · JSON</div>
        </>
      );
  }
}
