import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { countries, formatCount, manifest, snapshotDate } from "@/lib/catalog";
import { serverResults, type SearchParams } from "@/lib/server-directory";
import { DirectoryView } from "@/components/directory-view";
import { Footer } from "@/components/site-footer";

type Props = { params: Promise<{ country: string }>; searchParams: Promise<SearchParams> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country: slug } = await params;
  const country = countries.find(country => country.slug === slug);
  return { title: country ? `Microsoft MVPs in ${country.name}` : "Country not found", description: country ? `Explore Microsoft MVPs and technology expertise in ${country.name}.` : undefined };
}
export default async function CountryPage({ params, searchParams }: Props) {
  const { country: slug } = await params;
  const country = countries.find(country => country.slug === slug);
  if (!country) notFound();
  const initial = serverResults(await searchParams, slug);
  return <><main id="main-content" className="directory-page page-container">
    <Link href="/mvps" className="back-link"><ArrowLeft size={14}/>Global directory</Link>
    <div className="directory-heading country-heading"><div><h1>{country.name}<span className="country-heading-dot">.</span></h1><p>Local knowledge. Global impact.</p></div><div className="directory-summary"><strong>{formatCount(manifest.counts[country.id] ?? 0)}</strong><span>Microsoft MVPs in this snapshot</span><small>Updated {snapshotDate}</small></div></div>
    <DirectoryView initial={initial}/>
  </main><Footer/></>;
}
