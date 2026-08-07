import Link from "next/link";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser("ADMIN");
  const nav: [string, string][] = [
    ["/admin", "Overview"],
    ["/admin/catalog", "Catalog"],
    ["/admin/analytics", "Analytics"],
    ["/admin/articles", "Articles"],
  ];
  return (
    <div className="container-pp py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Admin</h1>
        <Link href="/dashboard" className="text-sm text-foreground/60 hover:text-brand-600">← Dashboard</Link>
      </div>
      <nav className="mb-6 flex gap-2">
        {nav.map(([href, label]) => (
          <Link key={href} href={href} className="btn-secondary btn px-3 py-2 text-sm">{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
