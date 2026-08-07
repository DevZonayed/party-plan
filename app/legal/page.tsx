import Link from "next/link";

export const metadata = { title: "Legal" };

export default function LegalPage() {
  const pages: [string, string][] = [
    ["affiliate-disclosure", "Affiliate disclosure"],
    ["privacy", "Privacy policy"],
    ["terms", "Terms of service"],
  ];
  return (
    <div className="container-pp py-12">
      <h1 className="text-2xl font-bold">Legal</h1>
      <ul className="mt-6 space-y-3">
        {pages.map(([slug, title]) => (
          <li key={slug}>
            <Link href={"/legal/" + slug} className="card-pp block p-4 hover:border-brand-300">{title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
