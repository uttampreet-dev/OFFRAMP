import { existsSync, readFileSync } from "fs";
import path from "path";
import { isSanctioned } from "../ofac";
import { knownEntity } from "../trace/labels";
import { isReported } from "../board";
import { casesForAddress } from "../db";

/* Complaints → syndicates. A syndicate is a set of complaints that share a cash-out wallet
   (transitively). The dataset is synthetic and every result says so. */
export interface Complaint { id: string; date: string; city: string; amountInr: number; paidAs: string; paidTo: string; cashOutWallet: string; notes: string }
export interface Syndicate {
  id: string;
  complaints: Complaint[];
  wallets: { address: string; complaints: number; amountInr: number; sanctioned: boolean; entity: string | null; reported: string | null; cases: string[] }[];
  paidTo: string[];
  cities: Record<string, number>;
  rails: Record<string, number>;
  amountInr: number;
  firstDate: string;
  lastDate: string;
  spanDays: number;
  tempoPerWeek: number;
}
export interface SyndicateReport { synthetic: true; note: string; complaints: number; syndicates: Syndicate[]; singletons: Complaint[]; graph: { nodes: { id: string; kind: "complaint" | "wallet" | "city"; label: string; group: string | null; weight: number }[]; edges: { from: string; to: string }[] } }

let cache: { mtime: number; data: { synthetic: boolean; note?: string; records: Complaint[] } } | null = null;
export function loadComplaints(): { synthetic: boolean; note: string; records: Complaint[] } {
  const f = path.join(process.cwd(), "data", "synthetic", "complaints.json");
  if (!existsSync(f)) return { synthetic: true, note: "no complaints dataset present", records: [] };
  const d = JSON.parse(readFileSync(f, "utf8")) as { synthetic: boolean; note?: string; records: Complaint[] };
  cache = { mtime: Date.now(), data: d };
  return { synthetic: d.synthetic !== false, note: d.note ?? "synthetic dataset", records: d.records };
}

class DSU {
  p = new Map<string, string>();
  find(x: string): string {
    if (!this.p.has(x)) this.p.set(x, x);
    const px = this.p.get(x)!;
    if (px === x) return x;
    const r = this.find(px);
    this.p.set(x, r);
    return r;
  }
  union(a: string, b: string) {
    this.p.set(this.find(a), this.find(b));
  }
}

export function buildSyndicates(): SyndicateReport {
  const { note, records } = loadComplaints();
  const dsu = new DSU();
  for (const r of records) dsu.union(`c:${r.id}`, `w:${r.cashOutWallet}`);
  const groups = new Map<string, Complaint[]>();
  for (const r of records) {
    const k = dsu.find(`c:${r.id}`);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const syndicates: Syndicate[] = [];
  const singletons: Complaint[] = [];
  let n = 0;
  for (const cs of [...groups.values()].sort((a, b) => b.reduce((s, c) => s + c.amountInr, 0) - a.reduce((s, c) => s + c.amountInr, 0))) {
    if (cs.length < 2) {
      singletons.push(...cs);
      continue;
    }
    n++;
    const wallets = new Map<string, { complaints: number; amountInr: number }>();
    const cities: Record<string, number> = {};
    const rails: Record<string, number> = {};
    for (const c of cs) {
      const w = wallets.get(c.cashOutWallet) ?? { complaints: 0, amountInr: 0 };
      w.complaints++;
      w.amountInr += c.amountInr;
      wallets.set(c.cashOutWallet, w);
      cities[c.city] = (cities[c.city] ?? 0) + 1;
      rails[c.paidAs] = (rails[c.paidAs] ?? 0) + 1;
    }
    const dates = cs.map((c) => c.date).sort();
    const span = Math.max(1, Math.round((Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86400_000) + 1);
    syndicates.push({
      id: `SYN-${String(n).padStart(2, "0")}`,
      complaints: cs.sort((a, b) => a.date.localeCompare(b.date)),
      wallets: [...wallets.entries()].map(([address, w]) => ({ address, ...w, sanctioned: isSanctioned(address), entity: knownEntity(address)?.entity ?? null, reported: isReported(address)?.category ?? null, cases: casesForAddress(address).map((c) => c.id) })),
      paidTo: cs.map((c) => c.paidTo),
      cities,
      rails,
      amountInr: cs.reduce((s, c) => s + c.amountInr, 0),
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
      spanDays: span,
      tempoPerWeek: Math.round((cs.length / span) * 7 * 10) / 10,
    });
  }
  const nodes: SyndicateReport["graph"]["nodes"] = [];
  const edges: SyndicateReport["graph"]["edges"] = [];
  const seenCity = new Set<string>();
  for (const s of syndicates) {
    for (const w of s.wallets) nodes.push({ id: `w:${w.address}`, kind: "wallet", label: w.address, group: s.id, weight: w.complaints });
    for (const c of s.complaints) {
      nodes.push({ id: `c:${c.id}`, kind: "complaint", label: c.id, group: s.id, weight: 1 });
      edges.push({ from: `c:${c.id}`, to: `w:${c.cashOutWallet}` });
      if (!seenCity.has(c.city)) {
        seenCity.add(c.city);
        nodes.push({ id: `city:${c.city}`, kind: "city", label: c.city, group: null, weight: 1 });
      }
      edges.push({ from: `city:${c.city}`, to: `c:${c.id}` });
    }
  }
  return { synthetic: true, note, complaints: records.length, syndicates, singletons, graph: { nodes, edges } };
}
