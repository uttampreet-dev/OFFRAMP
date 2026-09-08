import { existsSync, readFileSync } from "fs";
import path from "path";
import { canonical, sha256, newId } from "../intercept";
import { traceFlow } from "../trace/engine";
import { redFlags } from "../detectors";
import { correlate } from "../bridge/correlate";
import { parseStatement } from "../bridge/parse";
import { DEMO_CHAIN_EVENTS, DEMO_STATEMENT_CSV, DEMO_CASHOUT_WALLET } from "../bridge/sample";
import { packetsForCase, savePack, audit, auditForCase, packsForCase, type PacketRow } from "../db";

export interface Artefact {
  name: string;
  kind: "trace" | "redflags" | "bridge" | "packet" | "statement";
  synthetic: boolean;
  sha256: string;
  bytes: number;
  summary: string;
  body: unknown;
}
export interface PackManifest {
  packVersion: 1;
  caseId: string;
  sealedAt: string;
  sealedBy: string;
  artefacts: Omit<Artefact, "body">[];
  /** chain: h0 = sha256(a0), hi = sha256(h(i-1) + ai) */
  chain: string[];
  rootHash: string;
}

export async function assembleArtefacts(caseId: string, address: string, demo: boolean): Promise<Artefact[]> {
  const out: Artefact[] = [];
  const add = (name: string, kind: Artefact["kind"], synthetic: boolean, summary: string, body: unknown) => {
    const s = canonical(body);
    out.push({ name, kind, synthetic, sha256: sha256(s), bytes: Buffer.byteLength(s), summary, body });
  };
  if (demo) {
    const st = parseStatement(DEMO_STATEMENT_CSV, { account: "XXXXXX4471", synthetic: true, source: "demonstration statement" });
    const br = correlate(DEMO_CHAIN_EVENTS, st, { chainSynthetic: true });
    add("bridge_correlation.json", "bridge", true, `best linkage ${br.best ? Math.round(br.best.strength * 1000) / 10 : 0}% · ${br.linkages.length} candidates`, br);
    add("bank_statement_4471.csv", "statement", true, `${st.rows.length} rows · ${st.credits.length} credits · synthetic`, DEMO_STATEMENT_CSV);
    add("chain_events.json", "trace", true, `${DEMO_CHAIN_EVENTS.length} synthetic on-chain events · case narrative`, DEMO_CHAIN_EVENTS);
  } else {
    const [tr, rf] = await Promise.all([traceFlow(address, { depth: 2, fanout: 5 }), redFlags(address, { depth: 2 })]);
    add("trace_graph.json", "trace", false, `${tr.nodes.length} nodes · ${tr.edges.length} edges · ${tr.stats.hopsReached} hops · live`, tr);
    add("detector_findings.json", "redflags", false, `${rf.fired} of 10 fired · live`, rf);
  }
  for (const p of packetsForCase(caseId)) {
    add(`freeze_packet_${p.id}.json`, "packet", false, `sealed by ${p.created_by} · ${p.sha256.slice(0, 12)}…`, JSON.parse(p.body));
  }
  return out;
}

export function sealPack(caseId: string, by: string, artefacts: Artefact[]): PackManifest & { id: string } {
  const chain: string[] = [];
  let prev = "";
  for (const a of artefacts) {
    prev = sha256(prev + a.sha256);
    chain.push(prev);
  }
  const manifest: PackManifest = {
    packVersion: 1,
    caseId,
    sealedAt: new Date().toISOString(),
    sealedBy: by,
    artefacts: artefacts.map(({ body: _b, ...rest }) => rest),
    chain,
    rootHash: prev || sha256(""),
  };
  const id = newId("PACK");
  savePack({ id, case_id: caseId, manifest: JSON.stringify(manifest), root_hash: manifest.rootHash, created_by: by, created_at: Date.now() });
  audit(by, "pack.sealed", `case=${caseId} pack=${id} root=${manifest.rootHash.slice(0, 12)} artefacts=${artefacts.length}`);
  return { ...manifest, id };
}

export function verifyManifest(m: PackManifest): { ok: boolean; brokenAt: number | null } {
  let prev = "";
  for (let i = 0; i < m.artefacts.length; i++) {
    prev = sha256(prev + m.artefacts[i].sha256);
    if (prev !== m.chain[i]) return { ok: false, brokenAt: i };
  }
  return { ok: prev === m.rootHash, brokenAt: prev === m.rootHash ? null : m.artefacts.length };
}

export function caseState(caseId: string) {
  return { packets: packetsForCase(caseId), packs: packsForCase(caseId), audit: auditForCase(caseId) };
}

