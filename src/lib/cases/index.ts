import { getCase, auditForCase, packetsForCase, packsForCase, type CaseRow } from "../db";

export interface TimelineItem { at: number; kind: "audit" | "packet" | "pack" | "opened"; title: string; detail: string; by: string }
export interface CaseDetail { c: CaseRow; timeline: TimelineItem[]; packets: { id: string; sha256: string; at: number; by: string }[]; packs: { id: string; rootHash: string; at: number; by: string }[] }

export function caseDetail(id: string): CaseDetail | null {
  const c = getCase(id);
  if (!c) return null;
  const rows = auditForCase(id);
  const items: TimelineItem[] = rows.some((a) => a.action === "case.opened") ? [] : [{ at: c.created_at, kind: "opened", title: "case.opened", detail: `${c.chain.toUpperCase()} · seed ${c.seed}`, by: c.officer }];
  for (const a of rows) items.push({ at: a.at, kind: "audit", title: a.action, detail: a.detail, by: a.username });
  const packets = packetsForCase(id).map((p) => ({ id: p.id, sha256: p.sha256, at: p.created_at, by: p.created_by }));
  const packs = packsForCase(id).map((p) => ({ id: p.id, rootHash: p.root_hash, at: p.created_at, by: p.created_by }));
  items.sort((a, b) => a.at - b.at);
  return { c, timeline: items, packets, packs };
}
