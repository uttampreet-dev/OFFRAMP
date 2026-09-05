import { caseDetail, type TimelineItem } from "./cases";
import { packById, type CaseRow } from "./db";
import { traceFlow, type TraceResult } from "./trace/engine";
import { redFlags, type RedFlagReport } from "./detectors";
import { lookupAddress } from "./chains";
import { isSanctioned, ofacIndex } from "./ofac";
import { isReported } from "./board";
import { knownEntity } from "./trace/labels";
import { riskScore, type RiskScore } from "./risk";
import { correlate, type BridgeResult } from "./bridge/correlate";
import { parseStatement } from "./bridge/parse";
import { DEMO_CHAIN_EVENTS, DEMO_STATEMENT_CSV, DEMO_CASHOUT_WALLET } from "./bridge/sample";
import { verifyManifest, type PackManifest } from "./evidence";
import { sha256 } from "./intercept";

/*
 * Investigation report: one printable document per case that gathers what the console
 * knows — subject screening and risk, the traced fund flow, the detector findings, the
 * cash-out linkage, the unified timeline, every sealed artefact and every officer action —
 * with the limitations and the data sources stated on the page. The body is hashed so a
 * printed copy can be matched to the one the console produced.
 */

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (v: number, d = 2) => v.toLocaleString("en-IN", { maximumFractionDigits: v < 1 ? 5 : d });
const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
const ist = (ts: number) => new Date(ts + 5.5 * 3600_000).toISOString().replace("T", " ").slice(0, 16) + " IST";
const shortA = (a: string) => `${a.slice(0, 10)}…${a.slice(-8)}`;
const BUDGET_MS = 20_000;

