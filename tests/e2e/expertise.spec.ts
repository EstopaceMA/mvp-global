import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../../src/data/manifest.json", import.meta.url), "utf8")) as { technologies: string[] };

async function openMoreFilters(page: Page) {
  const more = page.getByRole("button", { name: "More filters", exact: true });
  if (await more.getAttribute("aria-expanded") !== "true") await more.click();
}

async function openTechnology(page: Page) {
  await openMoreFilters(page);
  await page.getByRole("combobox", { name: "Technologies", exact: true }).click();
}

test("award categories are primary, searchable, counted, and preserve URL history without chips", async ({ page }) => {
  await page.goto("/mvps?q=Power&country=philippines&technology=Power+BI&region=Asia&page=2");
  const originalUrl = page.url();
  const picker = page.getByRole("combobox", { name: "Select award category", exact: true });
  await expect(page.locator(".filter-row").getByRole("combobox")).toHaveCount(2);
  await expect(page.getByRole("combobox", { name: "Technologies", exact: true })).toHaveCount(0);
  await picker.click();
  await expect(page.getByRole("option", { name: /^All award categories/ }).locator(".facet-count")).toHaveText("2");
  const search = page.getByRole("combobox", { name: "Search award categories", exact: true });
  await search.fill("mÍCROsoft azure");
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option").locator(".facet-count")).toHaveText("0");
  expect(page.url()).toBe(originalUrl);
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(search).toBeFocused();
  await expect(page.getByRole("option")).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(picker).toBeFocused();
  await expect(page).toHaveURL(/category=Microsoft\+Azure/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.locator(".active-filters")).toHaveCount(0);
  await expect(page.locator(".filter-number")).toHaveText("2");
  await page.goBack();
  await expect(page).toHaveURL(originalUrl);
  await expect(picker).toHaveText("All award categories");
  await page.goForward();
  await expect(picker).toHaveText("Microsoft Azure");
  await expect(page.locator(".active-filters")).toHaveCount(0);
  await picker.click();
  await page.getByRole("button", { name: "Clear selections", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(picker).toBeFocused();
  await expect(page.locator(".profile-card")).toHaveCount(2);
});

test("technology matches Region and supports searchable keyboard selection", async ({ page }) => {
  await page.goto("/mvps?country=philippines&category=Microsoft+Azure&page=2");
  const originalUrl = page.url();
  const picker = page.getByRole("combobox", { name: "Technologies", exact: true });
  await openMoreFilters(page);
  await expect(picker).toHaveClass(/filter-select/);
  await expect(page.getByRole("combobox", { name: "Regions", exact: true })).toHaveClass(/filter-select/);
  await picker.click();
  await expect(page.getByRole("option", { name: /^All technologies/ }).locator(".facet-count")).toHaveText("1");
  const search = page.getByRole("combobox", { name: "Search technologies", exact: true });
  await search.fill("pÓWER bi");
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option").locator(".facet-count")).toHaveText("0");
  expect(page.url()).toBe(originalUrl);
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(search).toBeFocused();
  await expect(page.getByRole("option")).toHaveAttribute("aria-selected", "true");
  await search.press("Escape");
  await expect(picker).toBeFocused();
  await expect(page.locator(".more-filter-options")).toBeVisible();
  await expect(page.getByRole("listbox")).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "More filters", exact: true })).toBeFocused();
  await expect(page).toHaveURL(/technology=Power\+BI/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.locator(".filter-relaxations button")).toHaveText([
    "Remove category: Microsoft Azure · 2 matches", "Remove technology: Power BI · 1 match",
  ]);
  await page.getByRole("button", { name: "Remove category: Microsoft Azure · 2 matches", exact: true }).click();
  await expect(page.locator(".profile-card")).toHaveCount(2);
  await expect(page).toHaveURL(/country=philippines&technology=Power\+BI/);
  await page.reload();
  await expect(page.locator(".profile-card")).toHaveCount(2);
  await openMoreFilters(page);
  await expect(picker).toHaveText("Power BI");
  await picker.click();
  await expect(page.getByRole("option", { name: /^Power BI/ }).locator(".facet-count")).toHaveText("2");
  await page.keyboard.press("Escape");
  await expect(picker).toBeFocused();
  await expect(page.locator(".more-filter-options")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".more-filter-options")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "More filters", exact: true })).toBeFocused();
});

