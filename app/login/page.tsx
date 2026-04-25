"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AsciiMesh } from "@/components/decoration/AsciiMesh";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    const redirect = params.get("redirect") || "/dashboard";
    router.push(redirect);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="ae-step-label">
        <span className="ae-step-num">01</span>
        <span>Authenticate</span>
        <span className="ae-step-rule" />
      </div>

      <div className="space-y-4 bg-panel/80 backdrop-blur-sm border border-border rounded-[10px] p-6">
        <div>
          <label className="block text-[10.5px] uppercase tracking-[0.14em] text-muted-2 mb-[6px]">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full"
            autoComplete="email"
            placeholder="you@aeternum.id"
          />
        </div>
        <div>
          <label className="block text-[10.5px] uppercase tracking-[0.14em] text-muted-2 mb-[6px]">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full"
            autoComplete="current-password"
          />
        </div>
        {error && (
          <div className="text-loss text-[12px] border border-loss/40 bg-loss/10 rounded-[4px] px-3 py-2">
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} className="btn-pill btn-pill-primary w-full">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </div>

      <div className="text-center text-[11px] text-muted">
        No account?{" "}
        <Link href="/signup" className="text-accent-text hover:underline">
          Create one
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg flex items-center justify-center px-4 py-12">
      {/* Hyperlane-style ASCII mesh backdrop — sits behind everything */}
      <AsciiMesh
        density="loose"
        rows={48}
        cols={140}
        drift
        className="-top-12 -left-12"
      />

      {/* Faint accent halo behind the wordmark */}
      <div
        className="pointer-events-none absolute left-1/2 top-[28%] -translate-x-1/2 w-[640px] h-[200px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(139,92,246,0.18), rgba(139,92,246,0) 70%)",
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-[440px]">
        <header className="text-center mb-10">
          <div className="ae-step-label justify-center mb-5">
            <span className="ae-step-num">00</span>
            <span>CIO Cockpit</span>
          </div>
          <h1 className="ae-wordmark">Aeternum</h1>
          <div className="mt-3 mono text-[10.5px] tracking-[0.32em] text-muted uppercase">
            Portfolio Tracker · IDX-First · Concentrated
          </div>
        </header>

        <Suspense
          fallback={<div className="text-muted text-[12px] text-center">Loading…</div>}
        >
          <LoginForm />
        </Suspense>

        <footer className="mt-12 grid grid-cols-3 gap-3 text-center">
          {[
            { num: "01", label: "Authenticate" },
            { num: "02", label: "Sync sheets" },
            { num: "03", label: "Cockpit" },
          ].map((s) => (
            <div key={s.num} className="px-2">
              <div className="mono text-[9.5px] tracking-[0.18em] text-muted-2 uppercase">
                {s.num}
              </div>
              <div className="text-[11px] text-muted mt-[2px]">{s.label}</div>
            </div>
          ))}
        </footer>
      </div>
    </div>
  );
}
