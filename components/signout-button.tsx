"use client";
import { useRouter } from "next/navigation";
export function SignoutButton() {
  const router = useRouter();
  async function out() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <button onClick={out} className="btn-ghost btn px-3 py-2 text-sm">
      Log out
    </button>
  );
}
