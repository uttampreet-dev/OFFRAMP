/** Bank statement rows in the project schema:
 *  date,time,narration,ref,debit,credit,balance,channel  (IST timestamps) */
export interface StatementRow {
  date: string;
  time: string;
  ts: number; // epoch ms, IST interpreted
  narration: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number;
  channel: string;
}
export interface Statement {
  account: string;
  rows: StatementRow[];
  credits: StatementRow[];
  synthetic: boolean;
  source: string;
}

const IST_OFFSET_MS = 5.5 * 3600_000;
function toEpochIst(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss] = time.split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm, ss ?? 0) - IST_OFFSET_MS;
}
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseStatement(csv: string, opts: { account?: string; synthetic?: boolean; source?: string } = {}): Statement {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) throw new Error("Empty statement");
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  for (const k of ["date", "time", "narration", "credit"]) if (idx(k) < 0) throw new Error(`Statement is missing the '${k}' column`);
  const rows: StatementRow[] = [];
  for (const line of lines.slice(1)) {
    const c = splitCsvLine(line);
    if (c.length < 4) continue;
    const date = c[idx("date")];
    const time = c[idx("time")] || "00:00:00";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    rows.push({
      date,
      time,
      ts: toEpochIst(date, time),
      narration: c[idx("narration")] ?? "",
      ref: idx("ref") >= 0 ? c[idx("ref")] ?? "" : "",
      debit: Number(idx("debit") >= 0 ? c[idx("debit")] || 0 : 0),
      credit: Number(c[idx("credit")] || 0),
      balance: Number(idx("balance") >= 0 ? c[idx("balance")] || 0 : 0),
      channel: idx("channel") >= 0 ? c[idx("channel")] ?? "" : "",
    });
  }
  rows.sort((a, b) => a.ts - b.ts);
  // account id: the most common "…NNNN" suffix in credit narrations, else provided
  const suffix = rows.map((r) => /…(\d{4})/.exec(r.narration)?.[1]).filter(Boolean) as string[];
  const acct = opts.account ?? (suffix.length ? `XXXXXX${suffix.sort((a, b) => suffix.filter((x) => x === b).length - suffix.filter((x) => x === a).length)[0]}` : "unknown");
  return { account: acct, rows, credits: rows.filter((r) => r.credit > 0), synthetic: opts.synthetic ?? true, source: opts.source ?? "uploaded" };
}
