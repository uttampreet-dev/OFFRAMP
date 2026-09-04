"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { RedFlagReport, Finding } from "@/lib/detectors";
import { TopBar, AddressInput, Seg, Primary, Chip, StatusBar } from "@/components/console";

const DEMO = [
  { address: "TA82wQ77kb9DieW4C8q7C4KwMfnCzfziqN", chain: "tron", why: "OFAC SDN · USDT · layering through sanctioned neighbours" },
  { address: "12HQDsicffSBaYdJ6BhnE22sfjTESmmzKx", chain: "btc", why: "OFAC SDN · 1,335 tx · reaches Binance at hop 1" },
  { address: "1295rkVyNfFpqZpXvKGhDqwhP1jZcNNDMV", chain: "btc", why: "OFAC SDN · 3,377 BTC received" },
] as const;

const RULES: [string, string][] = [
  ["Rapid layering", "immediate onward transfer through intermediaries"],
  ["Structuring / splitting", "one outflow split into similar pieces in minutes"],
  ["P2P off-ramp counterparty", "downstream wallet transacting with very many parties"],
  ["Velocity spike", "recent frequency far above the wallet's baseline"],
  ["Mixer / tumbler contact", "a known mixing service in the flow"],
  ["Sanctions list hit", "seed or any traced wallet on the OFAC SDN list"],
  ["Cross-chain bridge hop", "contact with a known bridge contract"],
  ["Dormant wallet reactivated", "long silence followed by a burst"],
  ["Peel chain", "large remainder carried on, small amounts peeled off"],
  ["Round-number transfers", "repeated exactly-round amounts"],
];

