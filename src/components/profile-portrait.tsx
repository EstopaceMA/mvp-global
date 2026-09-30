"use client";

import Image from "next/image";
import { useState } from "react";
import { profileInitials } from "@/lib/profile";
import type { MvpProfile } from "@/lib/types";

export function ProfilePortrait({ profile, className = "profile-avatar", sizes = "56px", eager = false }: {
    profile: MvpProfile; className?: string; sizes?: string; eager?: boolean;
}) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    return <div className={className} aria-hidden="true">
        {profile.photoUrl && failedUrl !== profile.photoUrl
            ? <Image src={profile.photoUrl} alt="" fill sizes={sizes} loading={eager ? "eager" : "lazy"} onError={() => setFailedUrl(profile.photoUrl)} />
            : <span>{profileInitials(profile.name)}</span>}
    </div>;
}