function within<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${what} did not finish inside ${ms / 1000} s`)), ms))]);
}

export interface ReportInput {
  c: CaseRow;
  generatedBy: string;
  timeline: TimelineItem[];
  packets: { id: string; sha256: string; at: number; by: string; approvedBy: string | null; approvedAt: number | null }[];
  packs: { id: string; rootHash: string; at: number; by: string; artefacts: number; verified: boolean }[];
  risk: RiskScore;
  screening: { sanctioned: boolean; listSize: number; syncedAt: string | null; reported: { source: string; category: string } | null; entity: { entity: string; type: string; source: string } | null };
  trace: TraceResult | null;
  flags: RedFlagReport | null;
  bridge: BridgeResult | null;
  notes: string[];
}

export async function collectReport(caseId: string, generatedBy: string): Promise<ReportInput | null> {
  const d = await caseDetail(caseId);
  if (!d) return null;
  const c = d.c;
  const demo = !!c.synthetic && c.seed === DEMO_CASHOUT_WALLET;
  const notes: string[] = [];
  const idx = ofacIndex();
  const ent = knownEntity(c.seed);
  const screening = {
    sanctioned: isSanctioned(c.seed),
    listSize: idx.set.size,
    syncedAt: idx.syncedAt,
    reported: isReported(c.seed),
    entity: ent ? { entity: ent.entity, type: ent.type, source: ent.source } : null,
  };

  let trace: TraceResult | null = null;
  let flags: RedFlagReport | null = null;
  let bridge: BridgeResult | null = null;
  let risk: RiskScore;
  if (demo) {
    const st = parseStatement(DEMO_STATEMENT_CSV, { account: "XXXXXX4471", synthetic: true, source: "demonstration statement" });
    bridge = correlate(DEMO_CHAIN_EVENTS, st, { chainSynthetic: true });
    risk = riskScore(c.seed, []);
    notes.push("This case is the demonstration narrative: its on-chain events and the bank statement are synthetic and labelled so. No public-chain trace or detector run applies to a synthetic wallet, so those sections carry the narrative events instead.");
  } else {
    const [tr, rf, lk] = await Promise.all([
      within(traceFlow(c.seed, { depth: 2, fanout: 5 }), BUDGET_MS, "fund-flow trace").catch((e: Error) => { notes.push(`Fund flow: ${e.message}.`); return null; }),
      within(redFlags(c.seed, { depth: 2 }), BUDGET_MS, "detector run").catch((e: Error) => { notes.push(`Red-flag indicators: ${e.message}.`); return null; }),
      within(lookupAddress(c.seed), BUDGET_MS, "wallet lookup").catch(() => null),
    ]);
    trace = tr;
    flags = rf;
    risk = riskScore(c.seed, lk?.transfers ?? [], rf?.findings);
    notes.push("No bank statement is attached to this case. Bridge accepts a statement CSV and reports candidate linkages; none are included here.");
  }
  const packs = d.packs.map((p) => {
    const row = packById(p.id);
    const m = row ? (JSON.parse(row.manifest) as PackManifest) : null;
    return { ...p, artefacts: m?.artefacts.length ?? 0, verified: m ? verifyManifest(m).ok : false };
  });
  return { c, generatedBy, timeline: d.timeline, packets: d.packets, packs, risk, screening, trace, flags, bridge, notes };
}

const CSS = `<style>
@page{margin:16mm}
body{font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#111827;background:#fff;max-width:860px;margin:32px auto;padding:0 28px}
h1{font-size:21px;margin:0 0 2px;letter-spacing:.01em}
h2{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:#4b5563;margin:30px 0 8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
.sub{color:#4b5563;font-size:12.5px;margin-bottom:18px}
.tag{display:inline-block;border:1px solid #b45309;color:#b45309;padding:2px 8px;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;margin-right:6px;vertical-align:middle}
.tag.red{border-color:#991b1b;color:#991b1b}.tag.grey{border-color:#6b7280;color:#6b7280}.tag.teal{border-color:#0e7490;color:#0e7490}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;word-break:break-all}
table{width:100%;border-collapse:collapse;font-size:12.5px}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}th{color:#4b5563;font-weight:600;white-space:nowrap}
.kv th{width:200px}
.score{display:inline-block;font-weight:800;font-size:20px;margin-right:8px}
.band{display:inline-block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;padding:2px 8px;border:1px solid}
.low{color:#166534;border-color:#86efac}.elevated{color:#92400e;border-color:#fcd34d}.high{color:#9a3412;border-color:#fdba74}.critical{color:#991b1b;border-color:#fca5a5}
.muted{color:#6b7280}.small{font-size:11.5px}
ul{padding-left:18px;margin:6px 0}li{margin:3px 0}
.foot{margin-top:36px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280}
.sig{margin-top:44px;display:flex;justify-content:space-between}.sig div{width:44%;border-top:1px solid #333;padding-top:6px;font-size:12px;color:#444}
.no-print{margin:0 0 18px}.no-print button{font:12px -apple-system,sans-serif;padding:6px 12px;border:1px solid #d1d5db;background:#f9fafb;cursor:pointer}
@media print{.no-print{display:none}body{margin:0;padding:0}}
</style>`;

export function renderReport(r: ReportInput): string {
  const { c } = r;
  const demo = !!c.synthetic;
  const gen = new Date();
  const parts: string[] = [];
  const kindLabel: Record<TimelineItem["kind"], string> = { chain: "chain", statement: "bank", alert: "alert", packet: "packet", pack: "pack", audit: "action", opened: "case" };

  parts.push(`<div class="no-print"><button onclick="window.print()">Print / save as PDF</button></div>`);
  parts.push(`<div><span class="tag">draft · investigation use</span>${demo ? `<span class="tag grey">synthetic demonstration case</span>` : `<span class="tag teal">live public chain data</span>`}</div>`);
  parts.push(`<h1 style="margin-top:10px">Investigation report · ${esc(c.id)}</h1>`);
  parts.push(`<div class="sub">${esc(c.title)}</div>`);
  parts.push(`<table class="kv"><tr><th>Case</th><td class="mono">${esc(c.id)} · status ${esc(c.status)}</td></tr><tr><th>Opened</th><td>${ist(c.created_at)} by ${esc(c.officer)}</td></tr><tr><th>Generated</th><td>${ist(gen.getTime())} by ${esc(r.generatedBy)} · OFFRAMP investigation console</td></tr><tr><th>Subject wallet</th><td class="mono">${esc(c.seed)} · ${esc(c.chain.toUpperCase())}</td></tr></table>`);

  // 1 · screening + risk
  parts.push(`<h2>1 · Subject screening and risk</h2>`);
  const s = r.screening;
  parts.push(`<table class="kv">
<tr><th>OFAC SDN</th><td>${s.sanctioned ? `<b style="color:#991b1b">listed</b>` : "not listed"} <span class="muted small">· ${s.listSize.toLocaleString("en-IN")} digital-currency addresses${s.syncedAt ? ` · list synced ${esc(s.syncedAt.slice(0, 10))}` : ""}</span></td></tr>
<tr><th>Reported-address index</th><td>${s.reported ? `<b>${esc(s.reported.category)}</b> <span class="muted small">· ${esc(s.reported.source)}</span>` : "no report"}</td></tr>
<tr><th>Known entity</th><td>${s.entity ? `${esc(s.entity.entity)} · ${esc(s.entity.type)} <span class="muted small">· <a href="${esc(s.entity.source)}">${esc(s.entity.source)}</a></span>` : "unattributed — no publicly documented owner"}</td></tr>
<tr><th>Risk score</th><td><span class="score">${r.risk.score}</span><span class="band ${r.risk.band}">${r.risk.band}</span><div class="muted small" style="margin-top:4px">${esc(r.risk.note)}</div></td></tr></table>`);
  if (r.risk.factors.length) {
    parts.push(`<table style="margin-top:8px"><tr><th>Points</th><th>Factor</th><th>Evidence</th><th>Rule</th></tr>${r.risk.factors.map((f) => `<tr><td class="mono">+${f.points}</td><td>${esc(f.label)}</td><td class="small">${esc(f.evidence)}</td><td class="small muted">${esc(f.rule)}</td></tr>`).join("")}</table>`);
  }

  // 2 · fund flow
  parts.push(`<h2>2 · Fund flow</h2>`);
  if (r.trace) {
    const t = r.trace;
    const seedEdges = t.edges.filter((e) => (t.direction === "out" ? e.from === t.seed : e.to === t.seed)).sort((a, b) => b.value - a.value).slice(0, 8);
    const total = seedEdges.reduce((x, e) => x + e.value, 0) || 1e-9;
    const sym = t.nodes[0]?.symbol ?? "";
    const stops = t.nodes.filter((n) => n.hop > 0 && (n.sanctioned || n.entity));
    parts.push(`<div class="small muted">downstream from the subject · depth ${t.depth} · fan-out ${t.fanout} · ${t.nodes.length} wallets, ${t.edges.length} edges, ${t.stats.hopsReached} hop${t.stats.hopsReached === 1 ? "" : "s"} reached · ${t.stats.requests} chain requests, ${t.stats.fromCache} from cache · ${(t.stats.ms / 1000).toFixed(1)} s</div>`);
    parts.push(`<table style="margin-top:8px"><tr><th>Counterparty</th><th>Value</th><th>Share</th><th>Transfers</th><th>Label</th></tr>${seedEdges
      .map((e) => {
        const other = t.direction === "out" ? e.to : e.from;
        const n = t.nodes.find((x) => x.address === other);
        return `<tr><td class="mono">${esc(other)}</td><td class="mono">${num(e.value)} ${esc(sym)}</td><td class="mono">${((e.value / total) * 100).toFixed(1)}%</td><td class="mono">${e.count}</td><td>${n?.sanctioned ? `<span class="tag red">OFAC SDN</span>` : ""}${n?.entity ? `${esc(n.entity.entity)} · ${esc(n.entity.type)}` : n?.sanctioned ? "" : `<span class="muted">intermediary</span>`}</td></tr>`;
      })
      .join("")}</table>`);
    if (stops.length) {
      parts.push(`<div style="margin-top:10px"><b>Wallets of note reached</b></div><table><tr><th>Wallet</th><th>Hop</th><th>Why it matters</th><th>Source</th></tr>${stops.map((n) => `<tr><td class="mono">${esc(n.address)}</td><td class="mono">${n.hop}</td><td>${n.sanctioned ? "OFAC SDN-listed" : ""}${n.sanctioned && n.entity ? " · " : ""}${n.entity ? `${esc(n.entity.entity)} (${esc(n.entity.type)})` : ""}</td><td class="small">${n.entity ? `<a href="${esc(n.entity.source)}">${esc(n.entity.source)}</a>` : n.sanctioned ? "OFAC SDN list" : ""}</td></tr>`).join("")}</table>`);
    } else parts.push(`<div class="small muted" style="margin-top:8px">no sanctioned wallet and no publicly attributed entity inside the traced neighbourhood</div>`);
  } else if (r.bridge) {
    parts.push(`<div class="small muted">synthetic on-chain events of the demonstration narrative</div><table style="margin-top:8px"><tr><th>Time</th><th>From</th><th>To</th><th>Value</th><th>Note</th></tr>${r.bridge.events.map((e) => `<tr><td class="mono">${ist(e.ts)}</td><td class="mono">${shortA(e.from)}</td><td class="mono">${shortA(e.to)}</td><td class="mono">${num(e.value)} ${esc(e.symbol)}</td><td>${esc(e.note)}</td></tr>`).join("")}</table>`);
  } else parts.push(`<div class="small muted">not available for this report — see the notes at the end</div>`);

  // 3 · red flags
  parts.push(`<h2>3 · Red-flag indicators (FATF virtual-asset indicators)</h2>`);
  if (r.flags) {
    const f = r.flags;
    parts.push(`<div class="small muted">${f.fired} of ${f.findings.length} fired · ${f.stats.transfersExamined.toLocaleString("en-IN")} transfers examined across ${f.stats.hopsExamined} hop${f.stats.hopsExamined === 1 ? "" : "s"}</div>`);
    parts.push(`<table style="margin-top:8px"><tr><th>Indicator</th><th>FATF ref.</th><th>Severity</th><th>Result</th><th>Finding</th></tr>${f.findings
      .map((x) => `<tr><td>${esc(x.name)}</td><td class="small muted">${esc(x.fatf)}</td><td class="small">${esc(x.severity)}</td><td>${x.fired ? `<b style="color:#991b1b">fired</b> <span class="mono small">${Math.round(x.confidence * 100)}%</span>` : `<span class="muted">clear</span>`}</td><td class="small">${esc(x.summary)}${x.fired && x.evidence.length ? `<ul class="small muted">${x.evidence.slice(0, 3).map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}</td></tr>`)
      .join("")}</table>`);
  } else parts.push(`<div class="small muted">${demo ? "not run — the subject is a synthetic wallet; the narrative shows a three-way split reconsolidated within twenty-six minutes, the pattern the rapid-layering indicator targets" : "not available for this report — see the notes at the end"}</div>`);

  // 4 · cash-out linkage
  parts.push(`<h2>4 · Cash-out linkage (crypto → INR)</h2>`);
  if (r.bridge?.best) {
    const b = r.bridge.best;
    parts.push(`<table class="kv">
<tr><th>Statement</th><td>A/C ${esc(r.bridge.account)} · ${r.bridge.credits.length} credits examined${r.bridge.statementSynthetic ? ` <span class="tag grey">synthetic</span>` : ""}</td></tr>
<tr><th>On-chain event</th><td class="mono">${num(b.event.value)} ${esc(b.event.symbol)} · ${ist(b.event.ts)} · tx ${esc(b.event.txid.slice(0, 16))}…</td></tr>
<tr><th>INR credit</th><td class="mono">${inr(b.credit.credit)} · ${ist(b.credit.ts)} · ${esc(b.credit.narration)}</td></tr>
<tr><th>Expected at reference rate</th><td class="mono">${inr(b.expectedInr)} <span class="muted small">· ${num(b.fx.rate)} INR per ${esc(b.event.symbol)} · ${esc(b.fx.source)}</span></td></tr>
<tr><th>Agreement</th><td class="mono">Δ ${(b.deltaPct * 100).toFixed(2)}% on amount · Δt ${Math.round(b.deltaMs / 60000)} min</td></tr>
<tr><th>Candidate linkage</th><td><b>${(b.strength * 100).toFixed(1)}%</b> <span class="muted small">· ${r.bridge.linkages.length} candidates scored inside a ${r.bridge.windowHours} h window at ±${r.bridge.tolerancePct}% · geometric mean of amount and time agreement · a candidate, not a finding of ownership</span></td></tr></table>`);
  } else parts.push(`<div class="small muted">no statement linked to this case</div>`);

  // 5 · timeline
  parts.push(`<h2>5 · Timeline · ${r.timeline.length} entries</h2>`);
  parts.push(`<table><tr><th>When</th><th>Source</th><th>Entry</th><th>By</th></tr>${r.timeline
    .map((t) => `<tr${t.key ? ' style="background:#fffbeb"' : ""}><td class="mono">${ist(t.at)}</td><td class="small">${kindLabel[t.kind]}${t.synthetic ? ` <span class="muted">(synthetic)</span>` : ""}</td><td>${t.key ? "<b>" : ""}${esc(t.title)}${t.key ? "</b>" : ""}${t.kind === "chain" && t.value !== undefined ? ` <span class="mono">${num(t.value)} ${esc(t.symbol ?? "")}</span>` : ""}<div class="small muted mono">${esc(t.detail)}</div></td><td class="small">${esc(t.by)}</td></tr>`)
    .join("")}</table>`);

  // 6 · sealed artefacts
  parts.push(`<h2>6 · Sealed artefacts</h2>`);
  if (r.packets.length || r.packs.length) {
    parts.push(`<table><tr><th>Artefact</th><th>Hash</th><th>Sealed</th><th>Status</th></tr>${r.packets.map((p) => `<tr><td>freeze packet <span class="mono">${esc(p.id)}</span></td><td class="mono small">sha256 ${esc(p.sha256)}</td><td class="small">${ist(p.at)} · ${esc(p.by)}</td><td class="small">${p.approvedBy ? `signed off by ${esc(p.approvedBy)} · ${ist(p.approvedAt!)}` : "awaiting supervisor sign-off"}</td></tr>`).join("")}${r.packs.map((p) => `<tr><td>evidence pack <span class="mono">${esc(p.id)}</span> · ${p.artefacts} artefacts</td><td class="mono small">root ${esc(p.rootHash)}</td><td class="small">${ist(p.at)} · ${esc(p.by)}</td><td class="small">${p.verified ? "hash chain verified" : "<b style='color:#991b1b'>hash chain FAILED verification</b>"}</td></tr>`).join("")}</table>`);
    parts.push(`<div class="small muted" style="margin-top:6px">Packets are prepared requests: OFFRAMP does not freeze funds and does not transmit them. Packs chain artefact hashes in sequence (hᵢ = sha256(hᵢ₋₁ ∥ aᵢ)); the s.63 BSA 2023 certificate and the FIU-IND STR draft are exported from Evidence.</div>`);
  } else parts.push(`<div class="small muted">nothing sealed yet on this case</div>`);

  // 7 · limitations + sources
  parts.push(`<h2>7 · Limitations and data sources</h2>`);
  parts.push(`<ul class="small">
<li>Every wallet-to-wallet relationship here is a property of public ledger data and heuristics; none is proof of ownership, control or guilt.</li>
<li>Traces follow the largest counterparties to a bounded depth and stop at publicly attributed entities; value is aggregated per edge, not tracked per coin.</li>
<li>Detector confidences are heuristic strengths, not probabilities. Sanctions checks use the OFAC SDN digital-currency list only; other lists are not screened.</li>
<li>Cash-out linkage compares amounts at a reference rate and times inside a window; it produces candidates for an investigator to test with the bank's own records.</li>
<li>Entity attribution is included only where a public source is cited. Synthetic data is labelled wherever it appears.</li>
${r.notes.map((n) => `<li>${esc(n)}</li>`).join("")}
</ul>
<div class="small muted">Sources: Blockstream Esplora (Bitcoin) · Etherscan API (Ethereum) · TronGrid (TRON, TRC-20) · OFAC Specially Designated Nationals list, digital-currency addresses · CryptoScamDB reported addresses · entity attributions with the public source printed beside each.</div>`);

  parts.push(`<div class="sig"><div>Investigating officer · name, rank, signature</div><div>Supervising officer · name, rank, signature</div></div>`);
  const body = parts.join("\n");
  const hash = sha256(body);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Investigation report · ${esc(c.id)}</title>${CSS}</head><body>${body}<div class="foot">Report body sha256 <span class="mono">${hash}</span> · generated ${gen.toISOString()} · OFFRAMP investigation console</div></body></html>`;
}
