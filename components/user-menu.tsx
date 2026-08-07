"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Me = { id: string; name: string | null; email: string; role: string } | null;

export function UserMenu() {
  const [me, setMe] = useState<Me>(undefined as unknown as Me);
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.user ?? null))
      .catch(() => setMe(null));
  }, []);
  if (me === (undefined as unknown as Me)) {
    return <span className="h-9 w-20 animate-pulse rounded-lg bg-brand-100" />;
  }
  if (!me) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="btn-ghost btn px-3 py-2 text-sm">
          Log in
        </Link>
        <Link href="/plan" className="btn-primary btn px-4 py-2 text-sm">
          Plan a party
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link href="/dashboard" className="btn-secondary btn px-3 py-2 text-sm">
        Dashboard
      </Link>
      {me.role === "ADMIN" ? (
        <Link href="/admin" className="btn-ghost btn px-3 py-2 text-sm">
          Admin
        </Link>
      ) : null}
    </div>
  );
}
