import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import profiles from "../src/data/profiles.json";
import countries from "../src/data/countries.json";
import { getProfileMetadata, profilePreviewSize } from "../src/lib/profile-metadata";
import { getSiteUrl } from "../src/lib/site-url";
import { loadPreviewPortrait } from "../src/lib/preview-portrait";
import { createProfilePreview, profilePreviewElement } from "../src/lib/profile-preview-image";
import { selectPreviewFonts } from "../src/lib/preview-fonts";
import type { MvpProfile } from "../src/lib/types";

const profile: MvpProfile = {
    id: "snapshot-123",
    name: "Alex Morgan",
    countryId: "CA",
    photoUrl: null,
    awardCategories: ["Microsoft Azure", "Developer Technologies"],
    technologies: ["TypeScript"],
    officialProfileUrl: "https://mvp.microsoft.com/en-US/mvp/profile/upstream-id",
};
const photoUrl = "https://images.mvp.microsoft.com/snapshot-123?638923082332734763&size=original&sig=a%2Bb%2Fc%3D&tag=one&tag=two";
const maxImageBytes = 5 * 1024 * 1024;
// Generate genuine, non-square image bytes in memory; no fixtures or network needed.
const pngBytes = new Uint8Array(await sharp({
    create: { width: 480, height: 160, channels: 3, background: "#24567a" },
}).png().toBuffer());
const logo = `data:image/png;base64,${Buffer.from(pngBytes).toString("base64")}`;

function imageResponse(headers: HeadersInit = { "content-type": "image/png" }, status = 200) {
    return new Response(pngBytes, { headers, status });
}

async function assertPortraitPng(portrait: string | null) {
    assert.ok(portrait);
    assert.match(portrait, /^data:image\/png;base64,/);
    const bytes = Buffer.from(portrait.slice("data:image/png;base64,".length), "base64");
    assert.equal((await sharp(bytes).metadata()).format, "png");
    // Decode pixels too: metadata alone does not prove the image is usable.
    const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 240);
    assert.equal(info.height, 272);
    assert.equal(data.length, 240 * 272 * info.channels);
}

test("metadata canonical and preview URLs use snapshot IDs for duplicate names", () => {
    const duplicates = profiles.filter(entry => entry.name === "Ben Thomas");
    assert.equal(duplicates.length, 2);
    const metadata = duplicates.map(entry => getProfileMetadata(entry));
    duplicates.forEach((entry, index) => {
        assert.equal(metadata[index].alternates.canonical, `/mvps/${entry.id}`);
        assert.equal(metadata[index].openGraph.url, `/mvps/${entry.id}`);
        assert.equal(metadata[index].openGraph.images[0].url, `/mvps/${entry.id}/preview`);
        assert.equal(metadata[index].twitter.images[0].url, `/mvps/${entry.id}/preview`);
    });
    assert.notEqual(metadata[0].alternates.canonical, metadata[1].alternates.canonical);
    assert.notEqual(metadata[0].openGraph.images[0].url, metadata[1].openGraph.images[0].url);
});

test("metadata encodes the snapshot ID and does not derive URLs from names or official links", () => {
    const original = getProfileMetadata({ ...profile, id: "a/b?# é" });
    const renamed = getProfileMetadata({ ...profile, id: "a/b?# é", name: "Different Name" });
    assert.equal(original.alternates.canonical, "/mvps/a%2Fb%3F%23%20%C3%A9");
    assert.equal(original.openGraph.url, original.alternates.canonical);
    assert.equal(original.openGraph.images[0].url, "/mvps/a%2Fb%3F%23%20%C3%A9/preview");
    assert.equal(original.twitter.images[0].url, original.openGraph.images[0].url);
    assert.equal(renamed.alternates.canonical, original.alternates.canonical);
    assert.equal(renamed.openGraph.images[0].url, original.openGraph.images[0].url);
});

