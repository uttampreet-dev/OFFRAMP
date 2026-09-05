import { Suspense } from "react";
import LoginScreen from "./LoginScreen";
import { ofacIndex } from "@/lib/ofac";
import { countUsers } from "@/lib/db";
import { demoGraph } from "@/lib/demo-graph";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const ofac = ofacIndex();
  const initial = await demoGraph("12HQDsicffSBaYdJ6BhnE22sfjTESmmzKx");
  return (
    <Suspense>
      <LoginScreen ofacCount={ofac.set.size} syncedAt={ofac.syncedAt} users={countUsers()} initial={initial} />
    </Suspense>
  );
}
