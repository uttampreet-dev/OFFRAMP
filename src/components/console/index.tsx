import type { ReactNode } from "react";

/* Chrome shared by every console module — one type scale, one set of surfaces. */

export function TopBar({ title, subtitle, children, secondRow }: { title: string; subtitle?: string; children?: ReactNode; secondRow?: ReactNode }) {
  return (
    <div className="shrink-0 border-b border-line bg-rail">
      <div className="h-[66px] flex items-center px-6 gap-4">
        <div className="shrink-0 min-w-[150px]">
          <div className="text-[16px] font-bold leading-tight">{title}</div>
          {subtitle && <div className="mono text-[11px] text-[#657a8e] mt-0.5">{subtitle}</div>}
        </div>
        {children}
      </div>
      {secondRow && <div className="min-h-[44px] py-1.5 border-t border-line/70 flex items-center flex-wrap px-6 gap-x-5 gap-y-1.5">{secondRow}</div>}
    </div>
  );
}

export function AddressInput({ value, onChange, placeholder = "Paste a BTC, ETH or TRON address" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative flex-1 min-w-0">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 mono text-[10px] tracking-[0.14em] uppercase font-bold text-faint pointer-events-none">addr</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="c-input w-full h-11 bg-panel border border-line pl-14 pr-3 outline-none transition-[border-color,box-shadow]"
      />
    </div>
  );
}

export function Seg({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="c-kv">{label}</span>
      {options.map(([v, t]) => (
        <button
          type="button"
          key={v}
          onClick={() => onChange(v)}
          className={`mono text-[11px] px-3 py-2 border transition-colors ${value === v ? "border-amber/70 text-amber bg-[#17130a]" : "border-line text-mut hover:text-ink hover:border-[#2c3a4c]"}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function Primary({ children, disabled, onClick, type = "submit" }: { children: ReactNode; disabled?: boolean; onClick?: () => void; type?: "submit" | "button" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="mono text-[12px] tracking-[0.12em] uppercase font-extrabold bg-amber text-[#12100c] px-6 h-11 hover:brightness-110 disabled:opacity-50 shrink-0">
      {children}
    </button>
  );
}

export function Chip({ tone = "mut", children }: { tone?: "green" | "red" | "amber" | "teal" | "mut"; children: ReactNode }) {
  const c = {
    green: "bg-[#08170f] text-green border-[#1c5943]",
    red: "bg-[#1a0c0e] text-red border-[#652225]",
    amber: "bg-[#17130a] text-amber border-[#66501e]",
    teal: "bg-[#0a1a1f] text-teal border-[#1f4a56]",
    mut: "bg-panel2 text-mut border-line",
  }[tone];
  return <span className={`mono text-[9.5px] tracking-[0.1em] uppercase font-bold border px-2 py-0.5 whitespace-nowrap shrink-0 ${c}`}>{children}</span>;
}

export function Section({ title, chip, children }: { title: string; chip?: ReactNode; children: ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-line">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="c-label">{title}</span>
        {chip}
      </div>
      {children}
    </div>
  );
}

export function KV({ k, v, tone }: { k: string; v: ReactNode; tone?: "red" | "teal" | "amber" }) {
  const c = tone === "red" ? "text-red" : tone === "teal" ? "text-teal" : tone === "amber" ? "text-amber" : "";
  return (
    <div>
      <div className="c-kv">{k}</div>
      <div className={`c-val mt-1 break-words ${c}`}>{v}</div>
    </div>
  );
}

export function Flag({ on, onText, offText, tone }: { on: boolean; onText: string; offText: string; tone: "red" | "teal" | "green" }) {
  const c = !on ? "text-faint" : tone === "red" ? "text-red" : tone === "teal" ? "text-teal" : "text-green";
  const dot = !on ? "bg-[#26313f]" : tone === "red" ? "bg-red" : tone === "teal" ? "bg-teal" : "bg-green";
  return (
    <div className={`flex items-start gap-2.5 text-[13px] leading-snug py-1.5 ${c}`}>
      <span className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <span>{on ? onText : offText}</span>
    </div>
  );
}

export function StatusBar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="h-[38px] shrink-0 border-t border-line bg-rail flex items-center px-6 gap-6 mono text-[11px] text-faint">
      <span className="flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green" />
        {left}
      </span>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

export function RiskBadge({ score, band, size = "sm" }: { score: number; band: "low" | "elevated" | "high" | "critical"; size?: "sm" | "lg" }) {
  const c = { low: "text-green border-[#1c5943] bg-[#08170f]", elevated: "text-amber border-[#66501e] bg-[#17130a]", high: "text-[#f0a35a] border-[#6b4a1e] bg-[#1c120a]", critical: "text-red border-[#652225] bg-[#1a0c0e]" }[band];
  return (
    <span className={`mono inline-flex items-baseline gap-1.5 border whitespace-nowrap ${size === "lg" ? "px-3 py-1.5" : "px-2 py-0.5"} ${c}`}>
      <span className={`font-extrabold ${size === "lg" ? "text-[22px] leading-none" : "text-[12px]"}`}>{score}</span>
      <span className={`tracking-[0.12em] uppercase font-bold ${size === "lg" ? "text-[9.5px]" : "text-[8.5px]"}`}>{band}</span>
    </span>
  );
}

export function RiskFactors({ factors, note }: { factors: { key: string; label: string; points: number; evidence: string; rule: string }[]; note: string }) {
  return (
    <div>
      {factors.length === 0 && <div className="c-note">no risk factors from screening or exposure</div>}
      {factors.map((f) => (
        <div key={f.key} className="grid grid-cols-[44px_1fr] gap-3 py-2 border-b border-line2 last:border-0">
          <span className="mono text-[13px] font-bold text-amber">+{f.points}</span>
          <div className="min-w-0">
            <div className="text-[12.5px] text-ink/90">{f.label}</div>
            <div className="mono text-[10.5px] text-mut leading-snug">{f.evidence}</div>
            <div className="mono text-[9.5px] text-faint mt-0.5">rule · {f.rule}</div>
          </div>
        </div>
      ))}
      <div className="c-note mt-2">{note}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="p-8 c-body max-w-xl">{children}</div>;
}
