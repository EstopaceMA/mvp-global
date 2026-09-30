import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import type { Country, MvpProfile } from "../../src/lib/types";

const profiles = JSON.parse(readFileSync(new URL("../../src/data/profiles.json", import.meta.url), "utf8")) as MvpProfile[];
const countries = JSON.parse(readFileSync(new URL("../../src/data/countries.json", import.meta.url), "utf8")) as Country[];
function required<T>(value: T | undefined, description: string): T {
    if (value === undefined) throw new Error(`Snapshot fixture missing: ${description}`);
    return value;
}
const longest = profiles.reduce((a, b) => b.name.length > a.name.length ? b : a);
const missingPhoto = required(profiles.find(profile => !profile.photoUrl), "missing portrait");
const queryPhoto = required(profiles.find(profile => profile.photoUrl && new URL(profile.photoUrl).search), "portrait URL with query");
const byName = new Map<string, MvpProfile[]>();
for (const profile of profiles) byName.set(profile.name, [...(byName.get(profile.name) ?? []), profile]);
const duplicates = required([...byName.values()].find(group => group.length === 2 && group.every(profile => profile.photoUrl)), "duplicate name with two portraits");
const us = required(countries.find(country => country.slug === "united-states"), "United States");
const companion = required(countries.find(country => country.id !== us.id && country.region === us.region
    && profiles.some(profile => profile.countryId === country.id)), "second country in the same region");

// Choose a genuinely paginated intersection, not a page=2 URL clamped to page 1.
const usProfiles = profiles.filter(profile => profile.countryId === us.id);
const technology = required([...new Set(usProfiles.flatMap(profile => profile.technologies))]
    .sort((a, b) => usProfiles.filter(profile => profile.technologies.includes(b)).length
        - usProfiles.filter(profile => profile.technologies.includes(a)).length)[0], "common US technology");
const category = required(usProfiles.find(profile => profile.technologies.includes(technology)), "technology award").awardCategories[0];
const filters = new URLSearchParams([
    ["q", technology], ["country", us.slug], ["country", companion.slug],
    ["category", category], ["technology", technology], ["region", us.region],
]);
const filteredQuery = new URLSearchParams(filters);
filteredQuery.set("page", "2");
const interactiveMedia = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
const portraitFixture = readFileSync(new URL("../../public/mvp-logo.png", import.meta.url));

function microsoftPortrait(url: URL) {
    return url.origin === "https://images.mvp.microsoft.com";
}

function optimizedMicrosoftPortrait(url: URL) {
    const original = url.searchParams.get("url");
    if (url.pathname !== "/_next/image" || !original) return false;
    try { return new URL(original).origin === "https://images.mvp.microsoft.com"; }
    catch { return false; }
}

test.beforeEach(async ({ page, baseURL }) => {
    // Also keep production analytics off the external network.
    const origin = new URL(baseURL!).origin;
    await page.route(url => url.origin !== origin, route => route.fulfill({ status: 204, body: "" }));
    // Leave local brand images alone; no test relies on the remote portrait service.
    // Verify original portrait URLs work independently of optimizer availability.
    await page.route(optimizedMicrosoftPortrait, route => route.fulfill({ status: 402, body: "OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED" }));
    await page.route(microsoftPortrait, route => route.fulfill({ contentType: "image/png", body: portraitFixture }));
    await page.emulateMedia({ reducedMotion: "no-preference" });
});

async function expectProfile(page: Page, profile: MvpProfile) {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(profile.name);
    await expect(page.locator(".mvp-id-country")).toHaveText(required(countries.find(country => country.id === profile.countryId), "profile country").name);
    await expect(page.locator(".mvp-id-awards li")).toHaveText(profile.awardCategories);
    const identifier = page.locator(".mvp-id-number");
    await expect(identifier).toHaveText(`MVP ID · ${profile.id}`);
    await expect(identifier).toBeVisible();
    expect(await identifier.ariaSnapshot()).toContain(profile.id);
    await expect(page.locator(".mvp-id-bottom")).not.toContainText("THE COMMUNITY ATLAS");
    await expect(page.locator(".mvp-profile-expertise li")).toHaveText(profile.technologies);
    const official = page.getByRole("link", { name: "View official Microsoft profile (opens in a new tab)", exact: true });
    await expect(official).toHaveAttribute("href", profile.officialProfileUrl);
    await expect(official).toHaveAttribute("target", "_blank");
    await expect(official).toHaveAttribute("rel", /\bnoopener\b/);
    await expect(official).toHaveAttribute("rel", /\bnoreferrer\b/);
}

async function expectLocalLinks(row: Locator, profile: MvpProfile, query: URLSearchParams) {
    const href = `/mvps/${profile.id}?${query}`;
    for (const selector of ["h3 a", ".profile-link"]) {
        await expect(row.locator(selector)).toHaveAttribute("href", href);
        await expect(row.locator(selector)).toHaveJSProperty("target", "");
    }
    await expect(row.locator("h3 a")).toHaveText(profile.name);
}

