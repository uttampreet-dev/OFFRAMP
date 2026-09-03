"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const GROUPS: { label: string; items: { name: string; href: string }[] }[] = [
  {
    label: "Triage",
    items: [
      { name: "Live Board", href: "/live-board" },
      { name: "Cases", href: "/cases" },
    ],
  },
  {
    label: "Investigate",
    items: [
      { name: "Trace", href: "/trace" },
      { name: "Bridge", href: "/bridge" },
      { name: "Red Flags", href: "/red-flags" },
      { name: "Syndicates", href: "/syndicates" },
    ],
  },
  {
    label: "Act",
    items: [
      { name: "Intercept", href: "/intercept" },
      { name: "Evidence", href: "/evidence" },
    ],
  },
];

export default function Rail({ user, role }: { user: string | null; role: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="relative w-[232px] shrink-0 bg-rail border-r border-line flex flex-col py-5 min-h-screen">
      <div className="absolute top-0 -right-px w-px h-full bg-gradient-to-b from-transparent via-amber/15 to-transparent pointer-events-none" />
      <div className="px-[18px] pb-4">
        <h1 className="text-[21px] font-extrabold tracking-[0.16em]">
          OFF<span className="text-amber">RAMP</span>
        </h1>
        <p className="text-[8.5px] tracking-[0.15em] text-faint uppercase mt-1.5">Crypto flow intelligence</p>
      </div>
      {GROUPS.map((g) => (
        <div key={g.label} className="px-2.5 mt-3.5">
          <div className="text-[9px] tracking-[0.2em] text-[#3d4c5c] px-[12px] pb-2 uppercase font-bold">{g.label}</div>
          {g.items.map((it) => {
            const on = pathname.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex items-center justify-between text-[13.5px] px-[12px] py-[8px] rounded mb-px ${
                  on ? "bg-[#141e29] text-[#f2f7fb] font-semibold shadow-[inset_2px_0_0_#e8b23a]" : "text-mut hover:text-ink"
                }`}
              >
                {it.name}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="mt-auto px-[18px] pt-3 border-t border-line">
        {user ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="mono text-[10.5px] text-ink truncate">{user}</div>
              <div className="text-[8px] tracking-[0.14em] uppercase font-bold text-faint mt-0.5">{role}</div>
            </div>
            <button
              onClick={logout}
              className="mono text-[8.5px] tracking-[0.1em] uppercase font-bold text-mut hover:text-red border border-line hover:border-[#652225] rounded px-2 py-1"
            >
              Exit
            </button>
          </div>
        ) : (
          <div className="text-[9px] text-[#455565] leading-relaxed tracking-wide">CYBER CELL CONSOLE</div>
        )}
      </div>
    </aside>
  );
}
