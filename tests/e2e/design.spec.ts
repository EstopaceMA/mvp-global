import { test, expect } from "@playwright/test";

test("light is the default and a saved dark theme keeps the browser color in sync", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/mvps");
  const root = page.locator("html");
  const themeColor = page.locator('meta[name="theme-color"]');
  await expect(root).toHaveClass(/light/);
  await expect(themeColor).toHaveAttribute("content", "#ffffff");

  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(root).toHaveClass(/dark/);
  await expect(themeColor).toHaveAttribute("content", "#111111");
  await page.reload();
  await expect(root).toHaveClass(/dark/);
  await expect(themeColor).toHaveAttribute("content", "#111111");

  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(root).toHaveClass(/light/);
  await expect(themeColor).toHaveAttribute("content", "#ffffff");
});

test("directory filters and complete profile text reflow across the design breakpoints", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/mvps");
  await expect(page.locator(".profile-card")).toHaveCount(24);
  const widths = testInfo.project.name === "mobile" ? [320, 390] : [768, 1100, 1440];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      if (!await page.locator("html").evaluate((element, name) => element.classList.contains(name), theme)) {
        await page.getByRole("button", { name: "Toggle color theme" }).click();
      }
      const rail = (await page.getByRole("complementary", { name: "Directory filters" }).boundingBox())!;
      const results = (await page.locator(".results-container").boundingBox())!;
      if (width > 1100) {
        expect(Math.round(rail.width)).toBe(260);
        expect(rail.x + rail.width).toBeLessThan(results.x);
      } else {
        expect(rail.y + rail.height).toBeLessThanOrEqual(results.y + 1);
      }
      const columns = await page.locator(".results-grid").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
      expect(columns).toBe(width > 1100 ? 3 : width > 767 ? 2 : 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await page.locator(".profile-card h3, .profile-technologies").evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight))).toBe(true);
      const portrait = (await page.locator(".profile-avatar").first().boundingBox())!;
      expect(portrait.width).toBe(56);
      expect(portrait.height).toBe(56);
      await page.screenshot({ path: `test-results/directory-design-${width}-${theme}.png`, animations: "disabled", scale: "css" });

      await page.getByRole("combobox", { name: "Select country" }).click();
      const picker = (await page.locator(".expertise-options").boundingBox())!;
      expect(picker.x).toBeGreaterThanOrEqual(0);
      expect(picker.x + picker.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `test-results/directory-picker-${width}-${theme}.png`, animations: "disabled", scale: "css" });
      await page.keyboard.press("Escape");
    }
  }
});
