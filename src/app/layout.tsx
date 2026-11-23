import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope, Noto_Sans_SC } from "next/font/google";
import { siteConfig } from "@/lib/site";
import "./globals.css";
import { AdPixels } from "@/components/public/AdPixels";
import { UtmCapture } from "@/components/public/UtmCapture";
import { PageViewBeacon } from "@/components/public/PageViewBeacon";
import { Suspense } from "react";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const admin = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-admin",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description:
    "Stream addictive English short dramas in minutes. CEO romance, revenge, werewolf, hidden identity, and billionaire stories. Watch free episodes, then go VIP.",
  applicationName: siteConfig.name,
  keywords: [
    "short dramas",
    "English short dramas",
    "vertical drama",
    "CEO romance",
    "werewolf romance",
    "revenge drama",
    "billionaire romance",
    "ShortXMax",
  ],
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description:
      "Short dramas that hook you in minutes. Binge exclusive English vertical series — free episodes, then unlock everything with VIP.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: "Short dramas that hook you in minutes.",
    images: ["/og.jpg"],
  },
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#070708",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${admin.variable}`}>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <UtmCapture />
        <AdPixels />
        <Suspense fallback={null}>
          <PageViewBeacon />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
