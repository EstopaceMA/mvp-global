import { profileHref } from "./profile";
import { EMPTY_FILTERS, type MvpProfile } from "./types";

export function getProfileShareData(profile: Pick<MvpProfile, "id" | "name">, siteUrl: URL) {
    const url = new URL(profileHref(profile.id, EMPTY_FILTERS), siteUrl.origin).href;
    const title = `${profile.name} — Microsoft MVP`;
    return {
        url,
        links: [
            { platform: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}` },
            { platform: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url })}` },
            { platform: "X", href: `https://twitter.com/intent/tweet?${new URLSearchParams({ url, text: title })}` },
        ],
    };
}

export type ProfileShareData = ReturnType<typeof getProfileShareData>;