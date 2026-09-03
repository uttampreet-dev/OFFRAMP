"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Login failed");
      router.push(params.get("next") ?? "/trace");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-[380px] max-w-full border border-line bg-panel/95 rounded-lg p-7 backdrop-blur-none">
      <div className="text-[19px] font-extrabold tracking-[0.16em]">
        OFF<span className="text-amber">RAMP</span>
      </div>
      <div className="hlabel text-[8.5px] mt-1.5">Console access</div>

      <label className="block mt-6">
        <span className="hlabel text-[8px]">Username</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          autoCapitalize="none"
          className="mono mt-1.5 w-full bg-bg border border-line rounded px-3 py-2 text-[12.5px] outline-none focus:border-[#3a4e63]"
        />
      </label>
      <label className="block mt-4">
        <span className="hlabel text-[8px]">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mono mt-1.5 w-full bg-bg border border-line rounded px-3 py-2 text-[12.5px] outline-none focus:border-[#3a4e63]"
        />
      </label>

      {error && <div className="mt-4 text-[11.5px] text-red border border-[#652225] bg-[#1a0c0e] rounded px-3 py-2">{error}</div>}

      <button
        disabled={busy}
        className="mono mt-6 w-full border border-amber/70 text-amber hover:bg-amber hover:text-[#12100c] transition-colors rounded py-2.5 text-[11px] tracking-[0.14em] uppercase font-extrabold disabled:opacity-50"
      >
        {busy ? "Verifying…" : "Sign in"}
      </button>

      <div className="mt-6 border-t border-line pt-4">
        <div className="mono text-[8px] tracking-[0.14em] uppercase font-bold text-faint">Evaluation build · demo access</div>
        <div className="mono text-[10.5px] text-mut mt-1.5 leading-relaxed">
          investigator / golden-hour
          <br />
          compliance / fiu-ind · supervisor / sector-17
        </div>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="ground grain relative min-h-screen overflow-hidden flex items-center justify-center">
      <div className="relative z-10">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
