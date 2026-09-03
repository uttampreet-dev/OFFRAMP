import Database from "better-sqlite3";
import { scryptSync, randomBytes } from "crypto";
import path from "path";
import { mkdirSync } from "fs";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "offramp.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('investigator','compliance','supervisor')),
      pass_hash TEXT NOT NULL,
      salt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS packets (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      address TEXT NOT NULL,
      body TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS packs (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      manifest TEXT NOT NULL,
      root_hash TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('intake','tracing','cash-out','escalated','closed')),
      chain TEXT NOT NULL,
      seed TEXT NOT NULL,
      officer TEXT NOT NULL,
      synthetic INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS watch (
      address TEXT PRIMARY KEY,
      chain TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      added_by TEXT NOT NULL,
      added_at INTEGER NOT NULL,
      last_tx TEXT,
      last_seen INTEGER,
      last_balance REAL,
      last_txcount INTEGER,
      last_symbol TEXT
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER NOT NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT ''
    );
  `);
  for (const col of ["last_balance REAL", "last_txcount INTEGER", "last_symbol TEXT"]) {
    try { db.exec(`ALTER TABLE watch ADD COLUMN ${col}`); } catch { /* column already present */ }
  }
  seedUsers(db);
  seedCases(db);
  return db;
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex");
}

function seedUsers(d: Database.Database) {
  const count = (d.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  if (count > 0) return;
  const seed = [
    { username: "investigator", role: "investigator", password: "golden-hour" },
    { username: "compliance", role: "compliance", password: "fiu-ind" },
    { username: "supervisor", role: "supervisor", password: "sector-17" },
  ];
  const ins = d.prepare("INSERT INTO users (username, role, pass_hash, salt) VALUES (?, ?, ?, ?)");
  for (const u of seed) {
    const salt = randomBytes(16).toString("hex");
    ins.run(u.username, u.role, hashPassword(u.password, salt), salt);
  }
}

/* One demonstration case, marked synthetic. Live cases are opened by officers from Trace. */
function seedCases(d: Database.Database) {
  const n = (d.prepare("SELECT COUNT(*) AS n FROM cases").get() as { n: number }).n;
  if (n > 0) return;
  const t = Date.parse("2026-08-14T06:13:09Z");
  d.prepare("INSERT INTO cases (id, title, status, chain, seed, officer, synthetic, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)").run(
    "2026-CHD-0417",
    "Investment-app fraud · USDT cash-out through a P2P counterparty",
    "cash-out",
    "tron",
    "TVd6jP2Lm7Kf3Qa9Rc1Xe5Hb8Nd4Wg0Lm7",
    "investigator",
    "Demonstration case built on a synthetic narrative and a synthetic bank statement. Wallet addresses and the statement are labelled synthetic throughout.",
    t,
    t,
  );
}

export function verifyUser(username: string, password: string): { username: string; role: string } | null {
  const row = getDb().prepare("SELECT username, role, pass_hash, salt FROM users WHERE username = ?").get(username.trim().toLowerCase()) as
    | { username: string; role: string; pass_hash: string; salt: string }
    | undefined;
  if (!row) return null;
  if (hashPassword(password, row.salt) !== row.pass_hash) return null;
  return { username: row.username, role: row.role };
}

export function audit(username: string, action: string, detail = ""): void {
  getDb().prepare("INSERT INTO audit (at, username, action, detail) VALUES (?, ?, ?, ?)").run(Date.now(), username, action, detail);
}

export interface PacketRow { id: string; case_id: string; address: string; body: string; sha256: string; created_by: string; created_at: number }
export interface PackRow { id: string; case_id: string; manifest: string; root_hash: string; created_by: string; created_at: number }

export function savePacket(p: PacketRow): void {
  getDb().prepare("INSERT INTO packets (id, case_id, address, body, sha256, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(p.id, p.case_id, p.address, p.body, p.sha256, p.created_by, p.created_at);
}
export function packetsForCase(caseId: string): PacketRow[] {
  return getDb().prepare("SELECT * FROM packets WHERE case_id = ? ORDER BY created_at DESC").all(caseId) as PacketRow[];
}
export function savePack(p: PackRow): void {
  getDb().prepare("INSERT INTO packs (id, case_id, manifest, root_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(p.id, p.case_id, p.manifest, p.root_hash, p.created_by, p.created_at);
}
export function packById(id: string): PackRow | undefined {
  return getDb().prepare("SELECT * FROM packs WHERE id = ?").get(id) as PackRow | undefined;
}
export function packsForCase(caseId: string): PackRow[] {
  return getDb().prepare("SELECT * FROM packs WHERE case_id = ? ORDER BY created_at DESC").all(caseId) as PackRow[];
}
export function auditForCase(caseId: string): { at: number; username: string; action: string; detail: string }[] {
  return getDb().prepare("SELECT at, username, action, detail FROM audit WHERE detail LIKE ? ORDER BY at ASC").all(`%${caseId}%`) as { at: number; username: string; action: string; detail: string }[];
}

/* ── cases ── */
export type CaseStatus = "intake" | "tracing" | "cash-out" | "escalated" | "closed";
export interface CaseRow { id: string; title: string; status: CaseStatus; chain: string; seed: string; officer: string; synthetic: number; notes: string; created_at: number; updated_at: number }

export function listCases(): CaseRow[] {
  return getDb().prepare("SELECT * FROM cases ORDER BY updated_at DESC").all() as CaseRow[];
}
export function getCase(id: string): CaseRow | undefined {
  return getDb().prepare("SELECT * FROM cases WHERE id = ?").get(id) as CaseRow | undefined;
}
export function nextCaseId(): string {
  const year = new Date().getFullYear();
  const rows = getDb().prepare("SELECT id FROM cases").all() as { id: string }[];
  let max = 417;
  for (const r of rows) {
    const m = /^\d{4}-CHD-(\d{4})$/.exec(r.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${year}-CHD-${String(max + 1).padStart(4, "0")}`;
}
export function createCase(c: Omit<CaseRow, "created_at" | "updated_at">): CaseRow {
  const now = Date.now();
  getDb()
    .prepare("INSERT INTO cases (id, title, status, chain, seed, officer, synthetic, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(c.id, c.title, c.status, c.chain, c.seed, c.officer, c.synthetic, c.notes, now, now);
  return { ...c, created_at: now, updated_at: now };
}
export function updateCase(id: string, patch: { status?: CaseStatus; notes?: string; title?: string }): CaseRow | undefined {
  const cur = getCase(id);
  if (!cur) return undefined;
  getDb()
    .prepare("UPDATE cases SET status = ?, notes = ?, title = ?, updated_at = ? WHERE id = ?")
    .run(patch.status ?? cur.status, patch.notes ?? cur.notes, patch.title ?? cur.title, Date.now(), id);
  return getCase(id);
}
export function casesForAddress(address: string): CaseRow[] {
  return getDb().prepare("SELECT * FROM cases WHERE lower(seed) = lower(?)").all(address) as CaseRow[];
}

/* ── watch list ── */
export interface WatchRow { address: string; chain: string; label: string; added_by: string; added_at: number; last_tx: string | null; last_seen: number | null; last_balance: number | null; last_txcount: number | null; last_symbol: string | null }
export function listWatch(): WatchRow[] {
  return getDb().prepare("SELECT * FROM watch ORDER BY added_at DESC").all() as WatchRow[];
}
export function addWatch(w: { address: string; chain: string; label: string; added_by: string }): boolean {
  const r = getDb().prepare("INSERT OR IGNORE INTO watch (address, chain, label, added_by, added_at) VALUES (?, ?, ?, ?, ?)").run(w.address, w.chain, w.label, w.added_by, Date.now());
  return r.changes > 0;
}
export function removeWatch(address: string): void {
  getDb().prepare("DELETE FROM watch WHERE address = ?").run(address);
}
export function markWatchSeen(address: string, lastTx: string | null, lastSeen: number | null, balance: number | null, txCount: number | null, symbol: string | null): void {
  getDb().prepare("UPDATE watch SET last_tx = ?, last_seen = ?, last_balance = ?, last_txcount = ?, last_symbol = ? WHERE address = ?").run(lastTx, lastSeen, balance, txCount, symbol, address);
}
export function recentAudit(limit = 40): { at: number; username: string; action: string; detail: string }[] {
  return getDb().prepare("SELECT at, username, action, detail FROM audit ORDER BY at DESC LIMIT ?").all(limit) as { at: number; username: string; action: string; detail: string }[];
}
export function countPackets(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM packets").get() as { n: number }).n;
}
export function allPackets(): PacketRow[] {
  return getDb().prepare("SELECT * FROM packets ORDER BY created_at DESC").all() as PacketRow[];
}
