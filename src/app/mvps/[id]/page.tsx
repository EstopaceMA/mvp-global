import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { MvpIdCard } from "@/components/mvp-id-card";
import { ProfileBackLink } from "@/components/profile-back-link";
import { Footer } from "@/components/site-footer";
import { countryById } from "@/lib/catalog";
import { getProfileById } from "@/lib/server-directory";
import { getProfileMetadata } from "@/lib/profile-metadata";

type Props = { params: Promise<{ id: string }> };

// No build-time fan-out: cache each snapshot-backed page on its first request.
// Do not read searchParams here; filters belong to the client-side back link.
export function generateStaticParams() { return []; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const profile = getProfileById((await params).id);
    if (!profile) notFound();
    return getProfileMetadata(profile, countryById.get(profile.countryId)?.name);
}

export default async function MvpPage({ params }: Props) {
    const profile = getProfileById((await params).id);
    if (!profile) notFound();
    return <><main id="main-content" className="mvp-profile-page page-container">
        <Suspense fallback={<span className="back-link" aria-hidden="true"><ArrowLeft size={14} />Back to directory</span>}><ProfileBackLink /></Suspense>
        <MvpIdCard profile={profile} />
        <section className="mvp-profile-expertise" aria-labelledby="expertise-heading">
            <h2 id="expertise-heading" className="eyebrow">Technology expertise</h2>
            {profile.technologies.length ? <ul>{profile.technologies.map(technology => <li key={technology}>{technology}</li>)}</ul> : <p>No technology expertise listed in this snapshot.</p>}
        </section>
        <a href={profile.officialProfileUrl} className="mvp-official-link" target="_blank" rel="noopener noreferrer">View official Microsoft profile<ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
    </main><Footer /></>;
}