test("More filters counts technologies and regions and resets only those selections", async ({ page }) => {
  await page.goto("/mvps?country=philippines&category=Microsoft+Azure");
  await expect(page.locator(".filter-number")).toHaveCount(0);
  await openTechnology(page);
  await expect(page.locator(".more-filter-options").getByRole("combobox", { name: "Select award category", exact: true })).toHaveCount(0);
  const powerBI = page.getByRole("option", { name: /^Power BI/ });
  await expect(powerBI.locator(".facet-count")).toHaveText("0");
  await powerBI.click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".filter-number")).toHaveText("1");
  await page.getByRole("combobox", { name: "Regions", exact: true }).click();
  await page.getByRole("combobox", { name: "Search regions", exact: true }).fill("Asia");
  await page.getByRole("option", { name: /^Asia/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".filter-number")).toHaveText("2");
  await page.getByRole("button", { name: "Reset these filters", exact: true }).click();
  await expect(page).toHaveURL(/country=philippines&category=Microsoft\+Azure$/);
  await expect(page.locator(".filter-number")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".profile-card")).toHaveCount(1);
});

test("country-route dropdown clearing and recovery preserve remaining filters and browser history", async ({ page }) => {
  await page.goto("/countries/philippines?technology=Power+BI&page=2");
  await expect(page.locator(".active-filters")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Select country", exact: true }).click();
  await page.getByRole("button", { name: "Clear selections", exact: true }).click();
  await expect(page).toHaveURL(/\/mvps\?technology=Power\+BI$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/countries\/philippines\?technology=Power\+BI&page=2$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/mvps\?technology=Power\+BI$/);
  await page.goto("/countries/philippines?region=Europe&technology=Power+BI&page=2");
  await page.locator(".filter-relaxations").getByRole("button", { name: /^Remove country: Philippines/ }).click();
  await expect(page).toHaveURL(/\/mvps\?technology=Power\+BI&region=Europe$/);
  await expect(page.locator(".profile-card").first()).toBeVisible();
  await page.getByRole("textbox", { name: "Search MVPs" }).fill("unlikely-expert-name");
  await expect(page.locator(".active-filters")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Clear search", exact: true })).toBeVisible();
  await openMoreFilters(page);
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page).toHaveURL(/\/mvps$/);
  await expect(page.locator(".active-filters")).toHaveCount(0);
});

test("delayed and failed data never reuse stale counts and retry preserves focus", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let fail = true;
  await page.route("**/data/directory.*.json", async route => {
    if (fail) { await held; await route.fulfill({ status: 503, body: "Unavailable" }); }
    else await route.continue();
  });
  await page.goto("/mvps?country=philippines", { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "Select award category", exact: true }).click();
  await expect(page.getByRole("option", { name: /^All award categories/ }).locator(".facet-count")).toHaveText("8");
  await page.keyboard.press("Escape");
  const search = page.getByRole("textbox", { name: "Search MVPs" });
  await search.fill("Power BI");
  await expect(search).toBeFocused();
  await page.getByRole("combobox", { name: "Select award category", exact: true }).click();
  await expect(page.getByRole("option", { name: /^All award categories/ }).locator(".facet-count")).toHaveAttribute("data-count", "pending");
  await page.keyboard.press("Escape");
  release();
  await expect(page.getByRole("button", { name: "Retry directory" })).toBeVisible();
  await page.getByRole("combobox", { name: "Select award category", exact: true }).click();
  await expect(page.getByRole("option", { name: /^All award categories/ }).locator(".facet-count")).toHaveText("—");
  await page.keyboard.press("Escape");
  fail = false;
  await page.getByRole("button", { name: "Retry directory" }).click();
  await search.focus();
  await expect(page.locator(".profile-card")).toHaveCount(2);
  await expect(search).toBeFocused();
  await page.getByRole("combobox", { name: "Select award category", exact: true }).click();
  await expect(page.getByRole("option", { name: /^All award categories/ }).locator(".facet-count")).toHaveText("2");
});

