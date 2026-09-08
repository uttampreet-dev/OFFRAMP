"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar, Seg, Primary, Chip, StatusBar } from "@/components/console";

interface Art { name: string; kind: string; synthetic: boolean; sha256: string; bytes: number; summary: string }
interface Ev {
  caseId: string;
  demo: boolean;
  artefacts: Art[];
  packets: { id: string; sha256: string; by: string; at: number; address: string; approvedBy: string | null; approvedAt: number | null }[];
  packs: { id: string; rootHash: string; by: string; at: number; artefacts: number }[];
  audit: { at: number; username: string; action: string; detail: string }[];
}
const ist = (ts: number) => new Date(ts + 5.5 * 3600_000).toISOString().replace("T", " ").slice(0, 19) + " IST";
const kindTone = (k: string): "amber" | "teal" | "red" | "mut" | "green" => (k === "packet" ? "red" : k === "bridge" ? "amber" : k === "redflags" ? "teal" : k === "statement" ? "mut" : "green");

function Inner() {
  const params = useSearchParams();
  const [caseId, setCaseId] = useState("2026-CHD-0417");
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ev, setEv] = useState<Ev | null>(null);
  const [sealing, setSealing] = useState(false);
  const [verify, setVerify] = useState<Record<string, { ok: boolean; brokenAt: number | null }>>({});

  const load = useCallback(
    async (c = caseId, m = mode, a = address) => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/evidence?case=${encodeURIComponent(c)}${m === "demo" ? "&demo=1" : `&address=${encodeURIComponent(a)}`}`);
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "evidence failed");
        setEv(body as Ev);
      } catch (e) {
        setEv(null);
        setError(e instanceof Error ? e.message : "evidence failed");
      } finally {
        setLoading(false);
      }
    },
    [caseId, mode, address],
  );

  useEffect(() => {
    const c = params.get("case") ?? "2026-CHD-0417";
    const a = params.get("address");
    const m = a ? "live" : "demo";
    setCaseId(c);
    setMode(m);
    if (a) setAddress(a);
    load(c, m, a ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sealPack() {
    setSealing(true);
    try {
      const r = await fetch("/api/evidence/seal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId, demo: mode === "demo", address: mode === "live" ? address : undefined }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "seal failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "seal failed");
    } finally {
      setSealing(false);
    }
  }
  const [approveMsg, setApproveMsg] = useState<string | null>(null);
  async function approve(id: string) {
    setApproveMsg(null);
    const r = await fetch("/api/intercept/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const b = await r.json();
    if (!r.ok) return setApproveMsg(b.error ?? "sign-off failed");
    await load();
  }
  async function verifyPack(id: string) {
    const r = await fetch(`/api/evidence/${id}/export?format=json`);
    const body = await r.json();
    setVerify((v) => ({ ...v, [id]: body.verification }));
  }

  return (
    <div className="flex flex-col h-screen">
      <TopBar
        title="Evidence"
        subtitle="hash-chained pack · STR draft · BSA 2023 s.63 certificate"
        secondRow={<span className="c-note">every artefact is serialised canonically and hashed with SHA-256; hashes are chained so a single altered byte changes the root · documents are drafts until signed</span>}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="flex-1 flex items-center gap-3 min-w-0"
        >
          <div className="flex items-center h-[44px] bg-panel border border-line focus-within:border-amber/60 w-[280px]">
            <span className="mono text-[10px] tracking-[0.14em] uppercase text-faint px-3 border-r border-line h-full flex items-center">case</span>
            <input value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mono flex-1 min-w-0 bg-transparent px-3 text-[14px] outline-none" />
          </div>
          <Seg label="source" value={mode} options={[["demo", "demonstration"], ["live", "live wallet"]]} onChange={(x) => setMode(x as "demo" | "live")} />
          {mode === "live" && <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="wallet address" className="mono flex-1 min-w-0 h-[44px] bg-panel border border-line px-3 text-[14px] placeholder:text-faint outline-none focus:border-amber/60" />}
          <Primary disabled={loading}>{loading ? "assembling…" : "assemble"}</Primary>
        </form>
      </TopBar>

      {error && <div className="mx-8 mt-6 border border-[#652225] bg-[#1a0c0e] text-red px-4 py-3 text-[13px] max-w-xl">{error}</div>}

      {ev && (
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_320px_340px] overflow-hidden">
          {/* pack contents */}
          <div className="overflow-y-auto">
            <div className="px-6 py-4 border-b border-line flex items-center gap-3 overflow-hidden">
              <span className="c-label whitespace-nowrap">Pack contents · {ev.artefacts.length}</span>
              <Chip tone={ev.demo ? "mut" : "green"}>{ev.demo ? "demonstration · synthetic where marked" : "live chain data"}</Chip>
              <span className="ml-auto mono text-[12px] text-ink/80 whitespace-nowrap shrink-0">{ev.caseId}</span>
            </div>
            <div className="px-6">
              {ev.artefacts.map((a) => (
                <div key={a.name} className="grid grid-cols-[minmax(0,1fr)_150px] gap-4 py-3 border-b border-line2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="mono text-[13.5px] text-ink/95">{a.name}</span>
                      <Chip tone={kindTone(a.kind)}>{a.kind}</Chip>
                      {a.synthetic && <Chip tone="mut">synthetic</Chip>}
                    </div>
                    <div className="c-note mt-1">{a.summary}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="mono text-[11px] text-mut">{a.sha256.slice(0, 14)}…</div>
                    <div className="mono text-[10.5px] text-faint mt-0.5">{a.bytes.toLocaleString()} B · sha-256</div>
                  </div>
                </div>
              ))}
              {ev.artefacts.length === 0 && <p className="c-note py-6">Nothing to pack yet.</p>}
            </div>
            <div className="px-6 py-5 flex items-center gap-4">
              <button onClick={sealPack} disabled={sealing || ev.artefacts.length === 0} className="mono text-[11px] tracking-[0.12em] uppercase font-extrabold bg-amber text-[#12100c] px-5 py-3 hover:brightness-110 disabled:opacity-40">
                {sealing ? "sealing…" : "seal pack · chain hashes"}
              </button>
              <span className="c-note">sealing writes a manifest with the chained hashes and an audit entry; it does not alter the artefacts</span>
            </div>
          </div>

          {/* chain of custody */}
          <div className="border-l border-line overflow-y-auto">
            <div className="px-6 py-5 border-b border-line"><span className="c-label">Chain of custody · audit log</span></div>
            <div className="px-6 py-3">
              {ev.audit.length === 0 && <p className="c-note">No audited actions for this case yet.</p>}
              {ev.audit.map((r, i) => (
                <div key={i} className="grid grid-cols-[14px_1fr] gap-3 py-3 border-b border-line2">
                  <span className={`mt-1.5 w-2 h-2 rounded-full ${r.action.includes("sealed") ? "bg-red" : r.action.includes("export") ? "bg-amber" : "bg-[#8598aa]"}`} />
                  <div>
                    <div className="mono text-[12px] text-ink/90">{r.action}</div>
                    <div className="mono text-[10.5px] text-faint mt-0.5">{ist(r.at)} · {r.username}</div>
                    <div className="mono text-[10.5px] text-mut mt-0.5 break-all">{r.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* sealed packs + exports */}
          <aside className="border-l border-line bg-rail overflow-y-auto">
            <div className="px-6 py-5 border-b border-line"><span className="c-label">Sealed packs · exports</span></div>
            {ev.packs.length === 0 && <p className="c-note px-6 py-4">No sealed pack yet. Seal one on the left.</p>}
            {ev.packs.map((p) => (
              <div key={p.id} className="px-6 py-5 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="mono text-[13px] font-bold">{p.id}</span>
                  <Chip tone="green">{p.artefacts} artefacts</Chip>
                </div>
                <div className="mono text-[10.5px] text-mut mt-1">root {p.rootHash.slice(0, 20)}…</div>
                <div className="mono text-[10.5px] text-faint">sealed {ist(p.at)} · {p.by}</div>
                <div className="mt-3 flex flex-col gap-2">
                  <a href={`/api/evidence/${p.id}/export?format=json`} target="_blank" rel="noreferrer" className="mono text-[11px] tracking-[0.1em] uppercase font-bold text-ink border border-line px-3 py-2 hover:border-[#2c3a4c]">JSON bundle · manifest + verification ↗</a>
                  <a href={`/api/evidence/${p.id}/export?format=str`} target="_blank" rel="noreferrer" className="mono text-[11px] tracking-[0.1em] uppercase font-bold text-amber border border-amber/50 px-3 py-2 hover:bg-amber hover:text-[#12100c]">STR draft · FIU-IND format ↗</a>
                  <a href={`/api/evidence/${p.id}/export?format=bsa63`} target="_blank" rel="noreferrer" className="mono text-[11px] tracking-[0.1em] uppercase font-bold text-amber border border-amber/50 px-3 py-2 hover:bg-amber hover:text-[#12100c]">s.63 certificate · BSA 2023 ↗</a>
                  <a href={`/verify?pack=${p.id}&root=${p.rootHash}`} target="_blank" rel="noreferrer" className="mono text-[11px] tracking-[0.1em] uppercase font-bold text-teal border border-[#1f4a56] px-3 py-2 hover:border-teal">public verification page · no login ↗</a>
                  <button onClick={() => verifyPack(p.id)} className="mono text-[11px] tracking-[0.1em] uppercase font-bold text-mut border border-line px-3 py-2 hover:text-ink text-left">
                    {verify[p.id] ? (verify[p.id].ok ? "✓ verified — chain intact" : `✗ broken at artefact ${verify[p.id].brokenAt}`) : "verify integrity · recompute hashes"}
                  </button>
                </div>
              </div>
            ))}
            <div className="px-6 py-5">
              <div className="c-label mb-2">Sealed packets in this case</div>
              {ev.packets.length === 0 && <p className="c-note">None yet — seal one in Intercept.</p>}
              {ev.packets.map((p) => (
                <div key={p.id} className="py-2 border-b border-line2 last:border-0">
                  <div className="mono text-[12px]">{p.id} <span className="text-faint">· {p.sha256.slice(0, 12)}…</span></div>
                  <div className="mono text-[10.5px] text-faint">{ist(p.at)} · sealed by {p.by}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    {p.approvedBy ? (
                      <Chip tone="green">signed off · {p.approvedBy} · {p.approvedAt ? ist(p.approvedAt) : ""}</Chip>
                    ) : (
                      <button onClick={() => approve(p.id)} className="mono text-[10px] tracking-[0.1em] uppercase font-bold text-mut border border-line px-2 py-1 hover:text-ink">supervisor sign-off</button>
                    )}
                  </div>
                </div>
              ))}
              {approveMsg && <p className="c-note mt-2 text-red">{approveMsg}</p>}
              <p className="c-note mt-4 leading-relaxed">The STR is a draft until a principal officer signs it. The s.63 document states the matters a certificate must address; it has no effect until signed by the persons the section requires.</p>
            </div>
          </aside>
        </div>
      )}

      <StatusBar left="hashes: SHA-256 over canonical JSON · chain: hᵢ = sha256(hᵢ₋₁ ∥ aᵢ)" right="drafts — no filing, no evidentiary effect until signed" />
    </div>
  );
}

export default function EvidencePage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
