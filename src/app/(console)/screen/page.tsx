"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { TopBar, Chip, Primary, StatusBar, RiskBadge, RiskFactors } from "@/components/console";
import type { ScreenRow } from "@/lib/screen";

/*
 * Bulk screening: paste a list of wallet addresses (a seizure memo, an exchange's KYC export,
 * a complaint batch) and get every one screened against OFAC, the reported-address index, the
 * known-entity book and live chain activity, ranked by risk score.
 */

const SAMPLE = [
  "12HQDsicffSBaYdJ6BhnE22sfjTESmmzKx",
  "TA82wQ77kb9DieW4C8q7C4KwMfnCzfziqN",
  "0x0330070FD38Ec3bB94F58FA55D40368271E9e54A",
  "1295rkVyNfFpqZpXvKGhDqwhP1jZcNNDMV",
  "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s",
  "0x28C6c06298d514Db089934071355E5743bf21d60",
  "TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf",
  "3K35dyL85fR9ht7UgzPfd1gLRRXQtNTqE3",
  "0x8589427373D6D84E98730D7795D8f6f8731FDA16",
  "0xD0cC2B24980CBCCA47EF755Da88B220a82291407",
  "TASWbk6X1wiTku5TMmMQYqYFvshVEtfJy8",
  "0x4D24EecEcb86041F47bca41265319e9f06aE2Fcb",
];

const short = (a: string) => (a.length > 24 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a);
const fmtV = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: v < 1 ? 5 : 2 });
const ago = (t: number | null) => {
  if (!t) return "—";
  const d = (Date.now() - t) / 86400_000;
  return d < 1 ? "today" : d < 30 ? `${Math.floor(d)} d ago` : d < 365 ? `${Math.floor(d / 30)} mo ago` : `${(d / 365).toFixed(1)} y ago`;
};

