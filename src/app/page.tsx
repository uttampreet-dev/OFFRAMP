import Landing from "@/components/landing/Landing";
import { ofacIndex } from "@/lib/ofac";
import { getSession } from "@/lib/auth";
import { demoGraph } from "@/lib/demo-graph";
import { readFileSync } from "fs";
import path from "path";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const capture = sp.capture === "1";
  const ofac = ofacIndex();
  const session = await getSession();
  const initial = await demoGraph("12HQDsicffSBaYdJ6BhnE22sfjTESmmzKx");
  let tickerAddrs: string[] = [];
  try {
    const list = JSON.parse(readFileSync(path.join(process.cwd(), "data", "ofac", "XBT.json"), "utf8")) as string[];
    tickerAddrs = list.slice(0, 26);
  } catch {
    tickerAddrs = [];
  }
  return <Landing ofacCount={ofac.set.size} syncedAt={ofac.syncedAt} tickerAddrs={tickerAddrs} capture={capture} loggedIn={!!session} initial={initial} />;
}
