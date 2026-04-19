"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

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
    <form
      onSubmit={onSubmit}
      className="bg-panel border border-border rounded-[4px] p-6 space-y-4"
    >
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full"
          autoComplete="email"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">
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
      {error && <div className="text-red text-[12px]">{error}</div>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent text-bg py-2 rounded font-semibold tracking-wider text-[12px] uppercase disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <div className="text-center text-[11px] text-muted pt-2">
        No account?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Create one
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-8">
          <div className="text-accent font-semibold tracking-[0.18em] text-[14px]">AETERNUM</div>
          <div className="text-muted text-[10px] tracking-[0.12em] mt-1">PORTFOLIO TRACKER</div>
        </div>
        <Suspense fallback={<div className="text-muted text-[12px]">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
