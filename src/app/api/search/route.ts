import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { getDb } from "@/lib/db";
import { detectChain } from "@/lib/chains";
import { detectHash } from "@/lib/chains/tx";
import { knownEntity } from "@/lib/trace/labels";
import { isSanctioned } from "@/lib/ofac";
import { isReported } from "@/lib/board";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Hit { kind: string; id: string; title: string; detail: string; href: string; synthetic?: boolean }

/** One search across everything the console holds: cases, packets, packs, watch list, audit, complaints,
    known entities, statement accounts — plus what the query itself is (address / tx hash). */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json({ hits: [], q });
  const like = `%${q}%`;
  const db = getDb();
  const hits: Hit[] = [];
  if (detectChain(q)) hits.push({ kind: "address", id: q, title: `${detectChain(q)!.toUpperCase()} address`, detail: [isSanctioned(q) ? "OFAC SDN" : null, knownEntity(q)?.entity ?? null, isReported(q)?.category ? `community report · ${isReported(q)!.category}` : null].filter(Boolean).join(" · ") || "trace it live", href: `/trace?address=${q}` });
  if (detectHash(q)) hits.push({ kind: "transaction", id: q, title: "transaction hash", detail: "open the transaction and trace either side", href: `/trace?tx=${q}` });
  for (const c of db.prepare("SELECT id, title, status, seed, synthetic FROM cases WHERE id LIKE ? OR title LIKE ? OR seed LIKE ? OR notes LIKE ? LIMIT 20").all(like, like, like, like) as { id: string; title: string; status: string; seed: string; synthetic: number }[])
    hits.push({ kind: "case", id: c.id, title: `${c.id} · ${c.status}`, detail: c.title, href: `/cases?id=${c.id}`, synthetic: !!c.synthetic });
  for (const p of db.prepare("SELECT id, case_id, address, sha256 FROM packets WHERE id LIKE ? OR address LIKE ? OR sha256 LIKE ? OR case_id LIKE ? LIMIT 20").all(like, like, like, like) as { id: string; case_id: string; address: string; sha256: string }[])
    hits.push({ kind: "packet", id: p.id, title: `${p.id} · sealed freeze packet`, detail: `${p.case_id} · ${p.address} · sha256 ${p.sha256.slice(0, 12)}…`, href: `/evidence?case=${p.case_id}` });
  for (const p of db.prepare("SELECT id, case_id, root_hash FROM packs WHERE id LIKE ? OR root_hash LIKE ? OR case_id LIKE ? LIMIT 20").all(like, like, like) as { id: string; case_id: string; root_hash: string }[])
    hits.push({ kind: "pack", id: p.id, title: `${p.id} · evidence pack`, detail: `${p.case_id} · root ${p.root_hash.slice(0, 12)}…`, href: `/evidence?case=${p.case_id}` });
  for (const w of db.prepare("SELECT address, chain, label FROM watch WHERE address LIKE ? OR label LIKE ? LIMIT 20").all(like, like) as { address: string; chain: string; label: string }[])
    hits.push({ kind: "watched", id: w.address, title: `${w.chain.toUpperCase()} · watched address`, detail: w.label || w.address, href: `/trace?address=${w.address}` });
  for (const a of db.prepare("SELECT at, username, action, detail FROM audit WHERE detail LIKE ? OR action LIKE ? ORDER BY at DESC LIMIT 20").all(like, like) as { at: number; username: string; action: string; detail: string }[])
    hits.push({ kind: "audit", id: String(a.at), title: `${a.action} · ${a.username}`, detail: a.detail, href: `/live-board` });
  const cf = path.join(process.cwd(), "data", "synthetic", "complaints.json");
  if (existsSync(cf)) {
    const recs = (JSON.parse(readFileSync(cf, "utf8")) as { records: { id: string; city: string; amountInr: number; paidTo: string; cashOutWallet: string; notes: string }[] }).records;
    const ql = q.toLowerCase();
    for (const r of recs.filter((r) => [r.id, r.city, r.paidTo, r.cashOutWallet, r.notes].some((v) => String(v).toLowerCase().includes(ql))).slice(0, 20))
      hits.push({ kind: "complaint", id: r.id, title: `${r.id} · ₹${r.amountInr.toLocaleString("en-IN")} · ${r.city}`, detail: `paid to ${r.paidTo} · cash-out ${r.cashOutWallet}`, href: `/syndicates`, synthetic: true });
  }
  const ef = path.join(process.cwd(), "data", "known-entities.json");
  if (existsSync(ef)) {
    const ents = JSON.parse(readFileSync(ef, "utf8")) as { address: string; chain: string; entity: string; type: string; source: string }[];
    const ql = q.toLowerCase();
    for (const e of ents.filter((e) => e.entity.toLowerCase().includes(ql) || e.address.toLowerCase().includes(ql)).slice(0, 20))
      hits.push({ kind: "entity", id: e.address, title: `${e.entity} · ${e.type} · ${e.chain.toUpperCase()}`, detail: `${e.address} · source: ${e.source}`, href: `/trace?address=${e.address}` });
  }
  const sd = path.join(process.cwd(), "data", "synthetic", "statements");
  if (existsSync(sd)) {
    for (const f of ["demo-case-4471.csv", "mule-0456.csv", "mule-7719.csv", "mule-8821.csv"]) {
      const acct = /(\d{4})\.csv$/.exec(f)?.[1];
      if (acct && (q.includes(acct) || f.toLowerCase().includes(q.toLowerCase()))) hits.push({ kind: "account", id: f, title: `A/C XXXXXX${acct} · bank statement`, detail: `${f} · synthetic`, href: `/bridge?demo=1`, synthetic: true });
    }
  }
  return NextResponse.json({ hits: hits.slice(0, 60), q });
}
