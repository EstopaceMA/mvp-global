import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import type { MvpProfile, Country } from "../../src/lib/types";
import { getSiteUrl } from "../../src/lib/site-url";

const profiles = JSON.parse(readFileSync(new URL("../../src/data/profiles.json", import.meta.url), "utf8")) as MvpProfile[];
const countries = JSON.parse(readFileSync(new URL("../../src/data/countries.json", import.meta.url), "utf8")) as Country[];
const longest = profiles.reduce((a, b) => a.name.length > b.name.length ? a : b);
const noPhoto = profiles.find(profile => !profile.photoUrl)!;
const duplicates = profiles.filter(profile => profile.name === "Ben Thomas");
const unicode = profiles.find(profile => /[\p{Script=Han}\p{Script=Hangul}]/u.test(profile.name))!;

for (const userAgent of ["Twitterbot/1.0", "facebookexternalhit/1.1", "Slackbot-LinkExpanding 1.0"]) {
    test(`${userAgent} gets profile-specific previews in server-rendered head without JavaScript`, async ({ request }) => {
        for (const profile of [longest, ...duplicates]) {
            const path = `/mvps/${profile.id}`;
            const response = await request.get(`${path}?q=Azure&page=2&country=philippines`, { headers: { "User-Agent": userAgent } });
            expect(response.status()).toBe(200);
            const head = (await response.text()).split("</head>")[0];
            const tags = new Map([...head.matchAll(/<meta (?:property|name)="([^"]+)" content="([^"]*)"/g)].map(match => [match[1], match[2]]));
            const canonical = head.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
            const country = countries.find(country => country.id === profile.countryId)!;
            const expectedUrl = new URL(path, getSiteUrl()).href;
            const expectedImage = `${expectedUrl}/preview`;
            expect(canonical).toBe(expectedUrl);
            expect(tags.get("og:url")).toBe(expectedUrl);
            expect(tags.get("og:type")).toBe("profile");
            expect(tags.get("og:title")).toBe(`${profile.name} — Microsoft MVP`);
            expect(tags.get("og:description")).toContain(country.name);
            for (const category of profile.awardCategories) expect(tags.get("og:description")).toContain(category);
            expect(tags.get("og:image")).toBe(expectedImage);
            expect(tags.get("og:image:width")).toBe("1200");
            expect(tags.get("og:image:height")).toBe("630");
            expect(tags.get("og:image:type")).toBe("image/png");
            expect(tags.get("og:image:alt")).toContain(profile.name);
            expect(tags.get("twitter:card")).toBe("summary_large_image");
            expect(tags.get("twitter:image")).toBe(expectedImage);
            expect(tags.get("twitter:title")).toBe(tags.get("og:title"));
            expect(tags.get("twitter:description")).toBe(tags.get("og:description"));
            expect(tags.get("twitter:image:alt")).toBe(tags.get("og:image:alt"));
        }
    });
}

test("ID-based previews serve real PNGs for long names, missing photos, duplicates, and Unicode names", async ({ request }, testInfo) => {
    const hashes: string[] = [];
    for (const profile of [longest, noPhoto, ...duplicates, unicode]) {
        const response = await request.get(`/mvps/${profile.id}/preview`);
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toContain("image/png");
        const image = await response.body();
        expect(image.byteLength).toBeLessThan(5 * 1024 * 1024);
        const metadata = await sharp(image).metadata();
        expect(metadata.format).toBe("png");
        expect(metadata.width).toBe(1200);
        expect(metadata.height).toBe(630);
        expect((await sharp(image).stats()).entropy).toBeGreaterThan(1);
        hashes.push(image.toString("base64"));
        await testInfo.attach(`preview-${profile.id}`, { body: image, contentType: "image/png" });
        // Unrelated filters cannot alter a preview's identity, pixels, or cache key.
        const again = await request.get(`/mvps/${profile.id}/preview?q=unrelated&page=9`);
        expect(again.status()).toBe(200);
        expect(await again.body()).toEqual(image);
        // The normal E2E command uses dev; ISR assertions apply to production.
        if (process.env.PREVIEW_TEST_PRODUCTION === "1") {
            expect(again.headers()["cache-control"]).toContain("s-maxage=86400");
            expect(again.headers()["x-nextjs-cache"]).toBe("HIT");
        }
    }
    expect(new Set(hashes).size).toBe(hashes.length);
});

test("unknown profile IDs have neither fabricated metadata nor preview images", async ({ request }) => {
    for (const id of ["not-an-mvp", "00000000-0000-0000-0000-000000000000"]) {
        const profile = await request.get(`/mvps/${id}`, { headers: { "User-Agent": "Twitterbot/1.0" } });
        expect(profile.status()).toBe(404);
        expect(await profile.text()).not.toContain('property="og:image"');
        const image = await request.get(`/mvps/${id}/preview`);
        expect(image.status()).toBe(404);
        expect(image.headers()["content-type"]).not.toContain("image/png");
    }
});