import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Brand, SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: { default: "MVP Global — A world of expertise", template: "%s | MVP Global" },
  description: "Discover Microsoft Most Valuable Professionals around the world. Explore the globe, find your community, and connect with extraordinary technology expertise.",
  applicationName: "MVP Global",
  icons: { icon: { url: "/mvp-logo.png", type: "image/png" } },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>
    <Providers><a className="skip-link" href="#main-content">Skip to content</a>
      <Suspense fallback={<header className="site-header"><Brand/><nav className="primary-nav" aria-label="Main navigation"><Link className="nav-link" href="/">Explore</Link><Link className="nav-link" href="/mvps">Directory</Link><Link className="nav-link about-nav" href="/about">About</Link></nav><div className="header-actions"><span className="theme-toggle" aria-hidden="true"/></div></header>}><SiteHeader/></Suspense>
      {children}
    </Providers>
  </body></html>;
}