/* ── document rendering: teammate's templates if present, built-in otherwise ── */
function template(name: string): string | null {
  const f = path.join(process.cwd(), "src", "templates", name);
  return existsSync(f) ? readFileSync(f, "utf8") : null;
}
function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}
const CSS = `<style>body{font:14px/1.5 Georgia,serif;color:#111;max-width:820px;margin:40px auto;padding:0 24px}h1{font-size:22px;margin:0 0 4px}h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#666;margin:28px 0 8px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:7px 8px;border-bottom:1px solid #ddd;vertical-align:top}th{width:220px;color:#555;font-weight:600}.mono{font-family:Menlo,Consolas,monospace;font-size:12.5px}.draft{display:inline-block;border:1px solid #b45309;color:#b45309;padding:3px 8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase}.sig{margin-top:56px;display:flex;justify-content:space-between}.sig div{width:44%;border-top:1px solid #333;padding-top:6px;font-size:12px;color:#444}.note{font-size:12px;color:#666;margin-top:18px}</style>`;

export function renderSTR(vars: Record<string, string>): string {
  const t = template("str.html");
  if (t) return fill(t, vars);
  return `<!doctype html><meta charset="utf-8"><title>STR draft · ${vars.caseId}</title>${CSS}
<span class="draft">Draft — requires principal officer signature</span>
<h1>Suspicious Transaction Report</h1><div>Financial Intelligence Unit — India · reporting format (draft prepared by investigation console)</div>
<h2>Reporting entity</h2><table><tr><th>Entity</th><td>${vars.reportingEntity}</td></tr><tr><th>Principal officer</th><td>${vars.principalOfficer}</td></tr><tr><th>Report reference</th><td class="mono">${vars.reference}</td></tr><tr><th>Date</th><td>${vars.date}</td></tr></table>
<h2>Subject</h2><table><tr><th>Wallet address</th><td class="mono">${vars.subjectWallet}</td></tr><tr><th>Chain / asset</th><td>${vars.chainAsset}</td></tr><tr><th>Linked account (candidate)</th><td class="mono">${vars.linkedAccount}</td></tr><tr><th>Attribution</th><td>${vars.attribution}</td></tr></table>
<h2>Transaction</h2><table><tr><th>Amount</th><td>${vars.amount}</td></tr><tr><th>INR estimate</th><td>${vars.inr}</td></tr><tr><th>Period</th><td>${vars.period}</td></tr><tr><th>Transaction id</th><td class="mono">${vars.txid}</td></tr></table>
<h2>Grounds for suspicion</h2><div>${vars.grounds}</div>
<h2>Attached evidence</h2><div class="mono">${vars.evidence}</div>
<p class="note">Prepared by OFFRAMP on ${vars.date}. Correlation between wallet and account is a candidate linkage by amount and timing; it is not evidence of ownership. This draft does not constitute a filing.</p>
<div class="sig"><div>Principal Officer</div><div>Date</div></div>`;
}

export function renderS63(vars: Record<string, string>): string {
  const t = template("bsa63.html");
  if (t) return fill(t, vars);
  return `<!doctype html><meta charset="utf-8"><title>Section 63 certificate · ${vars.caseId}</title>${CSS}
<span class="draft">Certificate content — to be signed by the person in charge of the device and by an expert where required</span>
<h1>Certificate under Section 63, Bharatiya Sakshya Adhiniyam, 2023</h1><div>Electronic record produced by a computer output — identification and integrity</div>
<h2>Electronic record</h2><table><tr><th>Description</th><td>${vars.recordDescription}</td></tr><tr><th>Case reference</th><td class="mono">${vars.caseId}</td></tr><tr><th>Evidence pack id</th><td class="mono">${vars.packId}</td></tr><tr><th>Root hash (SHA-256)</th><td class="mono">${vars.rootHash}</td></tr><tr><th>Artefacts</th><td class="mono">${vars.artefacts}</td></tr></table>
<h2>Device and process</h2><table><tr><th>System</th><td>${vars.deviceProcess}</td></tr><tr><th>Produced on</th><td>${vars.date}</td></tr><tr><th>Produced by (user)</th><td>${vars.officerName}</td></tr><tr><th>Regular use</th><td>The record was produced by the system in the ordinary course of its use for the investigation identified above; the system was operating properly at the material time so far as the signatory is aware.</td></tr></table>
<h2>Integrity</h2><p>Each artefact was hashed with SHA-256 and chained in sequence; the root hash above changes if any artefact is altered. Hashes were recomputed at the time of this certificate and matched the sealed manifest: <b>${vars.verified}</b>.</p>
<p class="note">This document states the matters the certificate must address. It is not signed and has no evidentiary effect until signed by the persons the section requires.</p>
<div class="sig"><div>Person in charge of the system</div><div>Expert (where applicable)</div></div>`;
}
