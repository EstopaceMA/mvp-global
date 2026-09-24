"use client";
import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { countryById } from "@/lib/catalog";
import type { MvpProfile } from "@/lib/types";

export function ProfileCard({ profile, compact = false }: { profile: MvpProfile; compact?: boolean }) {
  const [failedPhoto, setFailedPhoto] = useState(false);
  const country = countryById.get(profile.countryId);
  const initials = profile.name.split(/\s+/).filter(word => /\p{L}/u.test(word)).slice(0, 2).map(word => [...word][0]).join("").toUpperCase();
  return <Card className={`profile-card ${compact ? "compact" : ""}`}>
    <CardContent className="profile-content">
      <div className="profile-top"><div className="profile-avatar" aria-hidden="true">
        {profile.photoUrl && !failedPhoto ? <Image src={profile.photoUrl} alt="" fill sizes="56px" loading="lazy" onError={() => setFailedPhoto(true)} /> : <span>{initials}</span>}
      </div><div className="min-w-0"><h3>{profile.name}</h3><p className="profile-country"><MapPin size={12}/>{country?.name ?? "Country not listed"}</p></div><span className="mvp-label">MVP</span></div>
      <div className="profile-categories"><p className="eyebrow">AWARD CATEGORY</p>{profile.awardCategories.map(category => <Badge variant="secondary" key={category}>{category}</Badge>)}</div>
      <div className="profile-technologies"><p className="eyebrow">TECHNOLOGY EXPERTISE</p><div>{profile.technologies.map(technology => <span key={technology}>{technology}</span>)}</div></div>
      <a className="profile-link" href={profile.officialProfileUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${profile.name}’s official Microsoft MVP profile (opens in a new tab)`}>View official profile <ArrowUpRight size={15}/></a>
    </CardContent>
  </Card>;
}
