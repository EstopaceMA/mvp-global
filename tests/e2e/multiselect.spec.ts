import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { MvpProfile } from "../../src/lib/types";

const profiles = JSON.parse(readFileSync(new URL("../../src/data/profiles.json", import.meta.url), "utf8")) as MvpProfile[];
const selections = {
  country: ["philippines", "singapore"],
  category: ["Microsoft Azure", "Data Platform"],
  technology: ["Power BI", "Azure Compute Infrastructure"],
  region: ["Asia", "Europe"],
};
const expected = profiles.filter(profile => ["PH", "SG"].includes(profile.countryId)
  && profile.awardCategories.some(value => selections.category.includes(value))
  && profile.technologies.some(value => selections.technology.includes(value)));

async function selectOptions(page: Page, trigger: string, searchLabel: string, values: string[]) {
  const picker = page.getByRole("combobox", { name: trigger, exact: true });
  await picker.click();
  const search = page.getByRole("combobox", { name: searchLabel, exact: true });
  for (const value of values) {
    const before = page.url();
    await search.fill(value);
    expect(page.url()).toBe(before);
    await search.press("Enter");
    await expect(search).toBeFocused();
    await expect(page.getByRole("option").filter({ hasText: value }).first()).toHaveAttribute("aria-selected", "true");
  }
  await search.fill("");
  await expect(page.getByRole("option", { selected: true })).toHaveCount(values.length);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(picker).toBeFocused();
}

test("every dropdown searches and selects multiple values, with dropdown removal, scoped reset, and history", async ({ page }) => {
  await page.goto("/mvps?page=2");
  await selectOptions(page, "Select country", "Search countries", ["Philippines", "Singapore"]);
  await selectOptions(page, "Select award category", "Search award categories", selections.category);
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await selectOptions(page, "Technologies", "Search technologies", selections.technology);
  await selectOptions(page, "Regions", "Search regions", selections.region);
  await expect(page.locator(".filter-number")).toHaveText("4");
  await page.keyboard.press("Escape");
  const shared = page.url();
  const params = new URL(shared).searchParams;
  for (const [key, values] of Object.entries(selections)) expect(params.getAll(key)).toEqual(values);
  expect(params.has("page")).toBe(false);
  await expect(page.locator(".profile-card h3")).toHaveText(expected.map(profile => profile.name));
  await expect(page.locator(".active-filters")).toHaveCount(0);
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await page.getByRole("combobox", { name: "Technologies", exact: true }).click();
  await page.getByRole("combobox", { name: "Search technologies", exact: true }).fill("Power BI");
  await page.getByRole("option", { name: /^Power BI/ }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  expect(new URL(page.url()).searchParams.getAll("technology")).toEqual(["Azure Compute Infrastructure"]);
  await page.goBack();
  await expect(page).toHaveURL(shared);
  await page.reload();
  await expect(page.locator(".active-filters")).toHaveCount(0);
  await expect(page.locator(".profile-card h3")).toHaveText(expected.map(profile => profile.name));
  await expect(page.getByRole("combobox", { name: "Select country", exact: true })).toHaveText("2 countries");
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await page.getByRole("button", { name: "Reset these filters", exact: true }).click();
  await expect(page.locator(".filter-number")).toHaveCount(0);
  const reset = new URL(page.url()).searchParams;
  expect(reset.getAll("country")).toEqual(selections.country);
  expect(reset.getAll("category")).toEqual(selections.category);
  expect(reset.has("technology") || reset.has("region")).toBe(false);
  const clearAll = page.locator(".more-filter-options").getByRole("button", { name: "Clear all", exact: true });
  await clearAll.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/mvps$/);
  await expect(clearAll).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset these filters", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "More filters", exact: true })).toBeFocused();
});

