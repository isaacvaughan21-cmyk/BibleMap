import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hodos.app";
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Hodos — The way, the path. An infinite mind map for Bible study.",
  description:
    "Capture every question, connect every insight, and walk deeper into scripture. Hodos is an infinite zoomable mind map for Bible study. Join the waitlist.",
  openGraph: {
    title: "Hodos — The way, the path.",
    description:
      "An infinite, zoomable mind map for Bible study. Join the waitlist.",
    url: SITE_URL,
    siteName: "Hodos",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hodos — The way, the path.",
    description:
      "An infinite, zoomable mind map for Bible study. Join the waitlist.",
  },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Hodos",
      url: SITE_URL,
      description:
        "An infinite, zoomable mind map for Bible study. ΟΔΟΣ — the way, the path.",
    },
    {
      "@type": "WebSite",
      name: "Hodos",
      url: SITE_URL,
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        {children}

        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* Plausible — privacy-first analytics (loaded only when configured) */}
        {PLAUSIBLE_DOMAIN && (
          <Script
            defer
            data-domain={PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}

        {/* Vercel Web Analytics — page views + visitors */}
        <Analytics />
      </body>
    </html>
  );
}
