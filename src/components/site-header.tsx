"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Globe2, LayoutGrid, Moon, Sun, ArrowUpRight } from "lucide-react";
import { useTheme } from "next-themes";
import { useFilters } from "@/hooks/use-filters";
import { viewHref } from "@/lib/directory";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Brand() {
  return <Link href="/" className="brand" aria-label="MVP Global home"><Image src="/mvp-logo.png" alt="" width={38} height={38} sizes="38px" loading="eager" className="brand-mark"/><span>MVP<span className="brand-global">GLOBAL</span><small>THE COMMUNITY ATLAS</small></span></Link>;
}
export function SiteHeader() {
  const pathname = usePathname();
  const { filters } = useFilters();
  const { resolvedTheme, setTheme } = useTheme();
  return <header className="site-header">
    <Brand />
    <nav className="primary-nav" aria-label="Main navigation">
      <Link href={viewHref("/", filters)} className={cn("nav-link", pathname === "/" && "active")} aria-current={pathname === "/" ? "page" : undefined}><Globe2 size={15}/><span>Explore</span></Link>
      <Link href={viewHref("/mvps", filters)} className={cn("nav-link", pathname === "/mvps" || pathname.startsWith("/countries/") ? "active" : "")} aria-current={pathname === "/mvps" ? "page" : undefined}><LayoutGrid size={15}/><span>Directory</span></Link>
      <Link href="/about" className={cn("nav-link about-nav", pathname === "/about" && "active")}>About</Link>
    </nav>
    <div className="header-actions"><a className="program-link" href="https://mvp.microsoft.com/" target="_blank" rel="noopener noreferrer">Microsoft MVP program <ArrowUpRight size={13}/></a>
      <Button variant="ghost" size="icon" className="theme-toggle" aria-label="Toggle color theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}><Sun className="theme-icon theme-icon-sun" size={17} aria-hidden="true"/><Moon className="theme-icon theme-icon-moon" size={17} aria-hidden="true"/></Button>
    </div>
  </header>;
}
