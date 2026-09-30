import { Suspense } from "react";
import Link from "next/link";
import { Explorer } from "@/components/explorer";
import { manifest } from "@/lib/catalog";

export default function Home() {
  return <Suspense fallback={<main id="main-content" className="explorer"><div className="atlas-grid" /><section className="explorer-intro"><h1>One community.<br />A world of<br /><span>possibilities.</span></h1><p className="intro-copy">Discover {manifest.profileCount.toLocaleString("en")} Microsoft MVPs across {manifest.countryCount} countries and regions.</p><Link href="/mvps" className="explore-link">Browse the directory →</Link></section><div className="globe-loading" role="status"><div className="loading-orbit" /><span>Preparing your atlas…</span></div></main>}><Explorer /></Suspense>;
}
