"use client";
import { ArrowLeft, ArrowRight, SearchX, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileCard } from "@/components/profile-card";
import { useDirectory } from "@/components/providers";
import { useFilters } from "@/hooks/use-filters";
import { countries, formatCount, manifest } from "@/lib/catalog";
import { queryDirectory, filterParams, EMPTY_FILTERS } from "@/lib/directory";
import type { DirectoryResult } from "@/lib/server-directory";

export function ResultsSkeleton() {
  return <div className="results-grid" aria-label="Loading profiles" role="status">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-64 rounded-xl"/>)}<span className="sr-only">Loading MVP profiles</span></div>;
}

export function DataError() {
  const { error, retry } = useDirectory();
  return error ? <div className="data-error" role="alert"><p>{error}</p><Button variant="outline" size="sm" onClick={retry}><RefreshCw size={13}/>Retry directory</Button></div> : null;
}

export function Results({ initial, compact = false }: { initial?: DirectoryResult; compact?: boolean }) {
  const { profiles, error } = useDirectory();
  const { filters, setFilters } = useFilters();
  const country = countries.find(country => country.slug === filters.country);
  const fallback = initial && filterParams(initial.filters).toString() === filterParams(filters).toString() ? initial : null;
  const result = profiles ? queryDirectory(profiles, countries, filters) : fallback;
  if (!result) return error ? <DataError/> : <ResultsSkeleton/>;
  const noSourceProfiles = country && !manifest.counts[country.id];
  return <div className={compact ? "results-container compact-results" : "results-container"}>
    <div className="results-meta"><p role="status" aria-live="polite"><strong>{formatCount(result.total)}</strong> {result.total === 1 ? "MVP" : "MVPs"}{country ? ` in ${country.name}` : " to discover"}</p><span>NAME A–Z</span></div>
    {error && <DataError/>}
    {result.total === 0 ? <div className="empty-results"><span className="empty-icon"><SearchX size={26}/></span><h3>{noSourceProfiles ? "No profiles in this snapshot" : "No matching MVPs"}</h3><p>{noSourceProfiles ? `This snapshot has no public profiles listed for ${country.name}.` : "Try a different search or give your filters a little more room."}</p><Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>Explore all MVPs</Button></div> : <div className="results-grid">{result.profiles.map(profile => <ProfileCard profile={profile} key={profile.id} compact={compact}/>)}</div>}
    {result.pages > 1 && <nav className="pagination" aria-label="Results pagination">
      <Button variant="outline" size="sm" aria-label="Previous page" disabled={result.page <= 1} onClick={() => setFilters({ page: result.page - 1 })}><ArrowLeft size={14}/><span>Previous</span></Button>
      <span>Page <strong>{result.page}</strong> of {result.pages}</span>
      <Button variant="outline" size="sm" aria-label="Next page" disabled={result.page >= result.pages} onClick={() => setFilters({ page: result.page + 1 })}><span>Next</span><ArrowRight size={14}/></Button>
    </nav>}
  </div>;
}