test("OG and Twitter share preview image, title, country, and every award category", () => {
    const metadata = getProfileMetadata(profile, "Canada");
    const title = "Alex Morgan — Microsoft MVP";
    const description = "Meet Alex Morgan, a Microsoft MVP in Canada recognized in Microsoft Azure, Developer Technologies. Explore their technology expertise and official Microsoft profile.";
    assert.equal(metadata.title, title);
    assert.equal(metadata.description, description);
    assert.equal(metadata.openGraph.type, "profile");
    assert.equal(metadata.openGraph.siteName, "MVP Global");
    assert.equal(metadata.openGraph.title, title);
    assert.equal(metadata.openGraph.description, description);
    assert.equal(metadata.twitter.card, "summary_large_image");
    assert.equal(metadata.twitter.title, title);
    assert.equal(metadata.twitter.description, description);
    assert.deepEqual(profilePreviewSize, { width: 1200, height: 630 });
    assert.deepEqual(metadata.openGraph.images, [{
        url: "/mvps/snapshot-123/preview", width: 1200, height: 630,
        type: "image/png", alt: `${title} · Canada`,
    }]);
    assert.deepEqual(metadata.twitter.images, [{ url: "/mvps/snapshot-123/preview", alt: `${title} · Canada` }]);
});

test("metadata omits unavailable country and awards without dangling text", () => {
    const metadata = getProfileMetadata({ ...profile, awardCategories: [] });
    assert.equal(metadata.description, "Meet Alex Morgan, a Microsoft MVP. Explore their technology expertise and official Microsoft profile.");
    assert.equal(metadata.openGraph.images[0].alt, "Alex Morgan — Microsoft MVP");
    assert.equal(metadata.twitter.images[0].alt, metadata.openGraph.images[0].alt);
    assert.equal(getProfileMetadata(profile, "").description,
        "Meet Alex Morgan, a Microsoft MVP recognized in Microsoft Azure, Developer Technologies. Explore their technology expertise and official Microsoft profile.");
    assert.equal(getProfileMetadata({ ...profile, awardCategories: [] }, "Canada").description,
        "Meet Alex Morgan, a Microsoft MVP in Canada. Explore their technology expertise and official Microsoft profile.");
});

const siteUrlCases: [string, Parameters<typeof getSiteUrl>[0], string][] = [
    ["SITE_URL wins and strips path, query, and fragment", {
        SITE_URL: "https://directory.example.test/path?query=1#fragment",
        VERCEL_PROJECT_PRODUCTION_URL: "production.example.test", VERCEL_URL: "preview.example.test", PORT: "4321",
    }, "https://directory.example.test/"],
    ["explicit HTTP origin preserves its port", { SITE_URL: "http://localhost:4444/nested" }, "http://localhost:4444/"],
    ["production deployment wins over preview and PORT", {
        VERCEL_PROJECT_PRODUCTION_URL: "production.example.test", VERCEL_URL: "preview.example.test", PORT: "4321",
    }, "https://production.example.test/"],
    ["preview deployment wins over PORT", { VERCEL_URL: "preview.example.test", PORT: "4321" }, "https://preview.example.test/"],
    ["localhost uses PORT", { PORT: "4321" }, "http://localhost:4321/"],
    ["localhost defaults to port 3000", {}, "http://localhost:3000/"],
    ["empty settings fall through", {
        SITE_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "", VERCEL_URL: "preview.example.test",
    }, "https://preview.example.test/"],
    ["all empty settings use localhost", {
        SITE_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "", VERCEL_URL: "", PORT: "",
    }, "http://localhost:3000/"],
];
for (const [name, env, expected] of siteUrlCases) {
    test(`getSiteUrl: ${name}`, () => {
        const result = getSiteUrl(env);
        assert.ok(result instanceof URL);
        assert.equal(result.href, expected);
    });
}

for (const source of [
    "ftp://example.test", "file:///tmp/preview", "javascript:alert(1)", "data:text/plain,hello",
    "https://user:password@example.test", "https://user@example.test", "https://:password@example.test",
]) {
    test(`getSiteUrl rejects unsafe SITE_URL ${source} rather than falling back`, () => {
        assert.throws(() => getSiteUrl({ SITE_URL: source, VERCEL_URL: "valid.example.test" }),
            /HTTP\(S\) origin without credentials/);
    });
}

test("getSiteUrl rejects malformed explicit URLs and credentials in deployment URLs", () => {
    assert.throws(() => getSiteUrl({ SITE_URL: "not a URL", VERCEL_URL: "valid.example.test" }), TypeError);
    assert.throws(() => getSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "user:password@production.example.test" }), /without credentials/);
    assert.throws(() => getSiteUrl({ VERCEL_URL: "user@preview.example.test" }), /without credentials/);
});

