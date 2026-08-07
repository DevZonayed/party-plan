import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "PartyPlan — AI Kids' Birthday Party Planner",
    template: "%s · PartyPlan",
  },
  description:
    "Describe your child's party and our AI builds a complete, budget-balanced shopping plan from real party supplies — then a shareable event page where guests RSVP and buy gifts.",
  keywords: [
    "birthday party planner",
    "kids party supplies",
    "party shopping list",
    "AI party planner",
    "bluey party",
    "spiderman party",
    "unicorn party",
  ],
  openGraph: {
    title: "PartyPlan — AI Kids' Birthday Party Planner",
    description:
      "AI builds your complete, budget-balanced party shopping list from real products.",
    type: "website",
    siteName: "PartyPlan",
  },
  twitter: { card: "summary_large_image", title: "PartyPlan", description: "AI party planning" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geistSans.variable + " " + geistMono.variable + " h-full antialiased"}>
      <body className="flex min-h-full flex-col confetti-bg">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
