import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.resolve(__dirname, "../../../docs/screenshots");

test("loads night plan, expands first object reasoning, and saves desktop, phone, and red-light screenshots", async ({
  page,
}) => {
  fs.mkdirSync(screenshotsDir, { recursive: true });

  await page.route("https://api.open-meteo.com/**", async (route) => {
    const times: string[] = [];
    const clouds: number[] = [];
    for (let h = 0; h < 48; h++) {
      const d = new Date(Date.UTC(2026, 10, 17, h, 0, 0));
      times.push(d.toISOString().slice(0, 16));
      clouds.push(12);
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        hourly: {
          time: times,
          cloud_cover: clouds,
        },
      }),
    });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?lat=33.77&lon=-118.19&date=2026-11-17&sky=suburban&eq=eye");

  const rankedSection = page.getByRole("region", { name: "Ranked observable objects" });
  await expect(rankedSection).toBeVisible();

  const firstCardButton = rankedSection.locator("button[aria-expanded]").first();
  await expect(firstCardButton).toBeVisible();
  await firstCardButton.click();

  await expect(firstCardButton).toHaveAttribute("aria-expanded", "true");
  const reasoningRegion = rankedSection.locator('[role="region"][aria-label$="visibility reasoning"]');
  await expect(reasoningRegion).toBeVisible();
  await expect(reasoningRegion.getByText("Altitude", { exact: true })).toBeVisible();
  await expect(reasoningRegion.getByText("Brightness", { exact: true })).toBeVisible();
  await expect(reasoningRegion.getByText("Moon", { exact: true })).toBeVisible();
  await expect(reasoningRegion.getByText("Duration", { exact: true })).toBeVisible();
  await expect(reasoningRegion.getByText("Darkness", { exact: true })).toBeVisible();
  await expect(reasoningRegion.getByText("Clouds", { exact: true })).toBeVisible();

  await page.waitForTimeout(650);
  await page.screenshot({
    path: path.join(screenshotsDir, "desktop.png"),
    fullPage: false,
  });

  const redLightButton = page.getByRole("button", { name: "Red light" }).first();
  await redLightButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "red");
  await page.waitForTimeout(200);
  await page.screenshot({
    path: path.join(screenshotsDir, "red-light.png"),
    fullPage: false,
  });

  await redLightButton.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-mode", "red");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(screenshotsDir, "phone.png"),
    fullPage: true,
  });
});