for (const source of [null, ""]) {
    test(`missing portrait ${JSON.stringify(source)} returns null without fetching`, async t => {
        const fetchImage = t.mock.fn<typeof fetch>(async () => imageResponse());
        assert.equal(await loadPreviewPortrait(source, fetchImage), null);
        assert.equal(fetchImage.mock.callCount(), 0);
    });
}

for (const source of [
    "not a URL",
    "//images.mvp.microsoft.com/photo",
    "http://images.mvp.microsoft.com/photo",
    "https://example.test/photo",
    "https://images.mvp.microsoft.com.example.test/photo",
    "https://sub.images.mvp.microsoft.com/photo",
    "https://images.mvp.microsoft.com:8443/photo",
    "https://images.mvp.microsoft.com@evil.example.test/photo",
    "https://user@images.mvp.microsoft.com/photo",
    "https://:password@images.mvp.microsoft.com/photo",
    "https://localhost/photo",
    "https://127.0.0.1/photo",
    "file:///tmp/photo.png",
    "data:image/png;base64,aGVsbG8=",
]) {
    test(`unsafe portrait source is not fetched: ${source}`, async t => {
        const fetchImage = t.mock.fn<typeof fetch>(async () => imageResponse());
        assert.equal(await loadPreviewPortrait(source, fetchImage), null);
        assert.equal(fetchImage.mock.callCount(), 0);
    });
}

test("portrait fetch preserves the entire photo query and sets caching, redirect, and timeout options", async t => {
    const fetchImage = t.mock.fn<typeof fetch>(async () => imageResponse());
    await assertPortraitPng(await loadPreviewPortrait(photoUrl, fetchImage));
    assert.equal(fetchImage.mock.callCount(), 1);
    const [source, options] = fetchImage.mock.calls[0].arguments;
    assert.equal(source, photoUrl);
    assert.equal(options?.redirect, "error");
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
});

for (const [format, contentType] of [
    ["jpeg", "image/jpeg; charset=binary"], ["jpeg", "image/jpg"],
    ["webp", "IMAGE/WEBP"], ["gif", "image/gif"],
    ["jpeg", "application/octet-stream"],
] as const) {
    test(`valid ${contentType} portrait decodes to a 240x272 PNG`, async t => {
        const bytes = new Uint8Array(await sharp(pngBytes).toFormat(format).toBuffer());
        const fetchImage = t.mock.fn<typeof fetch>(async () => new Response(bytes, { headers: { "content-type": contentType } }));
        await assertPortraitPng(await loadPreviewPortrait(photoUrl, fetchImage));
        assert.equal(fetchImage.mock.callCount(), 1);
    });
}

test("portrait 404 returns null even with otherwise valid image bytes", async t => {
    const response = imageResponse({ "content-type": "image/png" }, 404);
    const fetchImage = t.mock.fn<typeof fetch>(async () => response);
    assert.equal(await loadPreviewPortrait(photoUrl, fetchImage), null);
    assert.equal(fetchImage.mock.callCount(), 1);
    assert.equal(response.bodyUsed, false);
});

for (const contentType of [null, "text/html", "image/svg+xml", "image/png-invalid"]) {
    test(`portrait rejects unsupported content type ${JSON.stringify(contentType)} before reading`, async t => {
        const response = imageResponse(contentType ? { "content-type": contentType } : {});
        const fetchImage = t.mock.fn<typeof fetch>(async () => response);
        assert.equal(await loadPreviewPortrait(photoUrl, fetchImage), null);
        assert.equal(fetchImage.mock.callCount(), 1);
        assert.equal(response.bodyUsed, false);
    });
}

test("portrait response without a body returns null", async t => {
    const fetchImage = t.mock.fn<typeof fetch>(async () => new Response(null, { headers: { "content-type": "image/png" } }));
    assert.equal(await loadPreviewPortrait(photoUrl, fetchImage), null);
    assert.equal(fetchImage.mock.callCount(), 1);
});

test("binary blob responses still reject SVG and corrupt content by actual format", async t => {
    for (const body of ['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" /></svg>', "not an image"]) {
        const fetchImage = t.mock.fn<typeof fetch>(async () => new Response(body, { headers: { "content-type": "application/octet-stream" } }));
        assert.equal(await loadPreviewPortrait(photoUrl, fetchImage), null);
    }
});

