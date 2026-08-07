import Link from "next/link";
import { FtcDisclosure } from "@/components/ftc-disclosure";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-brand-100 bg-white">
      <div className="container-pp py-10">
        <FtcDisclosure variant="compact" />
        <div className="mt-8 grid grid-cols-2 gap-8 text-sm md:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2 font-bold">
              <span aria-hidden>🎉</span> PartyPlan
            </div>
            <p className="text-foreground/60">
              AI-powered party planning with real, budget-balanced shopping lists.
            </p>
          </div>
          <FooterCol title="Plan" links={[["Plan a party", "/plan"], ["Themes", "/themes"], ["How it works", "/how-it-works"]]} />
          <FooterCol title="Learn" links={[["Party ideas", "/ideas"], ["Budget guide", "/ideas/budget-birthday-parties-how-much-to-spend"]]} />
          <FooterCol title="Legal" links={[["Affiliate disclosure", "/legal/affiliate-disclosure"], ["Privacy policy", "/legal/privacy"], ["Terms of service", "/legal/terms"]]} />
        </div>
        <p className="mt-8 text-xs text-foreground/50">
          © {new Date().getFullYear()} PartyPlan. Product data shown is illustrative and subject
          to merchant availability and affiliate approval.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="mb-3 font-semibold">{title}</div>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-foreground/60 hover:text-brand-600">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
