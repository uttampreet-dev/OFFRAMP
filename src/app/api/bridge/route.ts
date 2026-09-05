import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseStatement } from "@/lib/bridge/parse";
import { correlate } from "@/lib/bridge/correlate";
import { DEMO_CHAIN_EVENTS, DEMO_STATEMENT_CSV, sampleStatements } from "@/lib/bridge/sample";
import { lookupAddress } from "@/lib/chains";
import type { ChainEvent } from "@/lib/bridge/sample";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  mode: "demo" | "live";
  sample?: string;
  address?: string;
  statementCsv?: string;
  tolerancePct?: number;
  windowHours?: number;
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.mode) return NextResponse.json({ error: "mode is required" }, { status: 400 });
  try {
    const sample = body.sample ? sampleStatements().find((x) => x.name === body.sample) : undefined;
    const statement = body.statementCsv?.trim()
      ? parseStatement(body.statementCsv, { synthetic: true, source: "uploaded statement (treated as synthetic)" })
      : sample
        ? parseStatement(sample.csv, { account: sample.account, synthetic: true, source: `synthetic statement ${sample.name}` })
        : parseStatement(DEMO_STATEMENT_CSV, { account: "XXXXXX4471", synthetic: true, source: "demonstration statement" });

    let events: ChainEvent[];
    let chainSynthetic = false;
    if (body.mode === "demo") {
      events = DEMO_CHAIN_EVENTS;
      chainSynthetic = true;
    } else {
      if (!body.address) return NextResponse.json({ error: "address is required for live mode" }, { status: 400 });
      const r = await lookupAddress(body.address);
      events = r.transfers
        .filter((t) => t.direction === "out" && t.time)
        .map((t) => ({ ts: t.time!, from: t.from, to: t.to, value: t.value, symbol: t.symbol, txid: t.txid, note: "outflow" }));
    }
    const result = correlate(events, statement, { tolerancePct: body.tolerancePct, windowHours: body.windowHours, chainSynthetic });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "bridge failed" }, { status: 502 });
  }
}
