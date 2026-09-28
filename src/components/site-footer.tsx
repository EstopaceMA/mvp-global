import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { snapshotDate } from "@/lib/catalog";
export function Footer() {
  return <footer className="site-footer">
    <Link href="/" className="footer-wordmark" aria-label="MVP Global home">MVP GLOBAL</Link>
    <div className="footer-meta">
      <span className="footer-brand"><Image src="/mvp-logo.png" alt="" width={24} height={24} sizes="24px" className="footer-logo"/><span className="footer-tagline">A community without borders.</span></span>
      <nav aria-label="Footer"><span>Snapshot · {snapshotDate}</span><Link href="/about">About & attribution<ArrowUpRight size={12}/></Link></nav>
    </div>
  </footer>;
}
