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
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER NOT NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT ''
    );
  `);
  seedUsers(db);
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
