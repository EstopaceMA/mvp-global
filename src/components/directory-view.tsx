"use client";
import Link from "next/link";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { FilterBar } from "./filter-bar";
import { Results } from "./results";
import { useDirectory } from "./providers";
import { useFilters } from "@/hooks/use-filters";
import { countries, manifest } from "@/lib/catalog";
import { queryDirectory, viewHref } from "@/lib/directory";
import type { DirectoryResult } from "@/lib/server-directory";

export function DirectoryView({ initial }: { initial: DirectoryResult }) {
  const { profiles } = useDirectory();
  const { filters } = useFilters();
  const result = profiles ? queryDirectory(profiles, countries, filters) : initial;
  return <>
    <div className="directory-tools"><FilterBar counts={result.counts}/><Link href={viewHref("/", filters)} className="explore-link"><Globe2 size={16}/>Explore on globe<ArrowUpRight size={14}/></Link></div>
    <Results initial={initial}/>
    <div className="browse-countries"><p className="eyebrow">KEEP EXPLORING</p><h2>A community without borders.</h2><div>{countries.filter(country => manifest.counts[country.id]).map(country => <Link key={country.id} href={viewHref(`/countries/${country.slug}`, { ...filters, country: "", page: 1 })}>{country.name}<span>{manifest.counts[country.id]}</span></Link>)}</div></div>
  </>;
}
