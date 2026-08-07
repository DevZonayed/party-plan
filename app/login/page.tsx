import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="container-pp py-12">
      <Suspense fallback={<div className="card-pp mx-auto max-w-sm p-6 text-center text-foreground/60">Loading…</div>}>
        <AuthForm mode="login" />
      </Suspense>
      <div className="mx-auto mt-4 max-w-sm rounded-xl border border-brand-100 bg-brand-50/50 p-4 text-center text-sm text-foreground/70">
        <p className="font-semibold">Demo accounts</p>
        <p className="mt-1">Host: host@example.com · Admin: admin@example.com</p>
        <p>Password: <code className="rounded bg-white px-1">partyplan</code></p>
        <Link href="/signup" className="mt-2 inline-block text-brand-600 underline">Or create an account →</Link>
      </div>
    </div>
  );
}