function Inner() {
  const params = useSearchParams();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ScreenRow[] | null>(null);
  const [ms, setMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "flagged">("all");

  const found = useMemo(() => text.split(/[\s,;|"']+/).filter((t) => /^(0x[0-9a-fA-F]{40}|T[1-9A-HJ-NP-Za-km-z]{33}|[13][1-9A-HJ-NP-Za-km-z]{25,34}|bc1[0-9a-z]{20,80})$/.test(t)).length, [text]);

  async function run(input = text) {
    setBusy(true);
    setError(null);
    setMsg(null);
    setSel(null);
    try {
      const r = await fetch("/api/screen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input }) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "screening failed");
      const sorted = (b.rows as ScreenRow[]).sort((a, c) => (c.risk?.score ?? -1) - (a.risk?.score ?? -1));
      setRows(sorted);
      setMs(b.ms);
      setSel(sorted[0]?.address ?? null);
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : "screening failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!params.get("sample")) return;
    const id = setTimeout(() => {
      const t = SAMPLE.join("\n");
      setText(t);
      run(t);
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flagged = useMemo(() => (rows ?? []).filter((r) => r.risk && r.risk.band !== "low"), [rows]);
  const shown = filter === "flagged" ? flagged : rows ?? [];
  const selRow = rows?.find((r) => r.address === sel) ?? null;
  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, elevated: 0, low: 0, sanctioned: 0, reported: 0, entity: 0, failed: 0 };
    for (const r of rows ?? []) {
      if (r.risk) c[r.risk.band]++;
      if (r.sanctioned) c.sanctioned++;
      if (r.reported) c.reported++;
      if (r.entity) c.entity++;
      if (!r.ok) c.failed++;
    }
    return c;
  }, [rows]);

  async function watchFlagged() {
    setBusy(true);
    let added = 0;
    for (const r of flagged) {
      if (!r.chain) continue;
      const res = await fetch("/api/watch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: r.address, label: `bulk screen · ${r.risk?.score} ${r.risk?.band}` }) });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.added) added++;
    }
    setBusy(false);
    setMsg(`${added} added to the Live Board · ${flagged.length - added} were already watched or unresolvable`);
  }

  function exportCsv() {
    if (!rows) return;
    const head = ["address", "chain", "risk_score", "risk_band", "ofac_sdn", "reported", "known_entity", "tx_count", "balance", "symbol", "last_seen", "factors", "lookup"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((r) =>
      [r.address, r.chain ?? "", r.risk?.score ?? "", r.risk?.band ?? "", r.sanctioned ? "yes" : "no", r.reported ? `${r.reported.category} (${r.reported.source})` : "", r.entity ? `${r.entity.entity} · ${r.entity.type}` : "", r.txCount ?? "", r.balance ?? "", r.symbol ?? "", r.lastSeen ? new Date(r.lastSeen).toISOString() : "", (r.risk?.factors ?? []).map((f) => `+${f.points} ${f.label}`).join("; "), r.ok ? "ok" : r.error ?? "failed"]
        .map(esc)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `offramp-screening-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar
        title="Screen"
        subtitle="bulk screening · paste a list, rank by risk"
        secondRow={
          <span className="c-note">every address is checked against the OFAC SDN list, the reported-address index, the known-entity book and its live chain activity · the score is the same explainable score used on Trace and Red Flags</span>
        }
      >
        {rows && (
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="mono text-[10.5px] tracking-[0.12em] uppercase font-bold text-mut border border-line px-3 h-[38px] hover:text-ink">export csv</button>
            <button onClick={watchFlagged} disabled={busy || flagged.length === 0} className="mono text-[10.5px] tracking-[0.12em] uppercase font-extrabold text-amber border border-amber/50 px-3 h-[38px] hover:bg-amber hover:text-[#12100c] disabled:opacity-40">
              watch {flagged.length} flagged
            </button>
          </div>
        )}
      </TopBar>

      <div className="flex-1 min-h-0 grid grid-cols-[236px_minmax(0,1fr)_272px] 2xl:grid-cols-[320px_minmax(0,1fr)_330px]">
        {/* left: input */}
        <aside className="border-r border-line bg-rail flex flex-col min-h-0">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <span className="c-label">Addresses</span>
            <span className="mono text-[10.5px] text-mut">{found} found</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={"one per line, or paste a CSV / memo —\nBTC, ETH and TRON addresses are picked out of the text"}
            className="mono flex-1 min-h-[220px] bg-bg border-b border-line p-4 text-[12px] leading-relaxed outline-none resize-none text-ink/90 placeholder:text-faint"
          />
          <div className="p-4 flex flex-col gap-2">
            <Primary disabled={busy || found === 0} onClick={() => run()} type="button">{busy ? `screening ${found}…` : `screen ${found} address${found === 1 ? "" : "es"}`}</Primary>
            <button onClick={() => setText(SAMPLE.join("\n"))} className="mono text-[10px] tracking-[0.12em] uppercase text-mut hover:text-ink py-1 text-left">
              load a sample list · 12 mixed
            </button>
            <div className="c-note">up to 200 addresses per run · four lookups in parallel · a wallet whose chain lookup times out is still screened against the lists</div>
          </div>
          {error && <div className="mx-4 mb-4 border border-[#652225] bg-[#1a0c0e] px-3 py-2 text-[12px] text-red">{error}</div>}
          {msg && <div className="mx-4 mb-4 border border-line bg-panel px-3 py-2 mono text-[11px] text-mut">{msg}</div>}
        </aside>

        {/* centre: results */}
        <div className="min-w-0 flex flex-col min-h-0">
          {!rows ? (
            <div className="p-8 max-w-2xl">
              <div className="c-label">What you will get</div>
              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5">
                {[
                  ["Ranked table", "every address with its risk score and band, most dangerous first"],
                  ["List hits", "OFAC SDN, reported-address index and known-entity attribution per address"],
                  ["Chain activity", "transfers, balance and last activity from the public chain"],
                  ["Explained score", "click a row for the factors behind its number"],
                  ["Watch in bulk", "put every flagged address on the Live Board in one click"],
                  ["Export", "a CSV for the case file, with factors spelled out"],
                ].map(([t, d]) => (
                  <div key={t}>
                    <div className="text-[13px] font-semibold">{t}</div>
                    <div className="c-note mt-1">{d}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-line flex items-center gap-3 flex-wrap">
                <span className="c-label">{rows.length} screened</span>
                <div className="flex items-center gap-2">
                  {counts.critical > 0 && <Chip tone="red">{counts.critical} critical</Chip>}
                  {counts.high > 0 && <Chip tone="amber">{counts.high} high</Chip>}
                  {counts.elevated > 0 && <Chip tone="amber">{counts.elevated} elevated</Chip>}
                  <Chip tone="green">{counts.low} low</Chip>
                </div>
                <span className="c-note">{counts.sanctioned} on OFAC SDN · {counts.reported} reported · {counts.entity} attributed{counts.failed ? ` · ${counts.failed} without chain data` : ""} · {ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}</span>
                <div className="ml-auto flex border border-line">
                  {(["all", "flagged"] as const).map((v) => (
                    <button key={v} onClick={() => setFilter(v)} className={`mono text-[9.5px] tracking-[0.14em] uppercase font-bold px-3 h-[24px] ${filter === v ? "bg-amber text-[#12100c]" : "text-mut hover:text-ink"}`}>
                      {v === "all" ? "all" : `flagged · ${flagged.length}`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="grid grid-cols-[minmax(0,1fr)_46px_100px_122px_92px] gap-3 px-4 py-2 border-b border-line c-kv whitespace-nowrap sticky top-0 bg-bg z-10">
                  <span>address</span><span>chain</span><span>risk</span><span>lists</span><span>activity</span>
                </div>
                {shown.map((r) => {
                  const isSel = sel === r.address;
                  return (
                    <button key={r.address} onClick={() => setSel(r.address)} title={r.address} className={`w-full text-left grid grid-cols-[minmax(0,1fr)_46px_100px_122px_92px] gap-3 px-4 py-2.5 border-b border-line2 items-center hover:bg-panel/60 ${isSel ? "bg-panel" : ""}`}>
                      <span className="min-w-0">
                        <span className={`mono text-[12px] block truncate ${r.sanctioned ? "text-red" : "text-ink/90"}`}>{short(r.address)}</span>
                        {r.entity && <span className="mono text-[10px] text-teal block truncate">{r.entity.entity} · {r.entity.type}</span>}
                        {!r.ok && <span className="mono text-[10px] text-faint block truncate">{r.error}</span>}
                      </span>
                      <span><Chip tone={r.chain === "btc" ? "amber" : r.chain === "tron" ? "teal" : "mut"}>{r.chain ?? "?"}</Chip></span>
                      <span>{r.risk && <RiskBadge score={r.risk.score} band={r.risk.band} />}</span>
                      <span className="flex flex-wrap gap-1 min-w-0">
                        {r.sanctioned && <Chip tone="red">OFAC SDN</Chip>}
                        {r.reported && <Chip tone="amber">{r.reported.category.toLowerCase()}</Chip>}
                        {!r.sanctioned && !r.reported && <span className="c-note">no list hit</span>}
                      </span>
                      <span className="mono text-[11px] text-mut whitespace-nowrap">{r.txCount !== null ? `${r.txCount.toLocaleString()} tx` : "—"}<span className="block text-[10px] text-faint">{ago(r.lastSeen)}</span></span>
                    </button>
                  );
                })}
                {shown.length === 0 && <div className="p-6 c-note">nothing flagged in this run</div>}
              </div>
            </>
          )}
        </div>

        {/* right: selected */}
        <aside className="border-l border-line bg-rail overflow-y-auto">
          {selRow ? (
            <>
              <div className="px-5 py-4 border-b border-line">
                <div className="flex items-center justify-between gap-3">
                  <span className="c-label">Selected</span>
                  {selRow.risk && <RiskBadge score={selRow.risk.score} band={selRow.risk.band} size="lg" />}
                </div>
                <div className="mono text-[12px] break-all text-ink/90 mt-3 leading-snug">{selRow.address}</div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  <div><div className="c-kv">Chain</div><div className="mono text-[13px] mt-0.5 uppercase">{selRow.chain ?? "—"}</div></div>
                  <div><div className="c-kv">Transfers</div><div className="mono text-[13px] mt-0.5">{selRow.txCount?.toLocaleString() ?? "—"}</div></div>
                  <div><div className="c-kv">Received</div><div className="mono text-[13px] mt-0.5">{selRow.received !== null ? `${fmtV(selRow.received)} ${selRow.symbol}` : "—"}</div></div>
                  <div><div className="c-kv">Last seen</div><div className="mono text-[13px] mt-0.5">{ago(selRow.lastSeen)}</div></div>
                </div>
                {selRow.entity && (
                  <div className="mt-3 c-note">
                    attributed to <span className="text-teal">{selRow.entity.entity}</span> · <a href={selRow.entity.source} target="_blank" rel="noreferrer" className="underline underline-offset-4">source ↗</a>
                  </div>
                )}
              </div>
              <div className="px-5 py-4 border-b border-line">
                <div className="c-label mb-2">Why this score</div>
                {selRow.risk && <RiskFactors factors={selRow.risk.factors} note={selRow.risk.note} />}
              </div>
              <div className="px-5 py-4 flex flex-col gap-2">
                <Link href={`/trace?address=${selRow.address}`} className="mono text-[10.5px] tracking-[0.12em] uppercase font-extrabold text-amber border border-amber/50 px-3 py-2 text-center hover:bg-amber hover:text-[#12100c]">trace this wallet →</Link>
                <Link href={`/red-flags?address=${selRow.address}`} className="mono text-[10.5px] tracking-[0.12em] uppercase font-bold text-mut border border-line px-3 py-2 text-center hover:text-ink">run red flags</Link>
                <Link href={`/cases?address=${selRow.address}`} className="mono text-[10.5px] tracking-[0.12em] uppercase font-bold text-mut border border-line px-3 py-2 text-center hover:text-ink">open a case</Link>
              </div>
            </>
          ) : (
            <div className="p-6 c-note">screen a list, then click a row to see the factors behind its score</div>
          )}
        </aside>
      </div>

      <StatusBar left={<>OFAC SDN · reported-address index · known entities · live public chain data</>} right={<>a score ranks attention, it does not prove ownership or guilt</>} />
    </div>
  );
}

export default function ScreenPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
