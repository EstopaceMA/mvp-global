"use client";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProfilePortrait } from "@/components/profile-portrait";
import { countryById } from "@/lib/catalog";
import type { MvpProfile } from "@/lib/types";

export function ProfileCard({ profile, href, compact = false }: { profile: MvpProfile; href: string; compact?: boolean }) {
  const country = countryById.get(profile.countryId);
  return <article className={`profile-card ${compact ? "compact" : ""}`}>
    <div className="profile-content">
      <div className="profile-top"><ProfilePortrait key={profile.id} profile={profile} /><div className="min-w-0"><h3><Link href={href} prefetch={false} className="profile-name-link">{profile.name}</Link></h3><p className="profile-country"><MapPin size={12} />{country?.name ?? "Country not listed"}</p></div><span className="mvp-label">MVP</span></div>
      <div className="profile-categories">{profile.awardCategories.map(category => <Badge variant="secondary" key={category}>{category}</Badge>)}</div>
      <div className="profile-technologies"><p className="eyebrow">TECHNOLOGY EXPERTISE</p><div>{profile.technologies.map(technology => <span key={technology}>{technology}</span>)}</div></div>
      <Link className="profile-link" href={href} prefetch={false} aria-label={`View ${profile.name}’s profile`}>View profile <ArrowRight size={15} aria-hidden="true" /></Link>
    </div>
  </article>;
}
