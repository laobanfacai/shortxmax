"use client";

import Link from "next/link";
import { safePath } from "@/lib/safe-path";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({
  mode,
  nextPath,
}: {
  mode: "login" | "signup";
  nextPath: string;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const payload = {
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
      name: String(form.get("name") || "").trim(),
    };
    if (!payload.email || !payload.password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "signup" && payload.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    let res: Response;
    try { res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }); } catch { setPending(false); setError("Network error. Please try again."); return; }
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    router.push(safePath(nextPath));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-surface p-7">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold">
          {mode === "login" ? "Welcome back" : "Start watching"}
        </p>
        <h1 className="mt-1 font-display text-4xl">
          {mode === "login" ? "Sign in" : "Create your account"}
        </h1>
      </div>
      {mode === "signup" ? (
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" maxLength={80} className="input" autoComplete="name" />
        </div>
      ) : null}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" maxLength={254} type="email" required className="input" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          maxLength={72}
          minLength={mode === "signup" ? 8 : 1}
          className="input"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button type="submit" className="btn btn-gold btn-lg w-full" disabled={pending}>
        {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
      </button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href={`/signup?next=${encodeURIComponent(nextPath)}`} className="text-gold">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="text-gold">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