test("portrait oversized Content-Length is rejected before reading image bytes", async t => {
    const response = imageResponse({ "content-type": "image/png", "content-length": String(maxImageBytes + 1) });
    const fetchImage = t.mock.fn<typeof fetch>(async () => response);
    assert.equal(await loadPreviewPortrait(photoUrl, fetchImage), null);
    assert.equal(response.bodyUsed, false);
});

test("portrait Content-Length at the size limit is not rejected", async t => {
    const fetchImage = t.mock.fn<typeof fetch>(async () => imageResponse({
        "content-type": "image/png", "content-length": String(maxImageBytes),
    }));
    await assertPortraitPng(await loadPreviewPortrait(photoUrl, fetchImage));
});

for (const advertisedLength of [undefined, "64"]) {
    test(`oversized portrait stream is cancelled with ${advertisedLength ? "underreported" : "missing"} Content-Length`, async t => {
        let reads = 0;
        const cancel = t.mock.fn();
        const chunks = [new Uint8Array(maxImageBytes), new Uint8Array(1), pngBytes];
        const body = new ReadableStream<Uint8Array>({
            pull(controller) {
                if (reads < chunks.length) controller.enqueue(chunks[reads++]);
                else controller.close();
            },
            cancel,
        }, { highWaterMark: 0 });
        const headers = new Headers({ "content-type": "image/png" });
        if (advertisedLength) headers.set("content-length", advertisedLength);
        const fetchImage = t.mock.fn<typeof fetch>(async () => new Response(body, { headers }));
        assert.equal(await loadPreviewPortrait(photoUrl, fetchImage), null);
        assert.equal(reads, 2, "stop as soon as the byte limit is exceeded");
        assert.equal(cancel.mock.callCount(), 1);
        assert.equal(body.locked, false, "release the reader after cancelling");
    });
}

test("portrait stream read failures return null and release the reader", async t => {
    let reads = 0;
    const body = new ReadableStream<Uint8Array>({
        pull(controller) {
            if (reads++ === 0) controller.enqueue(pngBytes.slice(0, 20));
            else controller.error(new Error("image stream interrupted"));
        },
    });
    const fetchImage = t.mock.fn<typeof fetch>(async () => new Response(body, { headers: { "content-type": "image/png" } }));
    assert.equal(await loadPreviewPortrait(photoUrl, fetchImage), null);
    assert.equal(reads, 2);
    assert.equal(body.locked, false);
});

for (const [name, bytes] of [
    ["empty", new Uint8Array()], ["corrupt", new TextEncoder().encode("not an image")], ["truncated", pngBytes.slice(0, 24)],
] as const) {
    test(`${name} portrait bytes return null instead of an unusable data URL`, async t => {
        const fetchImage = t.mock.fn<typeof fetch>(async () => new Response(bytes, { headers: { "content-type": "image/png" } }));
        assert.equal(await loadPreviewPortrait(photoUrl, fetchImage), null);
        assert.equal(fetchImage.mock.callCount(), 1);
    });
}

for (const failure of [new TypeError("network failure"), new TypeError("redirect rejected"), new DOMException("aborted", "AbortError")]) {
    test(`portrait fetch failure returns null: ${failure.message}`, async t => {
        const fetchImage = t.mock.fn<typeof fetch>(async () => { throw failure; });
        assert.equal(await loadPreviewPortrait(photoUrl, fetchImage), null);
        assert.equal(fetchImage.mock.callCount(), 1);
    });
}

test("portrait fetch uses a 3000ms AbortSignal deadline and returns null when it expires", async t => {
    const controller = new AbortController();
    // Control the deadline without sleeping for three seconds or making a request.
    const timeout = t.mock.method(AbortSignal, "timeout", () => controller.signal);
    const fetchImage = t.mock.fn<typeof fetch>((_source, options) => new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
    }));
    const result = loadPreviewPortrait(photoUrl, fetchImage);
    assert.equal(timeout.mock.callCount(), 1);
    assert.deepEqual(timeout.mock.calls[0].arguments, [3000]);
    assert.equal(fetchImage.mock.callCount(), 1);
    assert.equal(fetchImage.mock.calls[0].arguments[1]?.signal, controller.signal);
    controller.abort(new DOMException("portrait deadline exceeded", "TimeoutError"));
    assert.equal(await result, null);
});