test("multi-value server results survive failed data, and country pages expand to the shared directory", async ({ page }) => {
  const params = new URLSearchParams();
  for (const [key, values] of Object.entries(selections)) for (const value of values) params.append(key, value);
  await page.route("**/data/directory.*.json", route => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto(`/mvps?${params}`);
  await expect(page.getByRole("button", { name: "Retry directory" })).toBeVisible();
  await expect(page.locator(".profile-card h3")).toHaveText(expected.map(profile => profile.name));
  await page.getByRole("combobox", { name: "Select country", exact: true }).click();
  await expect(page.getByRole("option", { selected: true })).toHaveCount(2);
  await page.keyboard.press("Escape");
  await page.unroute("**/data/directory.*.json");
  await page.goto("/countries/philippines?technology=Power+BI&technology=Azure+Compute+Infrastructure");
  await page.getByRole("combobox", { name: "Select country", exact: true }).click();
  await page.getByRole("combobox", { name: "Search countries", exact: true }).fill("Singapore");
  await page.getByRole("option", { name: /^Singapore/ }).click();
  await expect(page).toHaveURL(/\/mvps\?country=philippines&country=singapore&technology=Power\+BI&technology=Azure\+Compute\+Infrastructure$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/countries\/philippines\?technology=Power\+BI&technology=Azure\+Compute\+Infrastructure$/);
  await expect(page.getByRole("combobox", { name: "Select country", exact: true })).toHaveText("Philippines");
});

test("globe keeps multiple selected countries highlighted and supports deselection", async ({ page }) => {
  await page.goto("/?country=philippines&country=singapore");
  await expect(page.getByTestId("globe-container")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".globe-marker-ring")).toHaveCount(2);
  await page.getByRole("button", { name: "Close results" }).click();
  await page.getByRole("combobox", { name: "Select country", exact: true }).click();
  const search = page.getByRole("combobox", { name: "Search countries", exact: true });
  await search.fill("Singapore");
  await search.press("Enter");
  await expect(page.getByRole("option")).toHaveAttribute("aria-selected", "false");
  await expect(search).toBeFocused();
  await expect(page.locator(".globe-marker-ring")).toHaveCount(1);
  await search.fill("zz-no-country");
  await expect(page.getByText("No matching countries.")).toBeVisible();
  await search.press("Enter");
  await expect(page).toHaveURL(/country=philippines$/);
  await search.fill("");
  await page.getByRole("listbox").focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("option", { name: /^All countries/ })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("combobox", { name: "Select country", exact: true })).toBeFocused();
});

test("all views keep selections inside dropdowns and expose global reset only in Filters", async ({ page }, testInfo) => {
  const query = "q=Power&category=Microsoft+Azure&category=Data+Platform&technology=Power+BI&region=Asia&page=2";
  for (const path of ["/", "/mvps", "/countries/philippines"]) {
    await page.goto(`${path}?${query}`);
    await page.reload();
    if (path === "/") {
      await expect(page.getByTestId("globe-container")).toHaveAttribute("data-ready", "true");
      await page.getByRole("button", { name: "Close results" }).click();
      await expect(page.locator(".globe-renderer canvas")).toBeVisible();
    }
    await expect(page.locator(".active-filters")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Clear all", exact: true })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Select award category", exact: true })).toHaveText("2 award categories");
    const bounds = (await page.locator(".filter-bar").boundingBox())!;
    expect(bounds.height).toBeLessThan(110);
    if (path === "/") await page.screenshot({ path: `test-results/globe-no-chips-${testInfo.project.name}.png`, scale: "css" });
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Search MVPs" })).toHaveValue("");
    expect(new URL(page.url()).searchParams.getAll("category")).toEqual(["Microsoft Azure", "Data Platform"]);
    await page.getByRole("button", { name: "More filters", exact: true }).click();
    const panel = page.locator(".more-filter-options");
    const clearAll = panel.getByRole("button", { name: "Clear all", exact: true });
    const reset = panel.getByRole("button", { name: "Reset these filters", exact: true });
    expect((await clearAll.boundingBox())!.y).toBeGreaterThan((await reset.boundingBox())!.y);
    await clearAll.click();
    await expect(page).toHaveURL(path === "/" ? /\/$/ : /\/mvps$/);
    await expect(page.locator(".active-filters")).toHaveCount(0);
    // A country-page reset navigates to a new directory, so reopen its panel.
    const more = page.getByRole("button", { name: "More filters", exact: true });
    if (await more.getAttribute("aria-expanded") !== "true") await more.click();
    await expect(clearAll).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Technologies", exact: true })).toHaveText("All technologies");
    await expect(page.getByRole("combobox", { name: "Regions", exact: true })).toHaveText("All regions");
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(/category=Microsoft\+Azure&category=Data\+Platform/);
    await expect(page.locator(".active-filters")).toHaveCount(0);
  }
});
