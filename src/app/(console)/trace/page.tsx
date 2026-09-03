"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LookupResult } from "@/lib/chains/types";

type ApiResult = LookupResult & {
  screening: { ofacSanctioned: boolean; listSize: number; listSyncedAt: string | null };
};

const short = (a: string) => (a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
const fmtTime = (t: number | null) =>
  t ? new Date(t).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
const fmtVal = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: v < 1 ? 6 : 2 });

function TraceInner() {
  const params = useSearchParams();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);

  async function run(addr?: string) {
    const a = (addr ?? address).trim();
    if (!a) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lookup?address=${encodeURIComponent(a)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setResult(body as ApiResult);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "lookup failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const a = params.get("address");
    if (a) {
      setAddress(a);
      run(a);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = result?.summary;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-[58px] shrink-0 border-b border-line bg-rail flex items-center px-6 gap-4">
        <div>
          <div className="text-[13.5px] font-bold">Trace</div>
          <div className="mono text-[10.5px] text-[#657a8e] mt-0.5">BTC · ETH · TRON — auto-detected</div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="flex-1 max-w-xl ml-4"
        >
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Paste a wallet address…"
            spellCheck={false}
            className="mono w-full bg-panel border border-line rounded px-3 py-1.5 text-[12px] placeholder:text-faint outline-none focus:border-[#3a4e63]"
          />
        </form>
        {loading && <span className="text-[10px] tracking-[0.08em] uppercase font-bold text-mut">querying chain…</span>}
      </div>

      <div className="p-6 flex-1">
        {error && (
          <div className="border border-[#652225] bg-[#1a0c0e] text-red rounded px-4 py-3 text-[12px] max-w-xl">{error}</div>
        )}

        {!result && !error && (
          <div className="text-mut text-[12px] max-w-md leading-relaxed">
            Paste any Bitcoin, Ethereum or TRON address. The lookup runs against live public chain data and screens the
            address against the OFAC SDN digital-currency list.
          </div>
        )}

        {result && s && (
          <div className="space-y-4 max-w-5xl">
            {result.screening.ofacSanctioned && (
              <div className="border border-[#652225] bg-[#1a0c0e] rounded px-4 py-2.5 flex items-center gap-3">
                <span className="text-[9.5px] tracking-[0.1em] uppercase font-extrabold text-red">OFAC sanctioned</span>
                <span className="text-[11px] text-[#c9a0a3]">
                  This address appears on the US Treasury SDN digital-currency list.
                </span>
              </div>
            )}

            <div className="border border-line bg-panel rounded-md">
              <div className="px-4 py-2.5 border-b border-line flex items-center gap-2.5">
                <span className="hlabel">Address summary</span>
                <span className="mono text-[9px] px-1.5 py-0.5 rounded bg-[#08170f] text-green font-bold uppercase">
                  {result.fromCache ? "cached" : "live"} · {s.chain}
                </span>
              </div>
              <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                <Field k="Address" v={<span className="mono text-[11.5px] break-all">{s.address}</span>} wide />
                <Field k="Transfers seen" v={<Num>{String(s.txCount)}</Num>} />
                <Field k={`Received (${s.symbol})`} v={<Num>{fmtVal(s.receivedTotal)}</Num>} />
                <Field k={`Sent (${s.symbol})`} v={<Num>{fmtVal(s.sentTotal)}</Num>} />
                <Field k={`Balance (${s.symbol})`} v={<Num>{fmtVal(s.balance)}</Num>} />
                <Field k="First seen" v={<Num>{fmtTime(s.firstSeen)}</Num>} />
                <Field k="Last seen" v={<Num>{fmtTime(s.lastSeen)}</Num>} />
              </div>
            </div>

            <div className="border border-line bg-panel rounded-md overflow-x-auto">
              <div className="px-4 py-2.5 border-b border-line flex items-center gap-2.5">
                <span className="hlabel">Recent transfers</span>
                <span className="text-[9px] text-faint mono">{result.transfers.length} shown</span>
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left">
                    {["Time", "Direction", "Counterparty", "Value", "Tx"].map((h) => (
                      <th key={h} className="hlabel font-bold px-4 py-2 text-[8.5px]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.transfers.map((t, i) => (
                    <tr key={`${t.txid}-${i}`} className="border-t border-line2">
                      <td className="mono px-4 py-1.5 text-mut whitespace-nowrap">{fmtTime(t.time)}</td>
                      <td className="px-4 py-1.5">
                        <span
                          className={`mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            t.direction === "in" ? "bg-[#08170f] text-green" : "bg-[#17130a] text-amber"
                          }`}
                        >
                          {t.direction}
                        </span>
                      </td>
                      <td className="mono px-4 py-1.5">{short(t.direction === "in" ? t.from : t.to)}</td>
                      <td className="mono px-4 py-1.5 whitespace-nowrap">
                        {fmtVal(t.value)} <span className="text-faint">{t.symbol}</span>
                      </td>
                      <td className="mono px-4 py-1.5 text-faint">{short(t.txid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-faint mono">
              Live public chain data · OFAC list: {result.screening.listSize.toLocaleString()} addresses
              {result.screening.listSyncedAt ? ` · synced ${result.screening.listSyncedAt.slice(0, 10)}` : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ k, v, wide }: { k: string; v: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-4" : ""}>
      <div className="hlabel text-[8px]">{k}</div>
      <div className="mt-1">{v}</div>
    </div>
  );
}
function Num({ children }: { children: React.ReactNode }) {
  return <span className="mono text-[12px]">{children}</span>;
}

export default function TracePage() {
  return (
    <Suspense>
      <TraceInner />
    </Suspense>
  );
}
