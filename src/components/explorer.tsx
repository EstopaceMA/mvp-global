"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowRight, Globe2, MousePointer2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { GlobeClient } from "./globe/globe-client";
import { FilterBar } from "./filter-bar";
import { Results, DataError } from "./results";
import { useDirectory } from "./providers";
import { useFilters } from "@/hooks/use-filters";
import { useMedia } from "@/hooks/use-media";
import { countries, formatCount, manifest, snapshotDate } from "@/lib/catalog";
import { filterParams, hasFilters, queryDirectory, updateFilters, viewHref } from "@/lib/directory";
import type { Filters } from "@/lib/types";

export function Explorer() {
  const { profiles } = useDirectory();
  const { filters, setFilters } = useFilters();
  const [failed, setFailed] = useState(false);
  const [opened, setOpened] = useState(false);
  const [mobileEditing, setMobileEditing] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const resultsButton = useRef<HTMLButtonElement>(null);
  const mobile = useMedia("(max-width: 767px)");
  const key = filterParams(filters).toString();
  const showResults = opened || (!mobileEditing && hasFilters(filters) && dismissed !== key);
  useEffect(() => {
    const restore = () => setMobileEditing(false);
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const country = countries.find(country => country.slug === filters.country);
  const result = profiles ? queryDirectory(profiles, countries, filters) : null;
  const counts = result?.counts ?? manifest.counts;
  const total = result?.globalTotal ?? manifest.profileCount;
  const onFailure = useCallback(() => setFailed(true), []);
  const onSelect = useCallback((slug: string) => { setFilters({ country: slug }); setMobileEditing(false); setOpened(true); }, [setFilters]);
  const onOpenChange = (open: boolean) => { setOpened(open); if (!open) setDismissed(key); };
  const onFilterInteraction = (values: Partial<Filters>) => {
    if (!mobile || values.country) { setMobileEditing(false); setOpened(true); }
    else {
      // Let mobile visitors finish typing before opening the modal results sheet.
      // URL updates may commit separately from this state; suppress automatic opening throughout editing.
      setMobileEditing(true);
      setOpened(false);
      const next = updateFilters(filters, values);
      next.q = next.q.trim().slice(0, 200);
      setDismissed(filterParams(next).toString());
    }
  };
  const activeCountries = Object.values(counts).filter(Boolean).length;
  return <main id="main-content" className={`explorer ${showResults ? "sheet-open" : ""} ${hasFilters(filters) ? "has-filters" : ""} ${failed ? "globe-unavailable" : ""}`}>
    <div className="atlas-grid" aria-hidden="true"/>
    {!failed && <GlobeClient counts={counts} selected={filters.country} sheetOpen={showResults} onSelect={onSelect} onFailure={onFailure}/>}
    <div className="explorer-search"><FilterBar counts={counts} onInteract={onFilterInteraction} onSubmit={() => setOpened(true)}/><DataError/></div>
    <section className="explorer-intro" aria-label="Welcome to the community atlas">
      <h1>One community.<br/>A world of<br/><span>possibilities.</span></h1>
      <p className="intro-copy">Meet the people who make<br className="desktop-break"/> technology move forward.</p>
    </section>
    {failed && <section className="globe-fallback" role="status"><span className="fallback-icon"><Globe2 size={36}/></span><h2>A world of expertise.<br/>Another way to explore.</h2><p>The 3D globe isn’t available on this device. Every MVP is still a search away.</p><Button asChild><Link href={viewHref("/mvps", filters)}>Open the directory<ArrowRight size={16}/></Link></Button><p className="text-xs">Or choose a country above to browse its profiles here.</p></section>}
    <div className="atlas-stats"><div><span className="stat-value">{formatCount(total)}</span><span className="stat-label"><Users size={12}/>MICROSOFT MVPs</span></div><div className="stat-divider"/><div><span className="stat-value">{activeCountries}</span><span className="stat-label"><Globe2 size={12}/>COUNTRIES & REGIONS</span></div></div>
    <div className="globe-legend"><span>MVPs BY COUNTRY</span><div className="legend-ramp"/><div className="legend-values"><span>0</span><span>{formatCount(Math.max(1, ...Object.values(counts)))}</span></div><small>Marker size & color · logarithmic scale</small></div>
    <div className="atlas-bottom"><p><MousePointer2 size={13}/>Drag to explore <span>·</span> Scroll to zoom</p><span className="snapshot-label"><span className="status-dot"/>Snapshot · {snapshotDate}</span><Link href="/about">About this atlas<ArrowUpRight size={12}/></Link></div>
    <Button className="show-results-button" ref={resultsButton} onClick={() => setOpened(true)}><Users size={15}/>View {formatCount(result?.total ?? total)} MVPs<ArrowRight size={15}/></Button>
    <Sheet open={showResults} onOpenChange={onOpenChange} modal={mobile}>
      <SheetContent side={mobile ? "bottom" : "right"} className="country-sheet" showCloseButton={false}
        onOpenAutoFocus={event => { if (!mobile) event.preventDefault(); }}
        onInteractOutside={event => { if (!mobile) event.preventDefault(); }}
        onCloseAutoFocus={event => { event.preventDefault(); resultsButton.current?.focus(); }}>
        <SheetHeader className="country-sheet-header">
          <div className="country-sheet-heading">
            <SheetTitle className="country-sheet-title">{country?.name ?? "Find your people."}</SheetTitle>
            <SheetDescription>{country ? "Extraordinary expertise. Right here." : "A shared passion for what’s possible."}</SheetDescription>
          </div>
          <div className="sheet-actions"><SheetClose asChild><Button variant="ghost" size="icon" aria-label="Close results"><X size={18}/></Button></SheetClose></div>
        </SheetHeader>
        <div className="sheet-scroll" key={`${filters.country}-${filters.page}`}><Results compact/></div>
      </SheetContent>
    </Sheet>
  </main>;
}
