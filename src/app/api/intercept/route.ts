import { NextRequest, NextResponse } from "next/server";
import { buildIntercept } from "@/lib/intercept";
import { getSession } from "@/lib/auth";
import { DEMO_CASHOUT_WALLET, DEMO_CHAIN_EVENTS } from "@/lib/bridge/sample";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await getSession();
  const b = (await req.json().catch(() => ({}))) as { address?: string; amount?: number; symbol?: string; caseId?: string; demo?: boolean };
  try {
    if (b.demo) {
      const cashout = DEMO_CHAIN_EVENTS.find((e) => e.to === DEMO_CASHOUT_WALLET)!;
      const v = await buildIntercept({ address: DEMO_CASHOUT_WALLET, amount: cashout.value, symbol: cashout.symbol, caseId: "2026-CHD-0417", officer: s?.u ?? "unknown", triggerTs: cashout.ts, txid: cashout.txid, replay: true });
      return NextResponse.json(v);
    }
    if (!b.address) return NextResponse.json({ error: "address is required" }, { status: 400 });
    const v = await buildIntercept({ address: b.address.trim(), amount: Number(b.amount ?? 0), symbol: b.symbol ?? "USDT", caseId: b.caseId ?? `LIVE-${b.address.slice(-6)}`, officer: s?.u ?? "unknown" });
    return NextResponse.json(v);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "intercept failed" }, { status: 502 });
  }
}
