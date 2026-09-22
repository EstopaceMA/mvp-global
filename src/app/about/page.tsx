import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Globe2, Heart, ShieldCheck, RefreshCw } from "lucide-react";
import { Footer } from "@/components/site-footer";
import { formatCount, manifest, snapshotDate } from "@/lib/catalog";

export const metadata: Metadata = { title: "About the atlas" };
export default function AboutPage() {
  return <><main id="main-content" className="about-page page-container">
    <h1>Great expertise deserves<br/><span>to be discovered.</span></h1>
    <p className="about-lead">Microsoft Most Valuable Professionals share what they know, help others grow, and move technology forward. This atlas makes that global community a little easier to find.</p>
    <div className="about-numbers"><div><strong>{formatCount(manifest.profileCount)}</strong><span>Public MVP profiles</span></div><div><strong>{manifest.countryCount}</strong><span>Countries & regions</span></div><div><strong>{manifest.technologies.length}</strong><span>Technology areas</span></div></div>
    <div className="about-grid"><section><Globe2/><h2>One world. Many perspectives.</h2><p>Explore by geography, or search for the expertise you need. Every profile card links directly to Microsoft’s official directory so you can learn more from the source.</p><Link href="/">Explore the globe<ArrowUpRight size={15}/></Link></section>
      <section><RefreshCw/><h2>A snapshot, openly shared.</h2><p>This edition was collected on {snapshotDate}. It includes all {formatCount(manifest.profileCount)} public results returned by the source at that time, with country, award-category, and technology details.</p><p>The directory is refreshed through new snapshots. It is not a live record of award status, and coverage of public profiles does not establish coverage of every award holder.</p></section>
      <section><ShieldCheck/><h2>The source comes first.</h2><p>Names, photos, categories, and technologies come from public Microsoft MVP profiles. Photos remain hosted by Microsoft. We do not infer award years from years in the program or publish personal addresses or coordinates.</p><p>If information needs correcting, use the official profile and Microsoft MVP program channels. A later snapshot can reflect the correction.</p><a href={manifest.source} target="_blank" rel="noopener noreferrer">Microsoft MVP directory<ArrowUpRight size={15}/></a></section>
      <section><Heart/><h2>Made to be accessible.</h2><p>The globe is an invitation, not a requirement. The directory offers the same profiles and filters with keyboard navigation, and remains available when 3D graphics are unsupported.</p><Link href="/mvps">Browse the directory<ArrowUpRight size={15}/></Link></section></div>
    <section className="attribution"><p className="eyebrow">ATTRIBUTION & INDEPENDENCE</p><p>MVP Global is an independent community directory, not an official Microsoft product. Microsoft and Microsoft MVP are trademarks of Microsoft. Profile content and photographs belong to their respective owners.</p><p>Country boundaries: <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth (public domain)</a>, distributed through <a href="https://github.com/topojson/world-atlas" target="_blank" rel="noopener noreferrer">World Atlas</a>. Simplified boundaries are for discovery; markers provide access to smaller territories. Country and region names preserve source labels.</p><p>Globe rendering: <a href="https://magicui.design/docs/components/globe" target="_blank" rel="noopener noreferrer">Magic UI Globe</a>, powered by <a href="https://cobe.vercel.app/" target="_blank" rel="noopener noreferrer">COBE</a>.</p></section>
  </main><Footer/></>;
}