async function expectLoadedPortrait(page: Page, profile: MvpProfile) {
    const image = page.locator(".mvp-id-portrait img");
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(element => {
        const image = element as HTMLImageElement;
        return image.complete && image.naturalWidth > 0;
    })).toBe(true);
    await expect(image).toHaveJSProperty("currentSrc", profile.photoUrl);
    expect(await image.getAttribute("srcset")).toBeNull();
    await expect(image).toHaveAttribute("loading", "eager");
    await expect(page.locator(".mvp-id-portrait span")).toHaveCount(0);
}

async function expectInitials(page: Page, profile: MvpProfile) {
    const initials = profile.name.split(/\s+/).filter(word => /\p{L}/u.test(word)).slice(0, 2).map(word => [...word][0]).join("").toUpperCase();
    await expect(page.locator(".mvp-id-portrait span")).toHaveText(initials);
    await expect(page.locator(".mvp-id-portrait span")).toBeVisible();
    await expect(page.locator(".mvp-id-portrait img")).toHaveCount(0);
}

// Sample rendered transforms on animation frames, including intermediate spring values.
// For rotateX followed by rotateY, these matrix entries recover the two angles.
async function motionSamples(page: Page, frames = 1) {
    return page.locator(".mvp-id-stage").evaluate(async (stage, frames) => {
        const card = stage.querySelector<HTMLElement>(".mvp-id-card")!;
        const layers = {
            near: stage.querySelector<HTMLElement>(".mvp-id-refraction--near")!,
            far: stage.querySelector<HTMLElement>(".mvp-id-refraction--far")!,
            spotlight: stage.querySelector<HTMLElement>(".mvp-id-spotlight")!,
            watermark: stage.querySelector<HTMLElement>(".mvp-id-watermark")!,
            foil: stage.querySelector<HTMLElement>(".mvp-id-foil")!,
            texture: stage.querySelector<HTMLElement>(".mvp-id-texture")!,
        };
        const sampleLayer = (element: HTMLElement) => {
            const style = getComputedStyle(element);
            const matrix = new DOMMatrixReadOnly(style.transform);
            return {
                transform: style.transform,
                x: matrix.m41, y: matrix.m42,
                // Translation percentages use the layer's own untransformed border box,
                // not its perspective-distorted screen bounds (especially the 160% light).
                xPercent: matrix.m41 / element.offsetWidth * 100,
                yPercent: matrix.m42 / element.offsetHeight * 100,
                scaleX: Math.hypot(matrix.m11, matrix.m12, matrix.m13),
                scaleY: Math.hypot(matrix.m21, matrix.m22, matrix.m23),
                opacity: Number(style.opacity),
                background: style.backgroundImage, position: style.backgroundPosition,
                mask: style.maskImage, maskSize: style.maskSize, maskPosition: style.maskPosition,
                maskRepeat: style.maskRepeat, maskMode: style.maskMode,
                animation: style.animationName, active: element.getAnimations().length,
            };
        };
        const samples = [];
        for (let frame = 0; frame < frames; frame++) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            const cardStyle = getComputedStyle(card);
            const rotation = new DOMMatrixReadOnly(cardStyle.transform);
            samples.push({
                x: Math.atan2(rotation.m23, rotation.m22) * 180 / Math.PI,
                y: Math.atan2(rotation.m31, rotation.m11) * 180 / Math.PI,
                inline: card.style.transform, transform: cardStyle.transform,
                near: sampleLayer(layers.near), far: sampleLayer(layers.far),
                spotlight: sampleLayer(layers.spotlight), watermark: sampleLayer(layers.watermark),
                foil: sampleLayer(layers.foil), texture: sampleLayer(layers.texture),
            });
        }
        return samples;
    }, frames);
}

type MotionState = Awaited<ReturnType<typeof motionSamples>>[number];
const movingLayers = ["near", "far", "spotlight", "watermark"] as const;
const materialLayers = [...movingLayers, "foil", "texture"] as const;
const restOpacity = { near: 0.28, far: 0.22, spotlight: 0.14, watermark: 0.18 };
const hoverOpacity = { near: 0.55, far: 0.45, spotlight: 0.5, watermark: 0.3 };

function motionValues(state: MotionState) {
    return [state.x, state.y, ...materialLayers.flatMap(key => {
        const layer = state[key];
        return [layer.x, layer.y, layer.scaleX * 100, layer.scaleY * 100, layer.opacity * 100];
    })];
}

function neutralError(state: MotionState) {
    return Math.max(...[
        state.x, state.y,
        ...materialLayers.flatMap(key => {
            const layer = state[key];
            return [layer.x, layer.y, (layer.scaleX - 1) * 100, (layer.scaleY - 1) * 100];
        }),
        ...movingLayers.map(key => (state[key].opacity - restOpacity[key]) * 100),
    ].map(Math.abs));
}

async function expectNeutral(page: Page) {
    // A neutral transform is insufficient: the independent hover spring must also
    // return to the default opacities, on several consecutive rendered frames.
    await expect.poll(async () => Math.max(...(await motionSamples(page, 3)).map(neutralError))).toBeLessThan(0.05);
}