test("preview HTML includes the complete longest snapshot name, all awards, country, ID, and initials", () => {
    const longest = profiles.reduce((a, b) => a.name.length > b.name.length ? a : b);
    const country = countries.find(entry => entry.id === longest.countryId);
    assert.ok(country);
    assert.equal(longest.name, "Jayanth Dattatri Yajaman Kodandarama Bhatta");
    assert.ok(longest.awardCategories.length > 1);
    const html = renderToStaticMarkup(profilePreviewElement(longest, country.name, null, logo));
    for (const text of [longest.name, country.name, longest.id, ...longest.awardCategories, "Microsoft MVP", "MVP GLOBAL"]) {
        assert.ok(html.includes(text), `missing preview text: ${text}`);
    }
    assert.match(html, />JD<\/div>/);
    assert.match(html, /MVP ID · /);
    assert.equal((html.match(/<img\b/g) ?? []).length, 1, "only the logo is rendered when the portrait is missing");
});

test("preview HTML renders the supplied embedded portrait instead of initials or the remote photo", async t => {
    const fetchImage = t.mock.fn<typeof fetch>(async () => imageResponse());
    const portrait = await loadPreviewPortrait(photoUrl, fetchImage);
    assert.ok(portrait);
    const html = renderToStaticMarkup(profilePreviewElement({ ...profile, photoUrl }, "Canada", portrait, logo));
    assert.ok(html.includes(`src="${portrait}"`));
    assert.ok(html.includes(`src="${logo}"`));
    assert.match(html, /width="216" height="244"/);
    assert.equal((html.match(/<img\b/g) ?? []).length, 2);
    assert.doesNotMatch(html, />AM<\/div>/);
    assert.ok(!html.includes("images.mvp.microsoft.com"));
    for (const text of [profile.name, "Canada", profile.id, ...profile.awardCategories]) assert.ok(html.includes(text));
});

test("preview HTML escapes profile text and tolerates no awards", () => {
    const html = renderToStaticMarkup(profilePreviewElement({
        ...profile, name: "Alex <Morgan> & Co", awardCategories: [],
    }, "Trinidad & Tobago", null, logo));
    assert.ok(html.includes("Alex &lt;Morgan&gt; &amp; Co"));
    assert.ok(html.includes("Trinidad &amp; Tobago"));
    assert.ok(html.includes(profile.id));
    assert.ok(!html.includes("<Morgan>"));
});

test("all snapshot profile text is covered by local preview fonts", () => {
    const text = [...profiles.flatMap(profile => [profile.name, ...profile.awardCategories]), ...countries.map(country => country.name)].join(" ");
    assert.deepEqual(selectPreviewFonts(text).missing, []);
});

test("portrait loader retries an upstream failure instead of caching bad bytes", async t => {
    let attempt = 0;
    const fetchImage = t.mock.fn<typeof fetch>(async () => ++attempt === 1
        ? new Response("temporarily unavailable", { headers: { "content-type": "image/png" } })
        : imageResponse());
    assert.equal(await loadPreviewPortrait(photoUrl, fetchImage), null);
    await assertPortraitPng(await loadPreviewPortrait(photoUrl, fetchImage));
    assert.equal(fetchImage.mock.callCount(), 2);
    for (const call of fetchImage.mock.calls) assert.equal(call.arguments[1]?.cache, "no-store");
});

for (const name of ["Alex Morgan", "경용 이", "瀬尾 俊行", "机械小鸽", "Adam Kopeć"]) {
    test(`real ImageResponse renders ${name} into a decodable 1200x630 PNG without network`, async t => {
        const fetchEmbedded = globalThis.fetch;
        const externalRequests: string[] = [];
        t.mock.method(globalThis, "fetch", async (source: Parameters<typeof fetch>[0], options?: RequestInit) => {
            // Next initializes its bundled WASM with a data URL; that is not network I/O.
            if (String(source).startsWith("data:")) return fetchEmbedded(source, options);
            externalRequests.push(String(source));
            throw new Error("unexpected network request");
        });
        const response = await createProfilePreview({ ...profile, name }, "Canada");
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-type"), "image/png");
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal((await sharp(bytes).metadata()).format, "png");
        const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
        assert.equal(info.width, 1200);
        assert.equal(info.height, 630);
        assert.equal(data.length, 1200 * 630 * info.channels);
        assert.deepEqual(externalRequests, []);
    });
}