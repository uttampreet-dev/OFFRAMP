"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { CaseRow, CaseStatus } from "@/lib/db";
import type { CaseDetail, TimelineKind } from "@/lib/cases";
import { TopBar, AddressInput, Seg, Primary, Chip, StatusBar } from "@/components/console";

type CaseListRow = CaseRow & { packets: number; packs: number };
const STATUSES: [string, string][] = [["intake", "intake"], ["tracing", "tracing"], ["cash-out", "cash-out"], ["escalated", "escalated"], ["closed", "closed"]];
const stamp = (ts: number) => { const d = new Date(ts + 5.5 * 3600_000); return `${String(d.getUTCDate()).padStart(2, "0")} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const ist = (ts: number) => new Date(ts + 5.5 * 3600_000).toISOString().replace("T", " ").slice(0, 16) + " IST";
const KINDS: { k: TimelineKind; label: string; dot: string }[] = [
  { k: "chain", label: "chain", dot: "bg-teal" },
  { k: "statement", label: "bank", dot: "bg-amber" },
  { k: "alert", label: "alerts", dot: "bg-red" },
  { k: "packet", label: "packets", dot: "bg-red" },
  { k: "pack", label: "packs", dot: "bg-red" },
  { k: "audit", label: "actions", dot: "bg-[#4e5f70]" },
];
const dotFor = (k: TimelineKind) => (k === "opened" ? "bg-amber" : KINDS.find((x) => x.k === k)?.dot ?? "bg-[#4e5f70]");
const fmtMove = (v: number, sym: string) => (sym === "INR" ? `₹${v.toLocaleString("en-IN")}` : `${v.toLocaleString("en-IN", { maximumFractionDigits: v < 1 ? 5 : 2 })} ${sym}`);
const statusTone = (s: string): "amber" | "red" | "teal" | "mut" | "green" => (s === "cash-out" ? "red" : s === "escalated" ? "amber" : s === "tracing" ? "teal" : s === "closed" ? "green" : "mut");

function Inner() {
  const params = useSearchParams();
  const [cases, setCases] = useState<CaseListRow[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [seed, setSeed] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [hide, setHide] = useState<Set<TimelineKind>>(new Set());
  const [hits, setHits] = useState<{ kind: string; id: string; title: string; detail: string; href: string; synthetic?: boolean }[] | null>(null);
  async function search() {
    if (q.trim().length < 3) return setHits([]);
    const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
    const b = await r.json();
    setHits(b.hits ?? []);
  }

  const loadList = useCallback(async () => {
    const r = await fetch("/api/cases", { cache: "no-store" });
    const b = await r.json();
    setCases(b.cases ?? []);
    return (b.cases ?? []) as CaseListRow[];
  }, []);
  // the listed row travels with the request, so a host instance that never stored the case can still answer
  const carry = (row?: CaseRow | null) => (row ? `?c=${encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(row)))))}` : "");
  const loadDetail = useCallback(async (id: string, row?: CaseRow | null) => {
    const r = await fetch(`/api/cases/${id}${carry(row)}`, { cache: "no-store" });
    if (!r.ok) return setDetail(null);
    const d = (await r.json()) as CaseDetail;
    setDetail(d);
    setNotes(d.c.notes);
  }, []);

  useEffect(() => {
    const a = params.get("address");
    if (a) setSeed(a);
    loadList().then((l) => {
      const id = params.get("id") ?? l[0]?.id ?? null;
      setSel(id);
      if (id) loadDetail(id, l.find((x) => x.id === id) ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function open() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seed, title }) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "could not open case");
      setSeed("");
      setTitle("");
      await loadList();
      setSel(b.id);
      loadDetail(b.id, b as CaseRow);
      setMsg(`opened ${b.id}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "could not open case");
    } finally {
      setBusy(false);
    }
  }
  async function patch(p: { status?: string; notes?: string }) {
    if (!sel) return;
    const r = await fetch(`/api/cases/${sel}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    if (!r.ok) setMsg((await r.json()).error ?? "update failed");
    await loadList();
    loadDetail(sel, cases.find((x) => x.id === sel) ?? null);
  }

  const c = detail?.c;
  return (
    <div className="flex flex-col h-screen">
      <TopBar
        title="Cases"
        subtitle="case files · timeline · hand-offs"
        secondRow={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
            className="flex items-center gap-3 w-full"
          >
            <span className="mono text-[10px] tracking-[0.14em] uppercase font-bold text-faint shrink-0">search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="case id · wallet · transaction hash · account · complaint · entity — everything the console holds" className="mono flex-1 min-w-0 h-[34px] bg-panel border border-line px-3 text-[12.5px] placeholder:text-faint outline-none focus:border-amber/60" />
            <button className="mono text-[10.5px] tracking-[0.12em] uppercase font-bold text-amber border border-amber/50 px-3 py-1.5 hover:bg-amber hover:text-[#12100c]">find</button>
            {hits !== null && <span className="c-note shrink-0">{hits.length} result{hits.length === 1 ? "" : "s"}</span>}
            {hits !== null && <button type="button" onClick={() => { setHits(null); setQ(""); }} className="mono text-[10px] text-faint hover:text-ink">clear</button>}
          </form>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (seed.trim()) open();
          }}
          className="flex-1 flex items-center gap-3 min-w-0"
        >
          <AddressInput value={seed} onChange={setSeed} placeholder="Seed wallet for a new case" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="title (optional)" className="mono w-[260px] h-[44px] bg-panel border border-line px-3 text-[13px] placeholder:text-faint outline-none focus:border-amber/60" />
          <Primary disabled={busy || !seed.trim()}>{busy ? "opening…" : "open case"}</Primary>
          {msg && <span className="c-note truncate">{msg}</span>}
        </form>
      </TopBar>

      <div className="flex-1 min-h-0 grid grid-cols-[380px_minmax(0,1fr)] overflow-hidden">
        <div className="border-r border-line overflow-y-auto">
          {hits !== null && (
            <div className="border-b border-line bg-panel">
              <div className="px-6 py-3 border-b border-line2 flex items-center gap-2"><span className="c-label">Search results</span><span className="c-note">{q}</span></div>
              {hits.length === 0 && <p className="c-note px-6 py-4">Nothing matched. Addresses and transaction hashes are recognised even when no record exists yet.</p>}
              {hits.map((h, i) => (
                <Link key={i} href={h.href} className="block px-6 py-2.5 border-b border-line2 last:border-0 hover:bg-rail">
                  <div className="flex items-center gap-2"><Chip tone={h.kind === "address" || h.kind === "transaction" ? "teal" : h.kind === "case" ? "amber" : "mut"}>{h.kind}</Chip><span className="mono text-[12px] font-bold truncate">{h.title}</span>{h.synthetic && <Chip tone="mut">synthetic</Chip>}</div>
                  <div className="mono text-[10.5px] text-mut truncate mt-0.5">{h.detail}</div>
                </Link>
              ))}
            </div>
          )}
          <div className="px-6 py-4 border-b border-line"><span className="c-label">Case files · {cases.length}</span></div>
          {cases.map((k) => (
            <button
              key={k.id}
              onClick={() => {
                setSel(k.id);
                loadDetail(k.id, k);
              }}
              className={`w-full text-left px-6 py-4 border-b border-line2 hover:bg-panel ${sel === k.id ? "bg-panel shadow-[inset_2px_0_0_#e8b23a]" : ""}`}
            >
              <div className="flex items-center gap-2"><span className="mono text-[13px] font-bold">{k.id}</span><Chip tone={statusTone(k.status)}>{k.status}</Chip>{k.synthetic ? <Chip tone="mut">synthetic</Chip> : null}</div>
              <div className="text-[13px] text-ink/90 mt-1 leading-snug">{k.title}</div>
              <div className="mono text-[10.5px] text-faint mt-1">{k.chain.toUpperCase()} · {k.officer} · {k.packets} packets · {k.packs} packs · {ist(k.updated_at)}</div>
            </button>
          ))}
          {cases.length === 0 && <p className="c-note px-6 py-6">No cases yet.</p>}
        </div>

        <div className="overflow-y-auto">
          {c ? (
            <>
              <div className="px-7 py-5 border-b border-line">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="mono text-[20px] font-extrabold">{c.id}</span>
                  <Chip tone={statusTone(c.status)}>{c.status}</Chip>
                  {c.synthetic ? <Chip tone="mut">demonstration · synthetic narrative</Chip> : <Chip tone="green">live public chain data</Chip>}
                </div>
                <div className="text-[15px] mt-2">{c.title}</div>
                <div className="mt-4 flex items-center gap-4 flex-wrap">
                  <Seg label="status" value={c.status} options={STATUSES} onChange={(s) => patch({ status: s as CaseStatus })} />
                  <span className="c-note">opened {ist(c.created_at)} by {c.officer}</span>
                  <a href={`/api/cases/${c.id}/report${carry(c)}`} target="_blank" rel="noreferrer" className="ml-auto mono text-[10.5px] tracking-[0.12em] uppercase font-extrabold text-amber border border-amber/50 px-3 py-1.5 hover:bg-amber hover:text-[#12100c]">investigation report ↗</a>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_1fr]">
                <div className="px-7 py-5 border-r border-line">
                  <div className="c-label mb-3">Seed wallet</div>
                  <div className="mono text-[13px] break-all">{c.seed}</div>
                  <div className="mono text-[11px] text-mut mt-1">{c.chain.toUpperCase()}</div>
                  <div className="mt-4 flex flex-col gap-2">
                    {[
                      [`/trace?address=${c.seed}`, "Trace the flow"],
                      [`/red-flags?address=${c.seed}`, "Run the ten detectors"],
                      [c.synthetic ? "/bridge?demo=1" : `/bridge?address=${c.seed}`, "Cross the seam in Bridge"],
                      [c.synthetic ? "/intercept?demo=1" : `/intercept?address=${c.seed}&case=${c.id}`, "Compose the freeze packet"],
                      [`/evidence?case=${c.id}${c.synthetic ? "&demo=1" : `&address=${c.seed}`}`, "Assemble the evidence pack"],
                    ].map(([href, t]) => (
                      <Link key={href} href={href} className="group flex items-center justify-between border border-line px-3.5 py-2.5 hover:border-amber/60 transition-colors">
                        <span className="text-[13px] font-semibold group-hover:text-amber transition-colors">{t}</span>
                        <span className="mono text-amber">→</span>
                      </Link>
                    ))}
                  </div>
                  <div className="c-label mt-6 mb-2">Notes</div>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} className="w-full bg-panel border border-line px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-amber/60 resize-y" />
                  <button onClick={() => patch({ notes })} disabled={notes === c.notes} className="mt-2 mono text-[10.5px] tracking-[0.12em] uppercase font-bold text-amber border border-amber/50 px-3 py-1.5 hover:bg-amber hover:text-[#12100c] disabled:opacity-40">
                    save notes
                  </button>
                </div>
                <div className="px-7 py-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <span className="c-label">Timeline · {detail!.timeline.length} entries</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {KINDS.filter((x) => detail!.counts[x.k] > 0).map((x) => {
                        const off = hide.has(x.k);
                        return (
                          <button
                            key={x.k}
                            onClick={() => setHide((h) => { const n = new Set(h); if (n.has(x.k)) n.delete(x.k); else n.add(x.k); return n; })}
                            className={`mono text-[9.5px] tracking-[0.12em] uppercase font-bold inline-flex items-center gap-1.5 border px-2 h-[22px] ${off ? "border-line text-faint" : "border-line2 text-mut hover:text-ink"}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${off ? "bg-[#2a3542]" : x.dot}`} />
                            {x.label} · {detail!.counts[x.k]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {detail!.chainNote && <div className="c-note mb-2">{detail!.chainNote}</div>}
                  {c.synthetic ? <div className="c-note mb-2">chain events and the statement on this case are synthetic, part of the demonstration narrative</div> : null}
                  {detail!.timeline.filter((t) => !hide.has(t.kind)).map((t, i) => (
                    <div key={i} className={`grid grid-cols-[10px_1fr] gap-3 py-2.5 border-b border-line2 ${t.key ? "bg-panel/40 -mx-2 px-2" : ""}`}>
                      <span className={`mt-1.5 w-2 h-2 rounded-full ${dotFor(t.kind)} ${t.key ? "ring-2 ring-offset-1 ring-offset-bg ring-amber/50" : ""}`} />
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2.5">
                          <span className={`mono text-[12px] whitespace-nowrap ${t.key ? "text-ink font-bold" : "text-ink/90"}`}>{t.title}</span>
                          {t.value !== undefined && t.symbol && t.kind === "chain" && <span className="mono text-[11px] text-teal shrink-0">{fmtMove(t.value, t.symbol)}</span>}
                          <span className="mono text-[10px] text-faint ml-auto shrink-0" title={ist(t.at)}>{stamp(t.at)} · {t.by}</span>
                        </div>
                        <div className="mono text-[10.5px] text-mut break-all">{t.detail}</div>
                      </div>
                    </div>
                  ))}
                  {(detail!.packets.length > 0 || detail!.packs.length > 0) && (
                    <>
                      <div className="c-label mt-6 mb-2">Sealed artefacts</div>
                      {detail!.packets.map((p) => (
                        <div key={p.id} className="mono text-[11.5px] py-1.5 border-b border-line2">{p.id} <span className="text-faint">· packet · {p.sha256.slice(0, 16)}… · {p.by}{p.approvedBy ? ` · signed off by ${p.approvedBy}` : " · awaiting sign-off"}</span></div>
                      ))}
                      {detail!.packs.map((p) => (
                        <div key={p.id} className="mono text-[11.5px] py-1.5 border-b border-line2">{p.id} <span className="text-faint">· pack · root {p.rootHash.slice(0, 16)}… · {p.by}</span></div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="px-8 py-10 max-w-lg">
              <div className="c-label">Open a case</div>
              <h2 className="text-[22px] font-bold mt-2 leading-tight">One file per wallet, one timeline for everything done on it.</h2>
              <p className="c-body mt-3">Paste a seed wallet above. Trace, Red Flags, Bridge, Intercept and Evidence are reached from the case and write back to its audited timeline.</p>
            </div>
          )}
        </div>
      </div>
      <StatusBar left="case ids are sequential · status changes and notes are audited under the officer's login" right={c ? `${c.id} · ${c.status}` : ""} />
    </div>
  );
}

export default function CasesPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