function expectStaticLayers(state: MotionState, initial: MotionState) {
    for (const key of ["foil", "texture"] as const) {
        expect(state[key]).toEqual(initial[key]);
        expect(state[key].animation).toBe("none");
        expect(state[key].active).toBe(0);
    }
    // Printed logos never slide, scale, or repaint their spectrum; only opacity changes.
    for (const key of ["transform", "background", "position", "mask", "maskSize", "maskPosition", "maskRepeat", "maskMode"] as const) {
        expect(state.watermark[key]).toEqual(initial.watermark[key]);
    }
    expect(state.watermark.animation).toBe("none");
    expect(state.watermark.active).toBe(0);
}

function expectMotionBounds(state: MotionState) {
    expect(Math.abs(state.x)).toBeLessThanOrEqual(6.001);
    expect(Math.abs(state.y)).toBeLessThanOrEqual(6.001);
    for (const [key, x, y, minScale, maxScale] of [
        ["near", 14, 10, 0.82, 1.18],
        ["far", 16, 12, 0.84, 1.16],
        ["spotlight", 31.25, 31.25, 1, 1],
        ["watermark", 0, 0, 1, 1],
    ] as const) {
        const layer = state[key];
        // offsetWidth/Height round fractional layout pixels; allow 0.05 percentage points.
        expect(Math.abs(layer.xPercent)).toBeLessThanOrEqual(x + 0.05);
        expect(Math.abs(layer.yPercent)).toBeLessThanOrEqual(y + 0.05);
        for (const scale of [layer.scaleX, layer.scaleY]) {
            expect(scale).toBeGreaterThanOrEqual(minScale - 0.001);
            expect(scale).toBeLessThanOrEqual(maxScale + 0.001);
        }
        expect(layer.scaleX).toBeCloseTo(layer.scaleY, 3);
        expect(layer.opacity).toBeGreaterThanOrEqual(restOpacity[key] - 0.001);
        expect(layer.opacity).toBeLessThanOrEqual(hoverOpacity[key] + 0.001);
    }
}

async function pointerMove(page: Page, x: number, y: number, pointerType = "mouse") {
    const stage = page.locator(".mvp-id-stage");
    const box = (await stage.boundingBox())!;
    await stage.dispatchEvent("pointermove", {
        pointerType, pointerId: 1, isPrimary: true,
        clientX: box.x + box.width * x, clientY: box.y + box.height * y
    });
}

async function expectTilt(page: Page, x: number, y: number) {
    const horizontal = y / 6, vertical = -x / 6;
    await expect.poll(async () => {
        const samples = await motionSamples(page, 3);
        const values = samples.map(motionValues);
        const drift = values.slice(1).flatMap(value => value.map((entry, index) => entry - values[0][index]));
        return Math.max(...[
            ...drift,
            ...samples.flatMap(state => [
                state.x - x, state.y - y,
                state.near.xPercent - 14 * horizontal, state.near.yPercent - 10 * vertical,
                state.far.xPercent + 16 * horizontal, state.far.yPercent + 12 * vertical,
                state.spotlight.xPercent - 31.25 * horizontal, state.spotlight.yPercent - 31.25 * vertical,
                (state.spotlight.scaleX - 1) * 100, (state.spotlight.scaleY - 1) * 100,
                ...movingLayers.map(key => (state[key].opacity - hoverOpacity[key]) * 100),
            ]),
        ].map(Math.abs));
    }).toBeLessThan(0.05);
    const [state] = await motionSamples(page);
    if (x || y) expect(state.inline).toMatch(/rotateX\(.+deg\).*rotateY\(.+deg\)/);
    expectMotionBounds(state);
    for (const [axis, direction] of [["x", horizontal], ["y", vertical]] as const) {
        if (!direction) continue;
        expect(state.near[axis] * state.far[axis], `Opposing ${axis} refraction`).toBeLessThan(0);
        expect(state.spotlight[axis] * direction, `Spotlight follows pointer ${axis}`).toBeGreaterThan(0);
    }
    if (horizontal || vertical) {
        expect(Math.abs(state.near.scaleX - 1)).toBeGreaterThan(0.05);
        expect(Math.abs(state.far.scaleX - 1)).toBeGreaterThan(0.05);
        expect(Math.abs(state.near.scaleX - state.far.scaleX)).toBeGreaterThan(0.01);
    }
    // On a diagonal both input axes agree, so check the exact scale mappings too.
    if (horizontal === vertical) {
        expect(state.near.scaleX).toBeCloseTo(1 + 0.18 * horizontal, 2);
        expect(state.far.scaleX).toBeCloseTo(1 - 0.16 * vertical, 2);
    }
    return state;
}

async function expectStaticAfterEvents(page: Page) {
    await expectNeutral(page);
    const [before] = await motionSamples(page);
    for (const pointerType of ["mouse", "touch"]) {
        await pointerMove(page, 3, -2, pointerType);
        const samples = await motionSamples(page, 12);
        for (const state of samples) {
            expect(neutralError(state)).toBeLessThan(0.05);
            expect(state.transform).toBe("none");
            for (const key of materialLayers) {
                expect(state[key].transform).toBe("none");
                expect(state[key]).toEqual(before[key]);
            }
            expectStaticLayers(state, before);
        }
    }
}

