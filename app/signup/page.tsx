"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

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
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-8">
          <div className="text-accent font-semibold tracking-[0.18em] text-[14px]">AETERNUM</div>
          <div className="text-muted text-[10px] tracking-[0.12em] mt-1">PORTFOLIO TRACKER</div>
        </div>
        <form onSubmit={onSubmit} className="bg-panel border border-border rounded-[4px] p-6 space-y-4">
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
            <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
              autoComplete="new-password"
            />
          </div>
          {error && <div className="text-red text-[12px]">{error}</div>}
          {info && <div className="text-green text-[12px]">{info}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-bg py-2 rounded font-semibold tracking-wider text-[12px] uppercase disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
          <div className="text-center text-[11px] text-muted pt-2">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
