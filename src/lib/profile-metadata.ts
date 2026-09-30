import type { Metadata } from "next";
import type { MvpProfile } from "./types";

export const profilePreviewSize = { width: 1200, height: 630 };

export function getProfileMetadata(profile: MvpProfile, country?: string) {
    const path = `/mvps/${encodeURIComponent(profile.id)}`;
    const title = `${profile.name} — Microsoft MVP`;
    const description = `Meet ${profile.name}, a Microsoft MVP${country ? ` in ${country}` : ""}${profile.awardCategories.length ? ` recognized in ${profile.awardCategories.join(", ")}` : ""}. Explore their technology expertise and official Microsoft profile.`;
    const image = {
        url: `${path}/preview`, ...profilePreviewSize, type: "image/png",
        alt: `${title}${country ? ` · ${country}` : ""}`,
    };
    return {
        title, description,
        alternates: { canonical: path },
        openGraph: { type: "profile", title, description, url: path, siteName: "MVP Global", images: [image] },
        twitter: { card: "summary_large_image", title, description, images: [{ url: image.url, alt: image.alt }] },
    } satisfies Metadata;
}