for (const query of ["", filteredQuery.toString()]) {
    test(`direct profile ${query ? "with filters" : "without filters"} renders only its record and metadata without loading the directory`, async ({ page }) => {
        const directoryRequests: string[] = [];
        page.on("request", request => {
            if (/\/data\/directory\.[^/]+\.json$/.test(new URL(request.url()).pathname)) directoryRequests.push(request.url());
        });
        await page.route("**/data/directory.*.json*", route => route.fulfill({ status: 503, body: "Unexpected directory request" }));
        const response = await page.goto(`/mvps/${longest.id}${query ? `?${query}` : ""}`);
        expect(response?.status()).toBe(200);
        const html = await response!.text();
        expect(profiles.filter(profile => html.includes(profile.id)).map(profile => profile.id)).toEqual([longest.id]);
        expect(longest.awardCategories.length).toBeGreaterThan(1);
        await expectProfile(page, longest);
        const country = required(countries.find(country => country.id === longest.countryId), "longest-name country");
        await expect(page).toHaveTitle(`${longest.name} — Microsoft MVP | MVP Global`);
        await expect(page.locator('meta[name="description"]')).toHaveAttribute("content",
            `Meet ${longest.name}, a Microsoft MVP in ${country.name} recognized in ${longest.awardCategories.join(", ")}. Explore their technology expertise and official Microsoft profile.`);
        const backHref = `/mvps${query ? `?${query}` : ""}`;
        await expect(page.getByRole("link", { name: "Back to directory", exact: true })).toHaveAttribute("href", backHref);
        const directory = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Directory", exact: true });
        await expect(directory).toHaveAttribute("aria-current", "location");
        await expect(directory).toHaveClass(/\bactive\b/);
        await expect(directory).toHaveAttribute("href", backHref);
        // Exercise a hydrated provider effect before checking the negative network assertion.
        await page.getByRole("button", { name: "Toggle color theme" }).click();
        await expect(page.locator("html")).toHaveClass(/dark/);
        await expectLoadedPortrait(page, longest);
        expect(directoryRequests).toEqual([]);
    });
}

for (const id of ["not-an-mvp", "00000000-0000-0000-0000-000000000000"]) {
    test(`invalid profile ${id} returns HTTP 404 and the existing recovery page`, async ({ page }) => {
        expect(profiles.some(profile => profile.id === id)).toBe(false);
        const response = await page.goto(`/mvps/${id}?${filteredQuery}`);
        expect(response?.status()).toBe(404);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let’s find your way back.");
        await expect(page.getByText("This page or country could not be found.", { exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: "Browse the global directory →", exact: true })).toHaveAttribute("href", "/mvps");
        await expect(page.locator(".mvp-id-card")).toHaveCount(0);
    });
}

for (const surface of ["/mvps", `/countries/${us.slug}`, "/"]) {
    for (const selector of ["h3 a", ".profile-link"]) {
        test(`${surface} ${selector} opens the ID in the same tab and preserves filters, pagination, and browser history`, async ({ page, context }) => {
            const countryRoute = surface.startsWith("/countries/");
            const originQuery = new URLSearchParams(filters);
            if (countryRoute) originQuery.delete("country");
            const effective = new URLSearchParams(filters);
            if (countryRoute) { effective.delete("country"); effective.append("country", us.slug); }
            // Derive the expected intersection independently of the app's query helper.
            const matches = profiles.filter(profile => effective.getAll("country").includes(required(countries.find(country => country.id === profile.countryId), "country").slug)
                && profile.awardCategories.includes(category) && profile.technologies.includes(technology))
                .sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id));
            expect(matches.length).toBeGreaterThan(24);
            await page.goto(`${surface}?${originQuery}`);
            const originPageOne = page.url();
            const results = page.locator(surface === "/" ? ".compact-results" : ".results-container");
            if (surface === "/") await expect(page.getByRole("dialog")).toBeVisible();
            await expect(results.locator(".profile-card h3")).toHaveText(matches.slice(0, 24).map(profile => profile.name));
            await results.getByRole("button", { name: "Next page", exact: true }).click();
            await expect(page).toHaveURL(url => url.searchParams.get("page") === "2");
            const originPageTwo = page.url();
            const pageTwo = matches.slice(24, 48);
            await expect(results.locator(".profile-card h3")).toHaveText(pageTwo.map(profile => profile.name));
            effective.set("page", "2");
            // The app serializes country before category/technology/region.
            const preserved = new URLSearchParams();
            for (const key of ["q", "country", "category", "technology", "region", "page"]) {
                for (const value of effective.getAll(key)) preserved.append(key, value);
            }
            const profile = pageTwo[0];
            const row = results.locator(".profile-card").first();
            await expectLocalLinks(row, profile, preserved);
            const tabCount = context.pages().length;
            await row.locator(selector).click();
            await expect(page).toHaveURL(new URL(`/mvps/${profile.id}?${preserved}`, originPageTwo).href);
            expect(context.pages()).toHaveLength(tabCount);
            await expectProfile(page, profile);
            const back = page.getByRole("link", { name: "Back to directory", exact: true });
            await expect(back).toHaveAttribute("href", `/mvps?${preserved}`);
            await back.click();
            await expect(page).toHaveURL(new URL(`/mvps?${preserved}`, originPageTwo).href);
            await expect(page.locator(".profile-card h3")).toHaveText(pageTwo.map(profile => profile.name));
            await expect(page.locator(".pagination strong")).toHaveText("2");
            await page.goBack();
            await expectProfile(page, profile);
            await page.goBack();
            await expect(page).toHaveURL(originPageTwo);
            await expect(results.locator(".profile-card h3")).toHaveText(pageTwo.map(profile => profile.name));
            await expect(results.locator(".pagination strong")).toHaveText("2");
            await page.goBack();
            await expect(page).toHaveURL(originPageOne);
            await expect(results.locator(".profile-card h3")).toHaveText(matches.slice(0, 24).map(profile => profile.name));
            await expect(results.locator(".pagination strong")).toHaveText("1");
            expect(context.pages()).toHaveLength(tabCount);
        });
    }
}

