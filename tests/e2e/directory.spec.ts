import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("globe renders and country selection opens eight Philippine profiles", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("globe-container")).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await expect(page.getByTestId("globe-container")).toHaveAttribute("data-renderer", "magic-ui-cobe");
  await expect(page.locator("[data-country-marker]")).toHaveCount(105);
  await page.screenshot({ path: `test-results/atlas-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("combobox", { name: "Select country" }).click();
  await page.getByPlaceholder("Find a country or region…").fill("Philippines");
  await page.getByRole("option", { name: /^Philippines/ }).click();
  await expect(page).toHaveURL(/country=philippines/);
  await expect(page.getByRole("dialog", { name: "Philippines", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Philippines", exact: true })).toBeVisible();
  await expect(page.locator(".compact-results .profile-card")).toHaveCount(8);
  const official = page.locator(".profile-link").first();
  await expect(official).toHaveAttribute("target", "_blank");
  await expect(official).toHaveAttribute("href", /^https:\/\/mvp.microsoft.com\/en-US\/mvp\/profile\//);
  await page.getByRole("button", { name: "Close results" }).click({ trial: true });
  await expect(page.getByPlaceholder("Find a country or region…")).not.toBeVisible();
  await page.screenshot({ path: `test-results/country-sheet-${testInfo.project.name}.png`, animations: "disabled", scale: "css" });
  await page.getByRole("button", { name: "Close results" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: /View 8 MVPs/ })).toBeFocused();
  expect(errors).toEqual([]);
});

test("directory search, pagination, theme, country pages, and history preserve state", async ({ page }) => {
  await page.goto("/mvps");
  await expect(page.locator(".profile-card")).toHaveCount(24);
  const firstName = await page.locator(".profile-card h3").first().textContent();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".profile-card h3").first()).not.toHaveText(firstName!);
  await page.goBack();
  await expect(page.locator(".profile-card h3").first()).toHaveText(firstName!);
  await page.goForward();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("textbox", { name: "Search MVPs" }).fill("Philippines");
  await expect(page.locator(".profile-card")).toHaveCount(8);
  await expect(page).toHaveURL(/q=Philippines/);
  await page.getByRole("link", { name: /Explore on globe/ }).click();
  await expect(page).toHaveURL(/\/?q=Philippines/);
  await page.getByRole("button", { name: "Close results" }).click();
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.goto("/countries/philippines");
  await expect(page.locator("h1")).toContainText("Philippines");
  await expect(page.locator(".profile-card")).toHaveCount(8);
  await expect(page).toHaveTitle(/Microsoft MVPs in Philippines/);
});

test("filters combine, zero results reset, and failed photos show initials", async ({ page }) => {
  await page.route("**/_next/image?*", route => route.abort());
  await page.goto("/mvps?country=philippines&category=Microsoft+Azure");
  await expect(page.locator(".profile-card").first()).toBeVisible();
  await expect(page.locator(".profile-avatar span").first()).toBeVisible();
  const cards = page.locator(".profile-card");
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(8);
  for (let index = 0; index < count; index++) {
    await expect(cards.nth(index).locator(".profile-country")).toHaveText("Philippines");
    await expect(cards.nth(index).locator(".profile-categories")).toContainText("Microsoft Azure");
  }
  await page.getByRole("textbox", { name: "Search MVPs" }).fill("nonexistent-expertise-123");
  await expect(page.getByRole("heading", { name: "No matching MVPs" })).toBeVisible();
  await page.getByRole("button", { name: "Explore all MVPs" }).click();
  await expect(page.locator(".profile-card")).toHaveCount(24);
});

test("WebGL fallback retains filters and retry recovers a failed data load", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === "webgl" || type === "webgl2") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  let fail = true;
  await page.route("**/data/directory.*.json", route => fail ? route.fulfill({ status: 503, body: "Unavailable" }) : route.continue());
  await page.goto("/?country=philippines");
  await expect(page.getByRole("button", { name: "Retry directory" }).first()).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry directory" }).last().click();
  await expect(page.locator(".compact-results .profile-card")).toHaveCount(8);
  await page.getByRole("button", { name: "Close results" }).click();
  await expect(page.getByText("The 3D globe isn’t available on this device.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Open the directory", exact: true }).click();
  await expect(page).toHaveURL(/\/mvps\?country=philippines/);
  await expect(page.locator(".profile-card")).toHaveCount(8);
});

test("directory is keyboard accessible with no serious accessibility violations or overflow", async ({ page }, testInfo) => {
  await page.goto("/mvps?country=philippines");
  await expect(page.locator(".profile-card")).toHaveCount(8);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.getByRole("combobox", { name: "Select country" }).focus();
  await page.keyboard.press("Enter");
  await page.getByPlaceholder("Find a country or region…").fill("Singapore");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/country=singapore/);
  await expect(page.getByPlaceholder("Find a country or region…")).not.toBeVisible();
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(report.violations.filter(violation => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/directory-${testInfo.project.name}.png`, fullPage: testInfo.project.name === "desktop", scale: "css" });
});

