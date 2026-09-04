import { Suspense } from "react";
import LoginScreen from "./LoginScreen";
import { ofacIndex } from "@/lib/ofac";
import { countUsers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const ofac = ofacIndex();
  return (
    <Suspense>
      <LoginScreen ofacCount={ofac.set.size} syncedAt={ofac.syncedAt} users={countUsers()} />
    </Suspense>
  );
}
