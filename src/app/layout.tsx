import type { Metadata, Viewport } from "next";
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
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#080e19" }, { media: "(prefers-color-scheme: light)", color: "#f5f7fb" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>
    <Providers><a className="skip-link" href="#main-content">Skip to content</a>
      <Suspense fallback={<header className="site-header"><Brand/><nav aria-label="Main navigation"><a href="/mvps">Directory</a></nav></header>}><SiteHeader/></Suspense>
      {children}
    </Providers>
  </body></html>;
}
