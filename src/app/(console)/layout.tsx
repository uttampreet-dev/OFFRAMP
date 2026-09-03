import Rail from "@/components/Rail";
import { getSession } from "@/lib/auth";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="flex min-h-screen">
      <Rail user={session?.u ?? null} role={session?.role ?? null} />
      <main className="flex-1 min-w-0 chain-grid">{children}</main>
    </div>
  );
}
