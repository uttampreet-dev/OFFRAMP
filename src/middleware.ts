import { NextRequest, NextResponse } from "next/server";

const SECRET = process.env.AUTH_SECRET ?? "offramp-eval-build-secret";
const PUBLIC_PATHS = new Set(["/", "/login", "/api/auth/login", "/api/auth/logout", "/api/demo-trace", "/favicon.ico"]);

async function verify(token: string): Promise<boolean> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const expect = Buffer.from(mac).toString("base64url");
  if (sig !== expect) return false;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof s.exp === "number" && s.exp > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  const token = req.cookies.get("offramp_session")?.value;
  if (token && (await verify(token))) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
