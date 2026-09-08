import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const CACHE_DIR = process.env.OFFRAMP_CACHE_DIR ?? path.join(process.cwd(), ".cache");
const OFFLINE = process.env.OFFRAMP_OFFLINE === "1";
const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  url: string;
  at: number;
  status: number;
  body: unknown;
}

function keyFor(url: string): string {
  return createHash("sha1").update(url).digest("hex");
}

function readEntry(url: string): CacheEntry | null {
  const f = path.join(CACHE_DIR, keyFor(url) + ".json");
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, "utf8")) as CacheEntry;
  } catch {
    return null;
  }
}

function writeEntry(entry: CacheEntry): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(path.join(CACHE_DIR, keyFor(entry.url) + ".json"), JSON.stringify(entry));
}

export interface FetchResult<T> {
  data: T;
  fromCache: boolean;
  fetchedAt: number;
}

/** Fetch JSON with a disk cache. Falls back to stale cache when the network
 *  fails, and runs cache-only when OFFRAMP_OFFLINE=1. */
export async function cachedJson<T>(url: string, opts?: { ttlMs?: number; headers?: Record<string, string> }): Promise<FetchResult<T>> {
  const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS;
  const hit = readEntry(url);

  if (OFFLINE) {
    if (hit) return { data: hit.body as T, fromCache: true, fetchedAt: hit.at };
    throw new Error(`offline mode: no cached copy of ${url}`);
  }

  if (hit && Date.now() - hit.at < ttl) {
    return { data: hit.body as T, fromCache: true, fetchedAt: hit.at };
  }

  try {
    const res = await fetch(url, { headers: opts?.headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    const body = (await res.json()) as T;
    writeEntry({ url, at: Date.now(), status: res.status, body });
    return { data: body, fromCache: false, fetchedAt: Date.now() };
  } catch (err) {
    if (hit) return { data: hit.body as T, fromCache: true, fetchedAt: hit.at };
    throw err;
  }
}
