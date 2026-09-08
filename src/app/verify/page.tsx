"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

/*
 * Public verification page. No account: a court clerk, a defence lawyer or a judge scans the
 * code on a certificate, or pastes the JSON bundle, and the hash chain is recomputed in front
 * of them. Only names and hashes are shown; artefact contents never leave the case file.
 */

type Result = {
  found: boolean;
  id: string | null;
  ok: boolean;
  brokenAt: number | null;
  rootMatches: boolean | null;
  caseId: string;
  sealedAt: string;
  sealedBy: string;
  rootHash: string;
  artefacts: { n: number; name: string; kind: string; synthetic: boolean; bytes: number; sha256: string; chain: string | null; summary: string }[];
};

/* the certificate's code carries {v, c: case, t: sealedAt, b: sealedBy, r: root, a: [[name, kind initial, sha256]...]}; hashes travel as base64url bytes to keep the code small */
type Carried = { v: number; c: string; t: string; b: string; r: string; a: [string, string, string][] };
const KINDS: Record<string, string> = { t: "trace", r: "redflags", b: "bridge", p: "packet", s: "statement" };
function hexOf(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return Array.from(atob(b64), (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function decodeCarried(hash: string): Carried | null {
  const m = /[#&]m=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(Array.from(atob(b64), (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
    const c = JSON.parse(json) as Carried;
    if (!c || c.v !== 2 || !Array.isArray(c.a) || typeof c.r !== "string") return null;
    return { ...c, r: hexOf(c.r), a: c.a.map(([n, k, h]) => [n, KINDS[k] ?? k, hexOf(h)] as [string, string, string]) };
  } catch {
    return null;
  }
}
/* recompute hᵢ = sha256(hᵢ₋₁ ∥ aᵢ) from the carried hashes; the browser does the maths, no server needed */
async function verifyCarried(c: Carried, expectRoot: string | null): Promise<Result> {
  let prev = "";
  const chain: string[] = [];
  for (const [, , sha] of c.a) {
    prev = await sha256Hex(prev + sha);
    chain.push(prev);
  }
  const ok = prev === c.r;
  const rootMatches = expectRoot ? expectRoot.toLowerCase() === c.r.toLowerCase() : null;
  return {
    found: true,
    id: null,
    ok: ok && rootMatches !== false,
    brokenAt: ok ? null : c.a.length,
    rootMatches,
    caseId: c.c,
    sealedAt: c.t,
    sealedBy: c.b,
    rootHash: c.r,
    artefacts: c.a.map(([name, kind, sha256], i) => ({ n: i + 1, name, kind, synthetic: false, bytes: 0, sha256, chain: chain[i] ?? null, summary: "" })),
  };
}

function Inner() {
  const params = useSearchParams();
  const packId = params.get("pack");
  const root = params.get("root");
  const [text, setText] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"server" | "carried" | "pasted" | null>(null);

  async function byId(id: string) {
    setBusy(true);
    setError(null);
    const carried = typeof window !== "undefined" ? decodeCarried(window.location.hash) : null;
    try {
      const r = await fetch(`/api/verify?pack=${encodeURIComponent(id)}${root ? `&root=${encodeURIComponent(root)}` : ""}`, { cache: "no-store" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "verification failed");
      setRes(b as Result);
      setSource("server");
    } catch (e) {
      // this server has no record of the pack (a copy sealed elsewhere): the code itself carries the hashes
      if (carried) {
        setRes(await verifyCarried(carried, root));
        setSource("carried");
      } else {
        setRes(null);
        setError(e instanceof Error ? e.message : "verification failed");
      }
    } finally {
      setBusy(false);
    }
  }
  async function byText() {
    setBusy(true);
    setError(null);
    try {
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error("that is not valid JSON — paste the whole JSON bundle exported from Evidence");
      }
      const r = await fetch(`/api/verify${root ? `?root=${encodeURIComponent(root)}` : ""}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "verification failed");
      setRes(b as Result);
      setSource("pasted");
    } catch (e) {
      setRes(null);
      setError(e instanceof Error ? e.message : "verification failed");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (packId) {
      const t = setTimeout(() => byId(packId), 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  const verdictTone = res ? (res.ok ? "border-[#1c5943] bg-[#08170f] text-green" : "border-[#652225] bg-[#1a0c0e] text-red") : "";

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="max-w-[860px] mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[22px] font-extrabold tracking-[0.18em]">OFF<span className="text-amber">RAMP</span></div>
            <div className="hlabel text-[8.5px] mt-1">evidence pack verification · public</div>
          </div>
          <Link href="/" className="mono text-[9.5px] tracking-[0.12em] uppercase text-mut hover:text-ink mt-2">about OFFRAMP →</Link>
        </div>

        <h1 className="text-[24px] font-bold leading-tight mt-8">Check an evidence pack yourself.</h1>
        <p className="c-body mt-2 max-w-2xl">
          Every artefact in a sealed pack is hashed with SHA-256 and the hashes are chained in order, so a single altered byte changes the root. This page recomputes that chain from the pack&apos;s own record and tells you whether it still holds. No account is needed and no artefact content is shown.
        </p>

        {packId && (
          <div className="mt-6 border border-line bg-panel px-4 py-3 mono text-[11px] text-mut">
            pack <span className="text-ink">{packId}</span>{root ? <> · root printed on the document <span className="text-ink break-all">{root}</span></> : null}
          </div>
        )}

        {res && (
          <div className={`mt-6 border px-5 py-4 ${verdictTone}`}>
            <div className="mono text-[9.5px] tracking-[0.16em] uppercase font-bold opacity-80">verdict</div>
            <div className="text-[26px] font-extrabold leading-tight mt-1">
              {res.ok ? "Intact — the chain recomputes to the recorded root" : res.rootMatches === false ? "Mismatch — this pack's root is not the one printed on the document" : `Broken — the chain fails at artefact ${res.brokenAt === null ? "?" : res.brokenAt + 1}`}
            </div>
            <div className="mono text-[11px] mt-2 opacity-90">
              case {res.caseId} · sealed {res.sealedAt.replace("T", " ").slice(0, 19)} UTC by {res.sealedBy} · {res.artefacts.length} artefacts
              {res.rootMatches === true ? " · root matches the document" : ""}
            </div>
            <div className="mono text-[10px] mt-1 opacity-70">
              {source === "server" ? "recomputed from this server's sealed record" : source === "carried" ? "recomputed in your browser from the hashes carried inside the code on the document" : "recomputed from the pasted bundle"}
            </div>
          </div>
        )}
        {error && <div className="mt-6 border border-[#652225] bg-[#1a0c0e] text-red px-4 py-3 text-[13px]">{error}</div>}

        {res && (
          <div className="mt-6 border border-line bg-rail">
            <div className="px-5 py-3 border-b border-line flex items-center justify-between"><span className="c-label">Chain</span><span className="mono text-[10px] text-faint">hᵢ = sha256(hᵢ₋₁ ∥ aᵢ)</span></div>
            {res.artefacts.map((a) => {
              const bad = res.brokenAt !== null && a.n - 1 >= res.brokenAt;
              return (
                <div key={a.n} className={`px-5 py-3 border-b border-line2 grid grid-cols-[28px_minmax(0,1fr)] gap-3 ${bad ? "bg-[#1a0c0e]" : ""}`}>
                  <span className={`mono text-[12px] font-bold ${bad ? "text-red" : "text-mut"}`}>{a.n}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="mono text-[12.5px] text-ink/90">{a.name}</span>
                      <span className="mono text-[9px] tracking-[0.12em] uppercase text-faint border border-line px-1.5 py-0.5">{a.kind}</span>
                      {a.synthetic && <span className="mono text-[9px] tracking-[0.12em] uppercase text-faint border border-line px-1.5 py-0.5">synthetic</span>}
                      {a.bytes > 0 && <span className="mono text-[10px] text-faint ml-auto">{a.bytes.toLocaleString()} B</span>}
                    </div>
                    <div className="mono text-[10px] text-mut break-all mt-1">sha256 {a.sha256}</div>
                    <div className={`mono text-[10px] break-all ${bad ? "text-red" : "text-faint"}`}>chain {a.chain ?? "—"}</div>
                  </div>
                </div>
              );
            })}
            <div className="px-5 py-3 flex items-baseline gap-3 flex-wrap">
              <span className="c-kv">root</span>
              <span className={`mono text-[11.5px] break-all ${res.ok ? "text-green" : "text-red"}`}>{res.rootHash}</span>
            </div>
          </div>
        )}

        <div className="mt-8">
          <div className="c-label mb-2">Or paste the JSON bundle</div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} rows={7} placeholder='{"pack": {"caseId": …, "artefacts": […], "chain": […], "rootHash": "…"}}' className="mono w-full bg-panel border border-line p-3 text-[11.5px] outline-none focus:border-amber/60 resize-y placeholder:text-faint" />
          <div className="mt-2 flex items-center gap-3">
            <button onClick={byText} disabled={busy || !text.trim()} className="mono text-[10.5px] tracking-[0.14em] uppercase font-extrabold bg-amber text-[#12100c] px-4 h-[38px] disabled:opacity-40">{busy ? "verifying…" : "verify pasted pack"}</button>
            <span className="c-note">the bundle is the “JSON bundle” export on the Evidence screen · edit one character of any hash and verify again to watch the chain break</span>
          </div>
        </div>

        <div className="mt-10 c-note max-w-2xl">
          What this proves: the record has not been altered since it was sealed, and it is the same record the certificate refers to. What it does not prove: the truth of the artefacts themselves, which is the investigation&apos;s job. Drafts have no evidentiary effect until signed by the persons the law requires.
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
