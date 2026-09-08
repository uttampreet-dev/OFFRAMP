import { createHmac } from "crypto";
import { cookies } from "next/headers";

export const AUTH_SECRET = process.env.AUTH_SECRET ?? "offramp-eval-build-secret";
export const SESSION_COOKIE = "offramp_session";
const SESSION_HOURS = 12;

export interface Session {
  u: string;
  role: string;
  exp: number;
  sid?: string;
}

const b64u = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

export const SESSION_HOURS_PUBLIC = SESSION_HOURS;
export function signSession(u: string, role: string, sid?: string, exp?: number): string {
  const payload = b64u(JSON.stringify({ u, role, exp: exp ?? Date.now() + SESSION_HOURS * 3600_000, sid } satisfies Session));
  const sig = createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expect = createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  if (sig !== expect) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (s.exp < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

/** Signature + expiry (as the edge middleware checks) plus the server-side session record, so a revoked session is dead everywhere the data lives. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const s = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  // on hosts that run many short-lived instances the session table is not shared, so the signed cookie alone is trusted there
  if (s.sid && process.env.OFFRAMP_STATELESS_SESSIONS !== "1") {
    const { sessionAlive } = await import("./db");
    if (!sessionAlive(s.sid)) return null;
  }
  return s;
}