test("missing portraits show initials, while direct successful portraits retain the complete original URL", async ({ page }) => {
    await page.goto(`/mvps/${missingPhoto.id}`);
    await expectProfile(page, missingPhoto);
    await expectInitials(page, missingPhoto);
    await page.goto(`/mvps/${queryPhoto.id}`);
    await expectProfile(page, queryPhoto);
    await expectLoadedPortrait(page, queryPhoto);
});

test("directory and ID-card portraits use original URLs while logos remain optimized", async ({ page }) => {
    const optimizedRequests: string[] = [];
    page.on("request", request => {
        if (optimizedMicrosoftPortrait(new URL(request.url()))) optimizedRequests.push(request.url());
    });
    // Microsoft's real blob responses can use this MIME type, even for valid images.
    await page.route(microsoftPortrait, route => route.fulfill({ contentType: "application/octet-stream", body: portraitFixture }));
    const query = new URLSearchParams({ q: queryPhoto.name });
    await page.goto(`/mvps?${query}`);
    const row = page.locator(".profile-card").filter({ has: page.locator(`h3 a[href^="/mvps/${queryPhoto.id}?"]`) });
    const portrait = row.locator(".profile-avatar img");
    await portrait.scrollIntoViewIfNeeded();
    await expect(portrait).toHaveAttribute("loading", "lazy");
    await expect(portrait).toHaveJSProperty("currentSrc", queryPhoto.photoUrl);
    expect(await portrait.getAttribute("srcset")).toBeNull();
    await expect.poll(() => portrait.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await row.locator("h3 a").click();
    await expectLoadedPortrait(page, queryPhoto);
    const logo = page.locator(".mvp-id-brand img");
    await expect.poll(() => logo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const logoSource = new URL(await logo.evaluate(image => (image as HTMLImageElement).currentSrc));
    expect(logoSource.pathname).toBe("/_next/image");
    expect(logoSource.searchParams.get("url")).toBe("/mvp-logo.png");
    expect(optimizedRequests).toEqual([]);
});

test("failed direct Microsoft portraits with query strings show initials without intercepting brand images", async ({ page }) => {
    const aborted: string[] = [];
    await page.route(microsoftPortrait, route => {
        aborted.push(route.request().url());
        return route.abort();
    });
    await page.goto(`/mvps/${queryPhoto.id}`);
    await expectInitials(page, queryPhoto);
    expect(aborted).toContain(queryPhoto.photoUrl);
    expect(aborted.every(url => new URL(url).origin === "https://images.mvp.microsoft.com")).toBe(true);
    await expect(page.locator(".mvp-id-brand img")).toBeVisible();
    await expect(page.locator(".brand-mark")).toBeVisible();
    await expectProfile(page, queryPhoto);
});

test("duplicate names link to distinct IDs and navigating identities resets portrait failure and tilt", async ({ page }) => {
    await page.route(microsoftPortrait, route => route.request().url() === duplicates[0].photoUrl
        ? route.abort() : route.fulfill({ contentType: "image/png", body: portraitFixture }));
    const query = new URLSearchParams({ q: duplicates[0].name });
    await page.goto(`/mvps?${query}`);
    for (const [index, profile] of duplicates.entries()) {
        const row = page.locator(".profile-card").filter({ has: page.locator(`h3 a[href="/mvps/${profile.id}?${query}"]`) });
        await expect(row).toHaveCount(1);
        await expectLocalLinks(row, profile, query);
        await row.locator("h3 a").click();
        await expect(page).toHaveURL(url => url.pathname === `/mvps/${profile.id}`);
        await expectProfile(page, profile);
        await expectNeutral(page);
        if (index === 0) {
            await expectInitials(page, profile);
            const interactive = await page.evaluate(query => matchMedia(query).matches, interactiveMedia);
            await expect(page.locator(".mvp-id-card")).toHaveAttribute("data-interactive", String(interactive));
            if (interactive) { await pointerMove(page, 0.9, 0.9); await expectTilt(page, -4.8, 4.8); }
            // There is no profile-to-profile link: use real Back + directory links, not a test route/router hook.
            await page.goBack();
            await expect(page).toHaveURL(url => url.pathname === "/mvps" && url.searchParams.get("q") === profile.name);
        } else await expectLoadedPortrait(page, profile);
    }
});

for (const width of [320, 390, 768, 1100, 1440]) {
    test(`longest snapshot name and all awards reflow at ${width}px in both themes with accessible keyboard order`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(`/mvps/${longest.id}`);
        expect(longest.awardCategories.length).toBeGreaterThan(1);
        await expectProfile(page, longest);
        await page.evaluate(() => document.fonts.ready);
        const card = page.locator(".mvp-id-card");
        let darkSurface: string | undefined;
        for (const theme of ["light", "dark"]) {
            if (!await page.locator("html").evaluate((element, theme) => element.classList.contains(theme), theme)) {
                await page.getByRole("button", { name: "Toggle color theme" }).click();
            }
            await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
            await expectNeutral(page);
            const box = (await card.boundingBox())!;
            expect(box.width).toBeLessThanOrEqual(640.5);
            await expect(card.locator(".mvp-id-watermark")).toHaveCSS("mask-size", width <= 540 ? "72px 72px" : "88px 88px");
            expect(box.width).toBeGreaterThan(0);
            expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(1);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            const clipped = await page.locator(".mvp-id-brand p, .mvp-id-bottom > span, .mvp-id-details h1, .mvp-id-country, .mvp-id-awards h2, .mvp-id-awards li, .mvp-profile-expertise li").evaluateAll(elements => elements.filter(element => {
                const style = getComputedStyle(element);
                // A tight line-height can have visible glyph overhang without clipping.
                // Horizontal overflow is always a failure; vertical overflow only clips with hidden/clip.
                if ((style.display !== "inline" && (element.scrollWidth > element.clientWidth + 1
                    || (/hidden|clip/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1)))
                    || style.textOverflow === "ellipsis" || !["none", "0"].includes(style.webkitLineClamp)) return true;
                const range = document.createRange();
                range.selectNodeContents(element);
                const rects = [...range.getClientRects()].filter(rect => rect.width && rect.height);
                for (let parent = element.parentElement; parent; parent = parent.parentElement) {
                    const bounds = parent.getBoundingClientRect(), css = getComputedStyle(parent);
                    if (rects.some(rect => (/hidden|clip/.test(css.overflowX) && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1))
                        || (/hidden|clip/.test(css.overflowY) && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)))) return true;
                }
                return false;
            }).map(element => element.textContent));
            expect(clipped, "Full profile text must not be clipped by its own box or an ancestor").toEqual([]);
            const surface = await card.evaluate(element => {
                const color = getComputedStyle(element).backgroundColor;
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d")!;
                context.fillStyle = color;
                context.fillRect(0, 0, 1, 1);
                return { color, rgba: [...context.getImageData(0, 0, 1, 1).data] };
            });
            expect(surface.rgba[3]).toBe(255);
            expect(Math.max(...surface.rgba.slice(0, 3))).toBeLessThan(80);
            if (darkSurface) expect(surface.color).toBe(darkSurface);
            darkSurface = surface.color;
            const back = page.getByRole("link", { name: "Back to directory", exact: true });
            await back.focus();
            await page.keyboard.press("Tab");
            await expect(page.locator(".mvp-official-link")).toBeFocused();
            expect(await card.evaluate(element => (element as HTMLElement).tabIndex)).toBe(-1);
            await expect(card.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).toHaveCount(0);
            const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
            await testInfo.attach(`profile-axe-${width}-${theme}`, { body: JSON.stringify(report, null, 2), contentType: "application/json" });
            const serious = report.violations.filter(violation => ["serious", "critical"].includes(violation.impact ?? ""));
            expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
        }
    });
}

