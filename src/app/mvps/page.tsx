import type { Metadata } from "next";
import { DirectoryView } from "@/components/directory-view";
import { serverResults, type SearchParams } from "@/lib/server-directory";
import { formatCount, manifest, snapshotDate } from "@/lib/catalog";
import { Footer } from "@/components/site-footer";

export const metadata: Metadata = { title: "The directory", description: "Find Microsoft MVPs by name, country, region, award category, and technology expertise." };
export default async function DirectoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const initial = serverResults(await searchParams);
  return <><main id="main-content" className="directory-page page-container">
    <div className="directory-heading"><div><p className="eyebrow"><span className="status-dot"/>THE GLOBAL DIRECTORY</p><h1>Extraordinary people.<br/><span>Shared possibilities.</span></h1><p>Find the expertise. Make the connection.</p></div><div className="directory-summary"><strong>{formatCount(manifest.profileCount)}</strong><span>Microsoft MVPs · {manifest.countryCount} countries</span><small>Snapshot updated {snapshotDate}</small></div></div>
    <DirectoryView initial={initial}/>
  </main><Footer/></>;
}