test("matching server facets survive failed loading and impossible searches offer a full reset", async ({ page }) => {
  await page.route("**/data/directory.*.json", route => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/mvps?country=philippines");
  await expect(page.getByRole("button", { name: "Retry directory" })).toBeVisible();
  await expect(page.locator(".profile-card")).toHaveCount(8);
  await page.getByRole("combobox", { name: "Select country", exact: true }).click();
  await expect(page.getByRole("option", { name: /^Philippines/ }).locator(".facet-count")).toHaveText("8");
  await page.keyboard.press("Escape");
  await page.unroute("**/data/directory.*.json");
  await page.goto("/mvps?country=philippines&region=Europe&q=impossible-expertise-name");
  await expect(page.getByRole("heading", { name: "No matching MVPs" })).toBeVisible();
  await expect(page.locator(".filter-relaxations")).toHaveCount(0);
  await page.getByRole("button", { name: "Explore all MVPs" }).click();
  await expect(page.locator(".profile-card")).toHaveCount(24);
});

test("long technology labels fit narrow layouts in both themes with accessible controls", async ({ page }, testInfo) => {
  const longest = [...manifest.technologies].sort((a, b) => b.length - a.length)[0];
  await page.setViewportSize({ width: testInfo.project.name === "mobile" ? 320 : 768, height: 900 });
  await page.goto(`/mvps?technology=${encodeURIComponent(longest)}&category=Microsoft+Azure&region=Asia&q=Azure`);
  const picker = page.getByRole("combobox", { name: "Technologies", exact: true });
  for (const trigger of ["Select country", "Select award category"]) {
    const bounds = (await page.getByRole("combobox", { name: trigger, exact: true }).boundingBox())!;
    expect(bounds.width).toBeGreaterThan(90);
  }
  for (const theme of ["dark", "light"]) {
    if (!await page.locator("html").evaluate((element, name) => element.classList.contains(name), theme)) await page.getByRole("button", { name: "Toggle color theme" }).click();
    await openMoreFilters(page);
    await expect(picker).toHaveAttribute("title", longest);
    const triggerBounds = (await picker.boundingBox())!;
    const panelBounds = (await page.locator(".more-filter-options").boundingBox())!;
    expect(triggerBounds.x).toBeGreaterThanOrEqual(panelBounds.x);
    expect(triggerBounds.x + triggerBounds.width).toBeLessThanOrEqual(panelBounds.x + panelBounds.width);
    await picker.click();
    const option = page.getByRole("option").filter({ hasText: longest });
    await option.scrollIntoViewIfNeeded();
    const bounds = (await option.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(bounds.height).toBeGreaterThanOrEqual(40);
    // Audit settled colors, rather than a frame midway through the theme transition.
    await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))); });
    const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(report.violations.filter(violation => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
    await page.screenshot({ path: `test-results/expertise-${testInfo.project.name}-${theme}.png`, fullPage: testInfo.project.name === "desktop", scale: "css" });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("globe technology selection preserves mobile editing and recovery keeps results open", async ({ page }, testInfo) => {
  await page.goto("/?country=philippines&category=Microsoft+Azure");
  await expect(page.locator(".country-sheet")).toBeVisible();
  await page.getByRole("button", { name: "Close results" }).click();
  await openTechnology(page);
  await page.getByRole("option", { name: /^Power BI/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".more-filter-options")).toBeVisible();
  await page.keyboard.press("Escape");
  if (testInfo.project.name === "mobile") {
    await expect(page.locator(".country-sheet")).not.toBeVisible();
    await page.getByRole("button", { name: "View 0 MVPs", exact: true }).click();
  }
  await page.getByRole("button", { name: "Remove category: Microsoft Azure · 2 matches", exact: true }).click();
  await expect(page.locator(".country-sheet")).toBeVisible();
  await expect(page.locator(".compact-results .profile-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Close results" }).click();
  await expect(page.getByRole("button", { name: "View 2 MVPs", exact: true })).toBeFocused();
});