test("MVP holograms repeat a locally optimized logo as a fixed luminance mask", async ({ page, baseURL }) => {
    await page.goto(`/mvps/${longest.id}`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expectNeutral(page);
    const print = page.locator(".mvp-id-watermark");
    await expect(print).toBeVisible();
    await expect(print).toHaveCSS("mask-mode", "luminance");
    await expect(print).toHaveCSS("mask-repeat", "repeat");
    await expect(print).toHaveCSS("mix-blend-mode", "screen");
    await expect(print).toHaveCSS("pointer-events", "none");
    await expect(print).toHaveCSS("opacity", "0.18");
    expect(await print.ariaSnapshot()).toBe("");
    const asset = await print.evaluate(async element => {
        const style = getComputedStyle(element);
        const source = style.maskImage.match(/^url\("(.+)"\)$/)?.[1];
        if (!source) throw new Error("MVP logo mask must use a local image");
        const image = new Image();
        image.src = source;
        await image.decode();
        // Verify actual image bytes: a white diamond against a darker blue field,
        // not a missing mask that silently makes the decoration disappear.
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 20;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0, 20, 20);
        const luminance = (x: number, y: number) => {
            const [r, g, b] = context.getImageData(x, y, 1, 1).data;
            return (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
        };
        return {
            source, width: image.naturalWidth, height: image.naturalHeight,
            diamond: luminance(10, 5), field: luminance(0, 0), spectrum: style.backgroundImage
        };
    });
    const source = new URL(asset.source);
    expect(source.origin).toBe(new URL(baseURL!).origin);
    expect(source.pathname).toBe("/_next/image");
    expect(source.searchParams.get("url")).toBe("/mvp-logo.png");
    expect(asset.width).toBeGreaterThanOrEqual(176);
    expect(asset.width).toBeLessThanOrEqual(256);
    expect(asset.height).toBe(asset.width);
    expect(asset.diamond).toBeGreaterThan(0.95);
    expect(asset.field).toBeLessThan(0.5);
    expect(asset.spectrum).toContain("linear-gradient");
    await expectStaticAfterEvents(page);
});

for (const theme of ["light", "dark"]) {
    test(`holographic decoration stays behind accessible, readable content at every desktop corner in ${theme} theme`, async ({ page, isMobile }, testInfo) => {
        test.skip(isMobile, "High-intensity holography requires a hover-capable fine pointer; static mobile coverage is separate.");
        await page.goto(`/mvps/${longest.id}`);
        if (!await page.locator("html").evaluate((element, theme) => element.classList.contains(theme), theme)) {
            await page.getByRole("button", { name: "Toggle color theme" }).click();
        }
        await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
        const card = page.locator(".mvp-id-card");
        await expect(card).toHaveAttribute("data-interactive", "true");
        await page.evaluate(() => document.fonts.ready);
        await expectLoadedPortrait(page, longest);
        await expectNeutral(page);
        const [initial] = await motionSamples(page);
        const material = card.locator(":scope > .mvp-id-material");
        const content = card.locator(":scope > .mvp-id-content");
        await expect(material).toHaveCount(1);
        await expect(material).toHaveAttribute("aria-hidden", "true");
        await expect(material).toHaveCSS("pointer-events", "none");
        await expect(material).toHaveCSS("z-index", "0");
        await expect(material).toHaveCSS("overflow-x", "hidden");
        await expect(material).toHaveCSS("overflow-y", "hidden");
        await expect(content).toHaveCSS("position", "relative");
        await expect(content).toHaveCSS("z-index", "1");
        await expect(material.locator(":scope > *")).toHaveCount(6);
        for (const selector of [".mvp-id-foil", ".mvp-id-watermark", ".mvp-id-refraction--near", ".mvp-id-refraction--far", ".mvp-id-spotlight", ".mvp-id-texture"]) {
            const layer = material.locator(`:scope > ${selector}`);
            await expect(layer).toHaveCount(1);
            await expect(layer).toBeVisible();
            await expect(layer).toHaveCSS("pointer-events", "none");
        }
        expect(await material.ariaSnapshot()).toBe("");
        await expect(material.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).toHaveCount(0);
        const spotlightSize = await material.evaluate(element => {
            const spotlight = element.querySelector<HTMLElement>(".mvp-id-spotlight")!;
            const style = getComputedStyle(spotlight);
            return { width: parseFloat(style.width) / element.clientWidth, height: parseFloat(style.height) / element.clientHeight };
        });
        expect(spotlightSize.width).toBeCloseTo(1.6, 2);
        expect(spotlightSize.height).toBeCloseTo(1.6, 2);

        for (const [x, y] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
            await pointerMove(page, x, y);
            const state = await expectTilt(page, 6 - 12 * y, 12 * x - 6);
            expectStaticLayers(state, initial);
            for (const key of movingLayers) expect(state[key].opacity).toBeGreaterThan(initial[key].opacity);
            await expect(card).toHaveAccessibleName(longest.name);
            await expect(card.getByRole("heading", { level: 1, name: longest.name, exact: true })).toBeVisible();
            // Check actual hit testing as well as the declared stacking order.
            expect(await card.locator("h1").evaluate(element => {
                const bounds = element.getBoundingClientRect();
                const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
                return !!hit && element.contains(hit) && !hit.closest(".mvp-id-material");
            })).toBe(true);
            const report = await new AxeBuilder({ page }).include(".mvp-id-card")
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
            await testInfo.attach(`profile-hologram-axe-${theme}-${x}-${y}`, { body: JSON.stringify(report, null, 2), contentType: "application/json" });
            const failures = report.violations.filter(violation => violation.id === "color-contrast"
                || ["serious", "critical"].includes(violation.impact ?? ""));
            expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
            // Preserve the rendered gradients too: axe can flag their contrast for manual review.
            await testInfo.attach(`profile-hologram-${theme}-${x}-${y}`, { body: await card.screenshot(), contentType: "image/png" });
        }
    });
}

test("forced colors hide every holographic layer without hiding profile content", async ({ page, isMobile }) => {
    await page.goto(`/mvps/${longest.id}`);
    await page.getByRole("button", { name: "Toggle color theme" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    const card = page.locator(".mvp-id-card");
    await expect(card).toHaveAttribute("data-interactive", String(!isMobile));
    await pointerMove(page, 0.9, 0.9);
    if (!isMobile) await expectTilt(page, -4.8, 4.8);
    await page.emulateMedia({ forcedColors: "active" });
    await expect.poll(() => page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
    const material = card.locator(".mvp-id-material");
    await expect(material).toHaveCSS("display", "none");
    await expect(material).toBeHidden();
    // Forced colors hide the material, not the existing pointer-capability behavior.
    await pointerMove(page, 0.1, 0.1);
    await expect(material).toHaveCSS("display", "none");
    const layers = material.locator(":scope > *");
    await expect(layers).toHaveCount(6);
    for (const layer of await layers.all()) await expect(layer).toBeHidden();
    await expect(card.locator(".mvp-id-content")).toBeVisible();
    await expectProfile(page, longest);
    await expect(card.getByRole("heading", { level: 1, name: longest.name, exact: true })).toBeVisible();
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`card motion respects pointer capability and ${reducedMotion}, clamps and resets without moving the foil or texture`, async ({ page, isMobile }) => {
        await page.emulateMedia({ reducedMotion });
        await page.goto(`/mvps/${longest.id}`);
        // A real interaction ensures the static/mobile branch cannot pass on pre-hydration HTML.
        await page.getByRole("button", { name: "Toggle color theme" }).click();
        await expect(page.locator("html")).toHaveClass(/dark/);
        const interactive = await page.evaluate(query => matchMedia(query).matches, interactiveMedia);
        expect(interactive).toBe(!isMobile && reducedMotion === "no-preference");
        await expect(page.locator(".mvp-id-card")).toHaveAttribute("data-interactive", String(interactive));
        await expect(page.locator(".mvp-id-stage")).toHaveCSS("perspective", "1000px");
        await expectNeutral(page);
        const [initial] = await motionSamples(page);
        expectStaticLayers(initial, initial);
        if (!interactive) {
            await expectStaticAfterEvents(page);
            return;
        }
        for (const reset of ["pointerleave", "pointercancel"]) {
            const box = (await page.locator(".mvp-id-stage").boundingBox())!;
            await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.9);
            // Keep a real pointer inside for leave events, then avoid browser rounding
            // of physical mouse coordinates when checking exact percentage mappings.
            await pointerMove(page, 0.9, 0.9);
            await expectTilt(page, -4.8, 4.8);
            // Even a centered pointer raises opacity without translating or scaling.
            await pointerMove(page, 0.5, 0.5);
            expectStaticLayers(await expectTilt(page, 0, 0), initial);
            // Synthetic events beyond both edges must clamp even during spring travel.
            for (const coordinate of [3, -2]) {
                await pointerMove(page, coordinate, coordinate);
                for (const state of await motionSamples(page, 12)) {
                    expectMotionBounds(state);
                    expectStaticLayers(state, initial);
                }
                expectStaticLayers(await expectTilt(page, coordinate > 1 ? -6 : 6, coordinate > 1 ? 6 : -6), initial);
            }
            // React synthesizes pointerleave from pointerout; use a real mouse exit.
            if (reset === "pointerleave") await page.mouse.move(0, 0);
            else await page.locator(".mvp-id-stage").dispatchEvent("pointercancel", { pointerType: "mouse", pointerId: 1 });
            const returning = await motionSamples(page, 12);
            for (const key of movingLayers) {
                expect(returning.some(state => state[key].opacity > restOpacity[key] + 0.005
                    && state[key].opacity < hoverOpacity[key] - 0.005), `${key} opacity springs back on ${reset}`).toBe(true);
            }
            for (const state of returning) {
                expectMotionBounds(state);
                expectStaticLayers(state, initial);
            }
            await expectNeutral(page);
            expectStaticLayers((await motionSamples(page))[0], initial);
        }
        // Touch input must not move or brighten any layer, even on an eligible desktop.
        await pointerMove(page, 0.9, 0.9, "touch");
        for (const state of await motionSamples(page, 12)) {
            expect(neutralError(state)).toBeLessThan(0.05);
            expectStaticLayers(state, initial);
        }
    });
}

test("runtime reduced-motion changes neutralize active springs and never enable touch tilt", async ({ page, isMobile }) => {
    await page.goto(`/mvps/${longest.id}`);
    await page.getByRole("button", { name: "Toggle color theme" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    const card = page.locator(".mvp-id-card");
    await expect(card).toHaveAttribute("data-interactive", String(!isMobile));
    await expectNeutral(page);
    const [initial] = await motionSamples(page);
    await pointerMove(page, 0.9, 0.9);
    if (!isMobile) expectStaticLayers(await expectTilt(page, -4.8, 4.8), initial);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(card).toHaveAttribute("data-interactive", "false");
    await expectNeutral(page);
    expectStaticLayers((await motionSamples(page))[0], initial);
    await expectStaticAfterEvents(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(card).toHaveAttribute("data-interactive", String(!isMobile));
    await expectNeutral(page);
    if (isMobile) await expectStaticAfterEvents(page);
    else {
        await pointerMove(page, 0.1, 0.1);
        expectStaticLayers(await expectTilt(page, 4.8, -4.8), initial);
        // Also reduce while springs are in flight, not only after they have settled.
        await pointerMove(page, 0.9, 0.9);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(card).toHaveAttribute("data-interactive", "false");
        await expectNeutral(page);
        await expectStaticAfterEvents(page);
        expectStaticLayers((await motionSamples(page))[0], initial);
    }
});