const short = (a: string) => (a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
const sevTone = (s: Finding["severity"]): "red" | "amber" | "mut" => (s === "high" ? "red" : s === "medium" ? "amber" : "mut");

function Inner() {
  const params = useSearchParams();
  const [address, setAddress] = useState("");
  const [depth, setDepth] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rep, setRep] = useState<RedFlagReport | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const run = useCallback(
    async (addr?: string, d = depth) => {
      const a = (addr ?? address).trim();
      if (!a) return;
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/redflags?address=${encodeURIComponent(a)}&depth=${d}`);
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "detector run failed");
        setRep(body as RedFlagReport);
        setSel((body as RedFlagReport).findings.find((f) => f.fired)?.id ?? (body as RedFlagReport).findings[0].id);
      } catch (e) {
        setRep(null);
        setError(e instanceof Error ? e.message : "detector run failed");
      } finally {
        setLoading(false);
      }
    },
    [address, depth],
  );

  useEffect(() => {
    const a = params.get("address");
    if (a) {
      const d = Math.min(3, Math.max(1, Number(params.get("depth") ?? 2) || 2));
      setAddress(a);
      setDepth(d);
      run(a, d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const f = rep?.findings.find((x) => x.id === sel) ?? null;
  const counts = rep ? { high: rep.findings.filter((x) => x.fired && x.severity === "high").length, medium: rep.findings.filter((x) => x.fired && x.severity === "medium").length, info: rep.findings.filter((x) => x.fired && x.severity === "info").length } : null;

  return (
    <div className="flex flex-col h-screen">
      <TopBar
        title="Red Flags"
        subtitle="FATF indicator suite · 10 explainable rules"
        secondRow={
          <>
            <Seg label="trace depth" value={String(depth)} options={[["1", "1"], ["2", "2"], ["3", "3"]]} onChange={(v) => setDepth(Number(v))} />
            <span className="ml-auto c-note">every flag names the rule that fired and why · presumptive — corroborate before acting</span>
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
          <Primary disabled={loading}>{loading ? "running…" : "run detectors"}</Primary>
        </form>
      </TopBar>

      {!rep && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {error && <div className="mx-8 mt-6 border border-[#652225] bg-[#1a0c0e] text-red px-4 py-3 text-[13px] max-w-xl">{error}</div>}
          {loading && <div className="px-8 pt-6 mono text-[12px] text-faint">running ten detectors over the seed, its trace and its intermediaries…</div>}
          {!error && !loading && (
            <div className="px-8 py-8 max-w-[1300px] grid lg:grid-cols-[1fr_1.1fr] gap-10">
              <div>
                <div className="c-label">Run the detectors</div>
                <h2 className="text-[22px] font-bold mt-2 leading-tight">Ten named rules. Every flag says why.</h2>
                <p className="c-body mt-3 max-w-md">
                  Each detector is a stated rule with a stated threshold, grounded in FATF&apos;s 2020 virtual-asset red-flag indicators. There is no
                  score out of a hundred — an investigator has to explain a flag in court, and a number does not help them.
                </p>
                <div className="c-label mt-8">Verified demonstration wallets</div>
                <div className="mt-3 flex flex-col gap-2">
                  {DEMO.map((d) => (
                    <button
                      key={d.address}
                      onClick={() => {
                        setAddress(d.address);
                        run(d.address);
                      }}
                      className="group flex items-center gap-4 border border-line bg-rail px-4 py-3 text-left hover:border-amber/60 transition-colors"
                    >
                      <Chip tone={d.chain === "btc" ? "amber" : "teal"}>{d.chain}</Chip>
                      <span className="mono text-[12.5px] text-ink/90 truncate flex-1">{d.address}</span>
                      <span className="c-note shrink-0">{d.why}</span>
                      <span className="mono text-amber opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border border-line bg-rail">
                <div className="h-[46px] border-b border-line flex items-center px-5 gap-3">
                  <span className="c-label">The ten rules</span>
                  <span className="ml-auto"><Chip tone="mut">FATF VA red flags · 2020</Chip></span>
                </div>
                <div className="px-5 py-2">
                  {RULES.map(([n, d], i) => (
                    <div key={n} className="grid grid-cols-[36px_220px_1fr] items-baseline gap-3 border-b border-line2 py-2.5 last:border-0">
                      <span className="mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-[13px] font-semibold">{n}</span>
                      <span className="c-note">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {rep && counts && (
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_380px]">
          {/* results */}
          <div className="min-w-0 overflow-y-auto">
            <div className="px-8 pt-6 pb-4 border-b border-line flex items-end gap-8">
              <div>
                <div className="c-label">Detectors fired</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(rep as RedFlagReport & { screening?: { sanctioned: boolean; reported: { category: string } | null; entity: { entity: string; type: string } | null } }).screening?.sanctioned && <Chip tone="red">OFAC SDN</Chip>}
                  {(rep as RedFlagReport & { screening?: { reported: { category: string } | null } }).screening?.reported && <Chip tone="amber">community report · {(rep as RedFlagReport & { screening?: { reported: { category: string } | null } }).screening!.reported!.category}</Chip>}
                  {(rep as RedFlagReport & { screening?: { entity: { entity: string; type: string } | null } }).screening?.entity && <Chip tone="teal">{(rep as RedFlagReport & { screening?: { entity: { entity: string; type: string } | null } }).screening!.entity!.entity} · public source</Chip>}
                </div>
                <div className="mono text-[40px] font-extrabold leading-none mt-1">
                  <span className={rep.fired ? "text-red" : "text-green"}>{rep.fired}</span>
                  <span className="text-faint text-[22px]"> / 10</span>
                </div>
              </div>
              <div className="flex gap-2 pb-1.5">
                <Chip tone="red">{counts.high} high</Chip>
                <Chip tone="amber">{counts.medium} medium</Chip>
                <Chip tone="mut">{counts.info} info</Chip>
              </div>
              <div className="ml-auto pb-1 text-right">
                <div className="mono text-[12.5px] text-ink/90">{short(rep.address)}</div>
                <div className="c-note mt-0.5">{rep.chain.toUpperCase()} · {rep.stats.transfersExamined} transfers · {rep.stats.hopsExamined} hop{rep.stats.hopsExamined === 1 ? "" : "s"} examined</div>
              </div>
            </div>
            <div>
              {rep.findings.map((x) => {
                const on = x.id === sel;
                const tone = sevTone(x.severity);
                const sq = !x.fired ? "bg-[#26313f]" : tone === "red" ? "bg-red" : tone === "amber" ? "bg-amber" : "bg-[#8598aa]";
                return (
                  <button
                    key={x.id}
                    onClick={() => setSel(x.id)}
                    className={`w-full text-left grid grid-cols-[14px_200px_minmax(0,1fr)_110px] items-center gap-3 px-6 py-3 border-b border-line2 transition-colors ${on ? "bg-panel shadow-[inset_3px_0_0_#e8b23a]" : "hover:bg-panel/60"}`}
                  >
                    <span className={`w-2.5 h-2.5 ${sq}`} />
                    <div>
                      <div className={`text-[14px] font-semibold ${x.fired ? "" : "text-mut"}`}>{x.name}</div>
                      <div className="mono text-[10px] text-faint mt-0.5 truncate">{x.fatf}</div>
                    </div>
                    <div className={`text-[13px] leading-snug ${x.fired ? "text-ink/90" : "text-faint"}`}>{x.summary}</div>
                    <div className="flex items-center gap-2 justify-end">
                      {x.fired ? (
                        <>
                          <span className="h-1.5 w-[64px] bg-line2 overflow-hidden"><span className={`block h-full ${tone === "red" ? "bg-red" : tone === "amber" ? "bg-amber" : "bg-[#8598aa]"}`} style={{ width: `${Math.round(x.confidence * 100)}%` }} /></span>
                          <span className="mono text-[11px] w-8 text-right">{Math.round(x.confidence * 100)}%</span>
                        </>
                      ) : (
                        <span className="mono text-[10px] tracking-[0.12em] uppercase text-faint">clear</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* why */}
          <aside className="border-l border-line bg-rail overflow-y-auto">
            {f && (
              <>
                <div className="px-6 py-5 border-b border-line">
                  <div className="flex items-center gap-2">
                    <Chip tone={f.fired ? sevTone(f.severity) : "mut"}>{f.fired ? `${f.severity} · fired` : "clear"}</Chip>
                    {f.fired && <span className="mono text-[11px] text-faint">confidence {Math.round(f.confidence * 100)}% — heuristic</span>}
                  </div>
                  <h3 className="text-[18px] font-bold mt-3">{f.name}</h3>
                  <div className="mono text-[11px] text-faint mt-1">FATF 2020 · {f.fatf}</div>
                </div>
                <div className="px-6 py-5 border-b border-line">
                  <div className="c-label mb-3">{f.fired ? "Why this fired" : "Why it is clear"}</div>
                  {f.fired ? (
                    <ul className="space-y-2.5">
                      {f.evidence.map((e, i) => (
                        <li key={i} className="mono text-[12px] leading-relaxed text-ink/90 pl-3 border-l border-line">{e}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-mut leading-relaxed">{f.summary}</p>
                  )}
                </div>
                {f.txids.length > 0 && (
                  <div className="px-6 py-5 border-b border-line">
                    <div className="c-label mb-3">Triggering transactions</div>
                    {f.txids.map((t) => (
                      <div key={t} className="mono text-[11.5px] text-ink/80 py-1 border-b border-line2 last:border-0">{short(t)}</div>
                    ))}
                  </div>
                )}
                <div className="px-6 py-5 border-b border-line">
                  <div className="c-label mb-2">What this does not mean</div>
                  <p className="c-note leading-relaxed">A flag is a presumptive indicator from public chain data. It does not establish ownership, intent or an offence. Corroborate before acting.</p>
                </div>
                <div className="px-6 py-5">
                  <div className="c-label mb-3">Next</div>
                  <div className="flex flex-col gap-2">
                    <Link href={`/trace?address=${rep.address}`} className="mono text-[11px] tracking-[0.1em] uppercase font-bold text-amber border border-amber/50 px-3 py-2 hover:bg-amber hover:text-[#12100c] transition-colors">Open the flow in Trace →</Link>
                    <Link href={`/intercept?address=${rep.address}`} className="mono text-[11px] tracking-[0.1em] uppercase font-bold text-mut border border-line px-3 py-2 hover:text-ink hover:border-[#2c3a4c] transition-colors">Intercept →</Link>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      <StatusBar left="Indicators from FATF Virtual Assets red-flag guidance, September 2020 · rules, not scores" right={rep ? `${rep.stats.requests} chain requests · ${(rep.stats.ms / 1000).toFixed(1)} s` : "presumptive — corroborate before acting"} />
    </div>
  );
}

export default function RedFlagsPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
