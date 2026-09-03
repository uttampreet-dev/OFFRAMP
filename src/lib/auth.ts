import { createHmac } from "crypto";
import { cookies } from "next/headers";

export const AUTH_SECRET = process.env.AUTH_SECRET ?? "offramp-eval-build-secret";
export const SESSION_COOKIE = "offramp_session";
const SESSION_HOURS = 12;

export interface Session {
  u: string;
  role: string;
  exp: number;
}

const b64u = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

export function signSession(u: string, role: string): string {
  const payload = b64u(JSON.stringify({ u, role, exp: Date.now() + SESSION_HOURS * 3600_000 } satisfies Session));
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

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}
