"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./icons";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback?next=${next}` },
      });
      if (error) setError(error.message);
      else {
        // If email confirmation is off, a session exists and we can go straight in.
        const { data } = await supabase.auth.getSession();
        if (data.session) router.replace(next);
        else setMessage("Check your email to confirm your account, then sign in.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.replace(next);
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-6 flex items-center gap-2">
        <span className="text-brand">
          <Icon name="sparkles" width={26} height={26} />
        </span>
        <span className="text-lg font-semibold">Social Action Vault</span>
      </div>
      <h1 className="mb-1 text-2xl font-bold">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="muted mb-6 text-sm">
        {mode === "signup"
          ? "Start saving posts and turning them into action."
          : "Sign in to your vault."}
      </p>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}

        <button className="btn-primary mt-2" disabled={loading}>
          {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="muted mt-6 text-center text-sm">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-brand">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="text-brand">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
