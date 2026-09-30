import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { getSiteUrl } from "../../src/lib/site-url";
import type { MvpProfile } from "../../src/lib/types";

const profiles = JSON.parse(readFileSync(new URL("../../src/data/profiles.json", import.meta.url), "utf8")) as MvpProfile[];
const longest = profiles.reduce((a, b) => a.name.length > b.name.length ? a : b);
const duplicates = profiles.filter(profile => profile.name === "Ben Thomas");
const unicode = profiles.find(profile => /[\p{Script=Han}\p{Script=Hangul}]/u.test(profile.name))!;
const portrait = readFileSync(new URL("../../public/mvp-logo.png", import.meta.url));
const platforms = ["Facebook", "LinkedIn", "X"];
const socialOrigins = ["https://www.facebook.com", "https://www.linkedin.com", "https://twitter.com"];
const copiedUrl = (profile: MvpProfile) => new URL(`/mvps/${encodeURIComponent(profile.id)}`, getSiteUrl()).href;

test.beforeEach(async ({ page, baseURL }) => {
    await page.route(url => url.origin !== new URL(baseURL!).origin, route => route.fulfill({ status: 204, body: "" }));
    await page.route("https://images.mvp.microsoft.com/**", route => route.fulfill({ contentType: "image/png", body: portrait }));
});

test("sharing filtered, duplicate-name, and Unicode profiles uses only the canonical profile URL", async ({ page }) => {
    const socialRequests: string[] = [];
    page.on("request", request => {
        if (socialOrigins.includes(new URL(request.url()).origin)) socialRequests.push(request.url());
    });
    for (const profile of [longest, ...duplicates, unicode]) {
        await page.goto(`/mvps/${profile.id}?q=Azure&page=2&country=philippines#details`);
        const trigger = page.getByRole("button", { name: "Share profile", exact: true });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Share profile", exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("link")).toHaveCount(3);
        for (const [index, platform] of platforms.entries()) {
            const link = dialog.getByRole("link", { name: `${platform} (opens in a new tab)`, exact: true });
            const target = new URL((await link.getAttribute("href"))!);
            expect(target.origin).toBe(socialOrigins[index]);
            expect(target.searchParams.get(index === 0 ? "u" : "url")).toBe(copiedUrl(profile));
            if (platform === "X") expect(target.searchParams.get("text")).toBe(`${profile.name} — Microsoft MVP`);
            await expect(link).toHaveAttribute("target", "_blank");
            await expect(link).toHaveAttribute("rel", /\bnoopener\b/);
            await expect(link).toHaveAttribute("rel", /\bnoreferrer\b/);
        }
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", copiedUrl(profile));
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(trigger).toBeFocused();
    }
    expect(socialRequests).toEqual([]);
});

test("social options open composers in a new tab and leave the original profile unchanged", async ({ page, context }) => {
    // Exercise the real target=_blank behavior without contacting social services or posting.
    await context.route(url => socialOrigins.includes(url.origin), route => route.fulfill({
        contentType: "text/html", body: "<!doctype html><title>Share composer</title><h1>Share composer</h1>",
    }));
    await page.goto(`/mvps/${longest.id}?q=Azure&page=2`);
    const source = page.url();
    for (const platform of platforms) {
        await page.getByRole("button", { name: "Share profile", exact: true }).click();
        const link = page.getByRole("link", { name: `${platform} (opens in a new tab)`, exact: true });
        const href = (await link.getAttribute("href"))!;
        const popupPromise = context.waitForEvent("page");
        await link.click();
        const popup = await popupPromise;
        await expect(popup).toHaveURL(href);
        await expect(popup.getByRole("heading", { name: "Share composer" })).toBeVisible();
        expect(await popup.evaluate(() => window.opener)).toBeNull();
        await popup.close();
        expect(page.url()).toBe(source);
        await expect(page.getByRole("dialog", { name: "Share profile", exact: true })).not.toBeVisible();
    }
});

test("copy link writes the canonical URL, announces success, and resets on reopen", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(baseURL!).origin });
    for (const profile of duplicates) {
        await page.goto(`/mvps/${profile.id}?q=Ben&page=2#details`);
        const trigger = page.getByRole("button", { name: "Share profile", exact: true });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Share profile", exact: true });
        await dialog.getByRole("button", { name: "Copy link", exact: true }).click();
        await expect(dialog.getByRole("status")).toHaveText("Link copied.");
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(copiedUrl(profile));
        await expect(dialog.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
        await expect(dialog.getByRole("button", { name: "Copied", exact: true })).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
        await trigger.click();
        await expect(dialog.getByRole("button", { name: "Copy link", exact: true })).toBeVisible();
        await expect(dialog.getByRole("status")).toHaveText("");
        await page.keyboard.press("Escape");
    }
});

test("pending copy retains focus and closing ignores late clipboard feedback", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true, value: {
                writeText: () => new Promise<void>(resolve => {
                    document.addEventListener("test-resolve-copy", () => resolve(), { once: true });
                }),
            }
        });
    });
    await page.goto(`/mvps/${longest.id}`);
    const trigger = page.getByRole("button", { name: "Share profile", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Share profile", exact: true });
    await dialog.getByRole("button", { name: "Copy link", exact: true }).click();
    const pending = dialog.getByRole("button", { name: "Copying…", exact: true });
    await expect(pending).toBeFocused();
    await expect(pending).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await page.evaluate(() => document.dispatchEvent(new Event("test-resolve-copy")));
    await trigger.click();
    await expect(dialog.getByRole("status")).toHaveText("");
    await expect(dialog.getByRole("button", { name: "Copy link", exact: true })).toBeVisible();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(dialog).not.toBeVisible();
});

for (const unavailable of [false, true]) {
    test(`clipboard ${unavailable ? "unavailable" : "denied"} offers a selected, read-only link without false success`, async ({ page }) => {
        await page.addInitScript(unavailable => {
            Object.defineProperty(navigator, "clipboard", {
                configurable: true, value: unavailable ? undefined : {
                    writeText: () => Promise.reject(new DOMException("Clipboard denied", "NotAllowedError")),
                }
            });
        }, unavailable);
        await page.goto(`/mvps/${longest.id}?q=Azure&page=2`);
        const trigger = page.getByRole("button", { name: "Share profile", exact: true });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Share profile", exact: true });
        await dialog.getByRole("button", { name: "Copy link", exact: true }).click();
        await expect(dialog.getByRole("status")).toHaveText("Couldn't copy automatically. Select and copy the link below.");
        const input = dialog.getByRole("textbox", { name: "Profile link", exact: true });
        await expect(input).toHaveValue(copiedUrl(longest));
        await expect(input).toHaveJSProperty("readOnly", true);
        await expect(input).toBeFocused();
        expect(await input.evaluate(element => [
            (element as HTMLInputElement).selectionStart, (element as HTMLInputElement).selectionEnd,
        ])).toEqual([0, copiedUrl(longest).length]);
        await expect(dialog.getByRole("button", { name: "Copied", exact: true })).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
        await trigger.click();
        await expect(dialog.getByRole("textbox")).toHaveCount(0);
        await expect(dialog.getByRole("status")).toHaveText("");
    });
}