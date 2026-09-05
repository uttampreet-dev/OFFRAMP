"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/*
 * Alerts follow the officer around the console. The board raises them when it polls the
 * watched addresses; this watcher asks for open alerts every half minute, shows a toast for
 * each new one, and — once the officer has opted in — a browser notification that stays visible
 * when the console is not the active window. Alerts already open when the session starts are
 * not re-announced. When nobody is on the Live Board the watcher nudges the board poll itself
 * every few minutes so alerts keep arriving.
 */

type Alert = { key: string; at: number; level: "red" | "amber"; kind: string; address: string | null; case_id: string | null; title: string; detail: string };
const ALERT_POLL_MS = 30_000;
const BOARD_NUDGE_MS = 240_000;
const TOAST_MS = 20_000;
const PREF = "offramp.notify";

export default function AlertWatcher({ user }: { user: string | null }) {
  const pathname = usePathname();
  const [toasts, setToasts] = useState<Alert[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const seen = useRef<Set<string> | null>(null);
  const onBoard = useRef(false);
  useEffect(() => {
    onBoard.current = pathname?.startsWith("/live-board") ?? false;
  }, [pathname]);

  useEffect(() => {
    // read the browser's state after mount so the server-rendered control matches the first paint
    const id = setTimeout(() => {
      if (typeof Notification === "undefined") return setPerm("unsupported");
      setPerm(Notification.permission);
      try {
        setEnabled(localStorage.getItem(PREF) === "1" && Notification.permission === "granted");
      } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const dismiss = useCallback((key: string) => setToasts((t) => t.filter((x) => x.key !== key)), []);

  const announce = useCallback(
    (fresh: Alert[]) => {
      if (!fresh.length) return;
      setToasts((t) => [...fresh, ...t].slice(0, 5));
      for (const a of fresh) setTimeout(() => dismiss(a.key), TOAST_MS);
      if (!enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
      for (const a of fresh) {
        try {
          const n = new Notification(`OFFRAMP · ${a.title}`, { body: a.detail, tag: a.key, requireInteraction: a.level === "red" });
          n.onclick = () => {
            window.focus();
            window.location.href = a.address ? `/trace?address=${a.address}` : "/live-board";
          };
        } catch {}
      }
    },
    [enabled, dismiss],
  );

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/alerts", { cache: "no-store" });
      if (!r.ok) return;
      const b = (await r.json()) as { alerts: Alert[] };
      const list = b.alerts ?? [];
      if (!seen.current) {
        seen.current = new Set(list.map((a) => a.key));
        return;
      }
      const fresh = list.filter((a) => !seen.current!.has(a.key));
      for (const a of fresh) seen.current.add(a.key);
      announce(fresh);
    } catch {}
  }, [announce]);

  useEffect(() => {
    if (!user) return;
    poll();
    const id = setInterval(poll, ALERT_POLL_MS);
    const nudge = setInterval(() => {
      if (!onBoard.current) fetch("/api/board", { cache: "no-store" }).catch(() => {});
    }, BOARD_NUDGE_MS);
    return () => {
      clearInterval(id);
      clearInterval(nudge);
    };
  }, [user, poll]);

  async function toggle() {
    if (perm === "unsupported") return;
    if (enabled) {
      setEnabled(false);
      try { localStorage.setItem(PREF, "0"); } catch {}
      return;
    }
    let p = Notification.permission;
    if (p !== "granted") p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") {
      setEnabled(true);
      try { localStorage.setItem(PREF, "1"); } catch {}
    }
  }

  if (!user) return null;
  return (
    <>
      <button
        onClick={toggle}
        title={perm === "unsupported" ? "this browser does not support notifications" : perm === "denied" ? "notifications are blocked for this site in the browser" : enabled ? "browser notifications on · click to turn off" : "turn on browser notifications for board alerts"}
        className={`fixed bottom-[50px] right-4 z-40 mono text-[9.5px] tracking-[0.14em] uppercase font-bold inline-flex items-center gap-2 border px-2.5 h-[24px] bg-bg/90 ${enabled ? "border-amber/60 text-amber" : "border-line text-faint hover:text-mut"}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-amber" : "bg-[#2a3542]"}`} />
        {perm === "unsupported" ? "notifications unavailable" : perm === "denied" ? "notifications blocked" : enabled ? "notifications on" : "notify me of alerts"}
      </button>

      {toasts.length > 0 && (
        <div className="fixed bottom-[84px] right-4 z-40 flex flex-col gap-2 w-[360px] max-w-[calc(100vw-32px)]">
          {toasts.map((a) => (
            <div key={a.key} className={`border bg-[#0f141b] shadow-[0_12px_32px_rgba(0,0,0,0.5)] px-3.5 py-3 ${a.level === "red" ? "border-[#652225]" : "border-[#4a3a12]"}`}>
              <div className="flex items-start gap-2.5">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${a.level === "red" ? "bg-red" : "bg-amber"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="mono text-[9px] tracking-[0.14em] uppercase font-bold text-faint">board alert · {a.kind}</span>
                    <button onClick={() => dismiss(a.key)} className="mono text-[10px] text-faint hover:text-ink">×</button>
                  </div>
                  <div className="text-[12.5px] text-ink/95 mt-0.5 leading-snug">{a.title}</div>
                  <div className="mono text-[10.5px] text-mut mt-1 break-all leading-snug">{a.detail}</div>
                  <div className="mt-2 flex items-center gap-3">
                    {a.address && <Link href={`/trace?address=${a.address}`} onClick={() => dismiss(a.key)} className="mono text-[10px] tracking-[0.1em] uppercase font-bold text-amber">trace →</Link>}
                    <Link href="/live-board" onClick={() => dismiss(a.key)} className="mono text-[10px] tracking-[0.1em] uppercase font-bold text-mut hover:text-ink">live board</Link>
                    {a.case_id && <Link href={`/cases?id=${a.case_id}`} onClick={() => dismiss(a.key)} className="mono text-[10px] tracking-[0.1em] uppercase font-bold text-mut hover:text-ink">{a.case_id}</Link>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