test("typing on the globe retains focus and synchronizes counts and results", async ({ page }, testInfo) => {
  await page.goto("/");
  const search = page.getByRole("textbox", { name: "Search MVPs" });
  await search.pressSequentially("Philippines", { delay: 40 });
  await expect(search).toHaveValue("Philippines");
  await expect(search).toBeFocused();
  await expect(page.locator(".stat-value").first()).toHaveText("8");
  await expect(page.locator(".stat-value").last()).toHaveText("1");
  if (testInfo.project.name === "mobile") await expect(page.locator(".country-sheet")).not.toBeVisible();
  await search.press("Enter");
  await expect(page.locator(".compact-results .profile-card")).toHaveCount(8);
  const close = page.getByRole("button", { name: "Close results" });
  await close.focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".country-sheet")).not.toBeVisible();
  await expect(page.getByRole("button", { name: /View 8 MVPs/ })).toBeFocused();
  await page.getByRole("combobox", { name: "Select country" }).click();
  await page.getByPlaceholder("Find a country or region…").fill("India");
  await page.getByRole("option", { name: /^India/ }).click();
  await expect(page.getByRole("heading", { name: "No matching MVPs" })).toBeVisible();
  await page.getByRole("button", { name: "Explore all MVPs" }).click();
  await expect(page.locator(".compact-results .profile-card")).toHaveCount(24);
});

