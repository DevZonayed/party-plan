import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="container-pp py-12">
      <Suspense fallback={<div className="card-pp mx-auto max-w-sm p-6 text-center text-foreground/60">Loading…</div>}>
        <AuthForm mode="signup" />
      </Suspense>
    </div>
  );
}
