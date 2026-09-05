import type { Transfer } from "./chains/types";
import { isSanctioned } from "./ofac";
import { knownEntity } from "./trace/labels";
import { isReported } from "./board";

/* An explainable risk score: additive, bounded, every point tied to a named rule and its evidence.
   It ranks wallets for attention. It is not a probability and it is not a verdict. */
export interface RiskFactor { key: string; label: string; points: number; evidence: string; rule: string }
export type RiskBand = "low" | "elevated" | "high" | "critical";
export interface RiskScore { score: number; band: RiskBand; factors: RiskFactor[]; detectorsIncluded: boolean; note: string }

export function bandOf(score: number): RiskBand {
  return score >= 80 ? "critical" : score >= 50 ? "high" : score >= 20 ? "elevated" : "low";
}

interface FindingLite { id: string; name: string; fired: boolean; severity: "high" | "medium" | "info"; summary: string; fatf: string }

export function riskScore(address: string, transfers: Transfer[], findings?: FindingLite[]): RiskScore {
  const f: RiskFactor[] = [];
  const a = address.trim();
  if (isSanctioned(a)) f.push({ key: "sdn", label: "OFAC SDN listing", points: 60, evidence: "address appears on the OFAC digital-currency sanctions list", rule: "sanctions screening" });
  const rep = isReported(a);
  if (rep) f.push({ key: "report", label: "community report", points: 20, evidence: `reported as ${rep.category} on ${rep.source} — a report, not a finding`, rule: "community blacklist" });
  const ent = knownEntity(a);
  if (ent?.type === "mixer") f.push({ key: "mixer-self", label: "mixer contract", points: 30, evidence: `${ent.entity} · public source`, rule: "known-entity list" });

  /* exposure: who this wallet actually transacts with */
  const cps = new Map<string, Transfer>();
  for (const t of transfers) {
    const other = t.direction === "in" ? t.from : t.to;
    if (other && other !== a && !cps.has(other)) cps.set(other, t);
  }
  const sdnCps = [...cps.keys()].filter((c) => isSanctioned(c));
  if (sdnCps.length) f.push({ key: "sdn-exposure", label: `${sdnCps.length} sanctioned counterpart${sdnCps.length === 1 ? "y" : "ies"}`, points: sdnCps.length >= 3 ? 35 : 25, evidence: sdnCps.slice(0, 3).map((c) => `${c.slice(0, 8)}…${c.slice(-4)}`).join(" · "), rule: "direct exposure to OFAC-listed addresses" });
  const mixCps = [...cps.keys()].filter((c) => knownEntity(c)?.type === "mixer");
  if (mixCps.length) f.push({ key: "mixer-exposure", label: "mixer counterparty", points: 15, evidence: mixCps.slice(0, 2).map((c) => knownEntity(c)!.entity).join(" · "), rule: "known-entity list" });
  const repCps = [...cps.keys()].filter((c) => isReported(c));
  if (repCps.length) f.push({ key: "report-exposure", label: `${repCps.length} reported counterpart${repCps.length === 1 ? "y" : "ies"}`, points: 8, evidence: repCps.slice(0, 3).map((c) => `${c.slice(0, 8)}…`).join(" · "), rule: "community blacklist" });

  /* detectors, when a Red Flags run is available */
  let det = 0;
  if (findings) {
    for (const x of findings.filter((x) => x.fired)) {
      if (x.id.includes("sanction") && f.some((k) => k.key === "sdn" || k.key === "sdn-exposure")) continue; // same fact as the listing / exposure factors
      const p = x.severity === "high" ? 12 : x.severity === "medium" ? 8 : 4;
      det += p;
      f.push({ key: `det:${x.id}`, label: x.name, points: p, evidence: x.summary, rule: x.fatf });
    }
    if (det > 40) {
      const scale = 40 / det;
      for (const x of f) if (x.key.startsWith("det:")) x.points = Math.round(x.points * scale);
    }
  }
  const total = Math.min(100, f.reduce((s, x) => s + x.points, 0));
  return {
    score: total,
    band: bandOf(total),
    factors: f.sort((x, y) => y.points - x.points),
    detectorsIncluded: !!findings,
    note: findings ? "additive and bounded; every point names its rule; not a probability" : "screening and exposure only — run Red Flags to add detector factors",
  };
}