test("country polygons select places and context loss exposes the directory", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("globe-container")).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  const box = await page.locator(".globe-renderer canvas").boundingBox();
  const mobile = testInfo.project.name === "mobile";
  // The initial camera targets Africa: click land near its center, away from overlaid controls.
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  // The pointer resolves land through the locally bundled country boundaries.
  await expect(page.locator(".globe-renderer canvas")).toHaveClass(/clickable/);
  await page.mouse.click(x, y);
  await expect(page).toHaveURL(/country=/);
  await expect(page.locator(".country-sheet")).toBeVisible();
  if (mobile) {
    await page.keyboard.press("Tab");
    expect(await page.locator(".country-sheet").evaluate(element => element.contains(document.activeElement))).toBe(true);
  } else {
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(page.locator(".country-sheet")).toBeVisible();
  }
  await page.getByRole("button", { name: "Close results" }).click();
  await page.locator(".globe-renderer canvas").evaluate(canvas => {
    (canvas as HTMLCanvasElement).getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await expect(page.getByRole("link", { name: "Open the directory", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(report.violations.filter(violation => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("Magic UI globe supports drag, zoom, reset, and marker-only country selection", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?country=singapore");
  const globe = page.getByTestId("globe-container");
  await expect(globe).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Close results" }).click();
  await expect(page.locator(".country-sheet")).not.toBeVisible();
  const marker = page.locator('[data-country-marker="singapore"]');
  await expect(marker).toBeVisible();
  // Singapore has no polygon in the simplified map: its marker must remain selectable.
  const markerCenter = await marker.locator("circle").first().boundingBox();
  await page.mouse.click(markerCenter!.x + markerCenter!.width / 2, markerCenter!.y + markerCenter!.height / 2);
  await expect(page.getByRole("dialog", { name: "Singapore", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close results" }).click();
  await expect(page.locator(".country-sheet")).not.toBeVisible();
  const before = await marker.getAttribute("transform");
  const box = (await page.locator(".globe-renderer canvas").boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 75, y + 30, { steps: 10 });
  await page.mouse.up();
  await expect(marker).not.toHaveAttribute("transform", before!);
  await expect(page.locator(".country-sheet")).not.toBeVisible();
  await page.getByRole("button", { name: "Reset globe view" }).click();
  await expect(globe).toHaveAttribute("data-scale", "1.000");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(globe).toHaveAttribute("data-scale", "1.200");
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(globe).toHaveAttribute("data-scale", "1.000");
  if (testInfo.project.name === "mobile") {
    const session = await page.context().newCDPSession(page);
    const point = (id: number, offset: number) => ({ id, x: x + offset, y, radiusX: 5, radiusY: 5, force: 1 });
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(1, -35), point(2, 35)] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(1, -65), point(2, 65)] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => Number(await globe.getAttribute("data-scale"))).toBeGreaterThan(1.5);
  } else {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -300);
    await expect.poll(async () => Number(await globe.getAttribute("data-scale"))).toBeGreaterThan(1.5);
  }
  await expect(page.locator(".country-sheet")).not.toBeVisible();
  await page.getByRole("button", { name: "Reset globe view" }).click();
  await expect(globe).toHaveAttribute("data-scale", "1.000");
});

test("zoom fills the explorer without an internal canvas edge in either theme", async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const globe = page.getByTestId("globe-container");
  await expect(globe).toHaveAttribute("data-ready", "true");
  const viewports = testInfo.project.name === "desktop"
    ? [{ width: 1440, height: 1000 }, { width: 768, height: 900 }]
    : [{ width: 412, height: 839 }];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const theme of ["dark", "light"]) {
      if (!await page.locator("html").evaluate((element, name) => element.classList.contains(name), theme)) {
        await page.getByRole("button", { name: "Toggle color theme" }).click();
      }
      for (const zoom of [0.7, 1, 2.5]) {
        await page.getByRole("button", { name: "Reset globe view" }).click();
        await expect(globe).toHaveAttribute("data-scale", "1.000");
        const steps = zoom === 0.7 ? 2 : zoom === 2.5 ? 6 : 0;
        for (let step = 0; step < steps; step++) {
          await page.getByRole("button", { name: zoom < 1 ? "Zoom out" : "Zoom in", exact: true }).click();
        }
        await expect(globe).toHaveAttribute("data-scale", zoom.toFixed(3));
        // The render surface must share the explorer's bounds at every zoom, not a smaller square.
        await expect.poll(async () => {
          const explorer = await globe.boundingBox();
          const canvas = await page.locator(".globe-renderer canvas").boundingBox();
          const overlay = await page.locator(".globe-marker-layer").boundingBox();
          return [canvas, overlay].every(box => box && explorer && ["x", "y", "width", "height"].every(key => Math.abs(box[key as keyof typeof box] - explorer[key as keyof typeof explorer]) < 1));
        }).toBe(true);
        await page.screenshot({ path: `test-results/globe-viewport-${viewport.width}-${theme}-${zoom}.png`, scale: "css" });
      }
    }
    // At maximum zoom, a visible marker must still resolve to the correct country.
    const marker = page.locator('[data-country-marker="nigeria"] circle').first();
    const target = (await marker.boundingBox())!;
    await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
    await expect(page).toHaveURL(/country=nigeria/);
    await expect(page.getByRole("dialog", { name: "Nigeria", exact: true })).toBeVisible();
    await expect.poll(async () => {
      const canvas = await page.locator(".globe-renderer canvas").boundingBox();
      const explorer = await globe.boundingBox();
      return canvas?.width === explorer?.width && canvas?.height === explorer?.height;
    }).toBe(true);
    await page.getByRole("button", { name: "Close results" }).click();
    await expect(page.locator(".country-sheet")).not.toBeVisible();
  }
});
