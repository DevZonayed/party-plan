"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const endpoint = mode === "login" ? "/api/auth/signin" : "/api/auth/signup";
      const payload = mode === "login" ? { email, password } : { email, password, name };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      router.push(next);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card-pp mx-auto max-w-sm space-y-4 p-6">
      <h1 className="text-center text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="text-center text-sm text-foreground/60">
        {mode === "login" ? "Log in to manage your parties." : "Save plans and create shareable event pages."}
      </p>
      {mode === "signup" ? (
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input className="input-pp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
      ) : null}
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input className="input-pp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Password</label>
        <input className="input-pp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={loading} className="btn-primary btn w-full py-3">
        {loading ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
      </button>
      <p className="text-center text-sm text-foreground/60">
        {mode === "login" ? (
          <>No account? <a href="/signup" className="text-brand-600 underline">Sign up</a></>
        ) : (
          <>Have an account? <a href="/login" className="text-brand-600 underline">Log in</a></>
        )}
      </p>
    </form>
  );
}
