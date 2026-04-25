"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AsciiMesh } from "@/components/decoration/AsciiMesh";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = supabaseBrowser();
    const origin = window.location.origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setInfo("Check your email for a confirmation link. Click it to finish setup.");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg flex items-center justify-center px-4 py-12">
      <AsciiMesh density="loose" rows={48} cols={140} drift className="-top-12 -left-12" />
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
            <span>CIO Cockpit · Onboarding</span>
          </div>
          <h1 className="ae-wordmark">Aeternum</h1>
          <div className="mt-3 mono text-[10.5px] tracking-[0.32em] text-muted uppercase">
            Portfolio Tracker · IDX-First · Concentrated
          </div>
        </header>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="ae-step-label">
            <span className="ae-step-num">01</span>
            <span>Create account</span>
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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
            </div>
            {error && (
              <div className="text-loss text-[12px] border border-loss/40 bg-loss/10 rounded-[4px] px-3 py-2">
                {error}
              </div>
            )}
            {info && (
              <div className="text-success text-[12px] border border-success/40 bg-success/10 rounded-[4px] px-3 py-2">
                {info}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-pill btn-pill-primary w-full">
              {loading ? "Creating…" : "Create account"}
            </button>
          </div>

          <div className="text-center text-[11px] text-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-accent-text hover:underline">
              Sign in
            </Link>
          </div>
        </form>

        <footer className="mt-12 grid grid-cols-3 gap-3 text-center">
          {[
            { num: "01", label: "Create account" },
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
