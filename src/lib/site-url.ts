type SiteEnvironment = Record<string, string | undefined>;

// Use deployment configuration, not request headers, so profile HTML stays cacheable.
export function getSiteUrl(env: SiteEnvironment = process.env) {
    const deployment = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
    const url = new URL(env.SITE_URL || (deployment ? `https://${deployment}` : `http://localhost:${env.PORT || "3000"}`));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("SITE_URL must be a public HTTP(S) origin without credentials.");
    }
    return new URL(url.origin);
}