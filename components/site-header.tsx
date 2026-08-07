import Link from "next/link";
import { UserMenu } from "@/components/user-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/80 backdrop-blur-md">
      <div className="container-pp flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="text-2xl" aria-hidden>
            🎉
          </span>
          <span className="text-lg">
            Party<span className="gradient-text">Plan</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/plan" className="btn-ghost btn px-3 py-2 text-sm">
            Plan a party
          </Link>
          <Link href="/themes" className="btn-ghost btn px-3 py-2 text-sm">
            Themes
          </Link>
          <Link href="/ideas" className="btn-ghost btn px-3 py-2 text-sm">
            Ideas
          </Link>
          <Link href="/how-it-works" className="btn-ghost btn px-3 py-2 text-sm">
            How it works
          </Link>
        </nav>
        <UserMenu />
      </div>
    </header>
  );
}
