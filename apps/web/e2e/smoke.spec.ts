import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.resolve(__dirname, "../../../docs/screenshots");
const OPEN_METEO = "https://api.open-meteo.com/**";
const LONG_BEACH = "/?lat=33.77&lon=-118.19&date=2026-11-17&sky=suburban&eq=eye";

test.beforeAll(() => {
  fs.mkdirSync(screenshotsDir, { recursive: true });
});

function screenshotPath(name: string) {
  return path.join(screenshotsDir, name);
}

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error(`Expected ${locator.toString()} to be laid out`);
  return bounds;
}

/** Elements other than the page itself that scroll their own content. */
async function nestedScrollRegions(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        const overflowY = getComputedStyle(element).overflowY;
        return (
          (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight + 1
        );
      })
      .map((element) => element.outerHTML.slice(0, 120)),
  );
}

test("without a cloud forecast, lays out desktop and phone honestly and saves screenshots", async ({
  page,
}) => {
  await page.route(OPEN_METEO, (route) => route.abort());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(LONG_BEACH);

  const verdict = page.getByRole("region", { name: "Tonight's verdict" });
  await expect(verdict.getByRole("status", { name: "Cloud forecast" })).toHaveText(
    "No cloud forecast (offline). Ranking ignores clouds.",
  );
  await expect(verdict).toContainText("Long Beach, CA, Los Angeles time");
  await expect(verdict).toContainText(/Dark 18:15 to 05:01 \(10\.8 hours\)\. Waxing Gibbous Moon, \d+% lit/);

  const rankedSection = page.getByRole("region", { name: "Ranked observable objects" });
  const firstCardButton = rankedSection.locator("button[aria-expanded]").first();
  await firstCardButton.click();
  await expect(firstCardButton).toHaveAttribute("aria-expanded", "true");
  const reasoningRegion = rankedSection.locator('[role="region"][aria-label$="visibility reasoning"]');
  for (const label of ["Altitude", "Brightness", "Moon", "Duration", "Darkness", "Clouds"]) {
    await expect(reasoningRegion.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(reasoningRegion.locator("dt", { hasText: "Clouds" }).locator("xpath=../..")).toContainText(
    "No forecast.",
  );

  const skyPanel = await box(page.getByRole("region", { name: "Tonight's sky" }));
  const rankedPanel = await box(rankedSection.locator("xpath=.."));
  const timeline = await box(page.getByRole("region", { name: "Night sky timeline" }));
  const chart = await box(page.getByRole("region", { name: "Tonight's sky" }).locator("figure > svg"));
  expect(timeline.y + timeline.height, "timeline fits in a 1440x900 viewport").toBeLessThanOrEqual(900);
  expect(Math.abs(rankedPanel.height - skyPanel.height), "ranked panel matches the left column").toBeLessThan(
    1.5,
  );
  expect(Math.abs(rankedPanel.y - skyPanel.y)).toBeLessThan(1.5);
  expect(Math.abs(chart.width - chart.height), "chart is square").toBeLessThan(1.5);
  expect(chart.width, "chart fills the space it has").toBeGreaterThan(500);

  expect(await page.locator("body").innerText()).not.toContain("\u00b7");

  await page.waitForTimeout(650);
  await page.screenshot({ path: screenshotPath("desktop.png"), fullPage: false });

  const redLightButton = page.getByRole("button", { name: "Red light" });
  await redLightButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "red");
  await page.waitForTimeout(250);
  await page.screenshot({ path: screenshotPath("red-light.png"), fullPage: false });
  await redLightButton.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-mode", "red");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await expect(reasoningRegion).toBeVisible();
  expect(await nestedScrollRegions(page), "no nested scroll regions on a phone").toEqual([]);

  const summary = page.locator('button[aria-controls="cyno-controls-sheet"]');
  await expect(summary).toBeVisible();
  const summaryLines = summary.locator(":scope > span > span");
  await expect(summaryLines).toHaveText(["Long Beach, CA", "2026-11-17, Suburban sky, Eye"]);
  for (const line of await summaryLines.all()) {
    const fits = await line.evaluate((element) => element.scrollWidth <= element.clientWidth);
    expect(fits, "summary line is not truncated").toBe(true);
    expect((await line.boundingBox())?.height, "summary line stays on one line").toBeLessThan(26);
  }

  await page.screenshot({ path: screenshotPath("phone.png"), fullPage: true });
});

test("uses a mocked Open-Meteo forecast for the clouds factor", async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10);
  await page.route(OPEN_METEO, async (route) => {
    const start = Date.parse(`${today}T00:00:00Z`);
    const time = Array.from({ length: 48 }, (_, hour) =>
      new Date(start + hour * 3_600_000).toISOString().slice(0, 16),
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hourly: { time, cloud_cover: time.map(() => 40) } }),
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/?lat=33.77&lon=-118.19&date=${today}&sky=suburban&eq=eye`);

  const verdict = page.getByRole("region", { name: "Tonight's verdict" });
  await expect(verdict.getByRole("status", { name: "Cloud forecast" })).toHaveText(
    "Open-Meteo cloud forecast in use.",
  );
  await expect(verdict).toContainText("Cloud cover averages 40%");

  const rankedSection = page.getByRole("region", { name: "Ranked observable objects" });
  await rankedSection.locator("button[aria-expanded]").first().click();
  const clouds = rankedSection
    .locator('[role="region"][aria-label$="visibility reasoning"] dt', { hasText: "Clouds" })
    .locator("xpath=following-sibling::dd");
  await expect.poll(async () => Number(await clouds.textContent())).toBeLessThan(0);
});

test("explains polar day in Tromso on 2026-06-21", async ({ page }) => {
  await page.route(OPEN_METEO, (route) => route.abort());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?lat=69.65&lon=18.96&date=2026-06-21");

  const note = page.getByRole("region", { name: "Sky condition note" });
  await expect(note).toContainText("Polar day: the Sun stays above the horizon all night.");
  await expect(note).toContainText("The Sun never sets here tonight.");
  await expect(note).toContainText(
    "Try a date nearer the winter solstice, or choose a location closer to the equator.",
  );
  const ranked = page.getByRole("region", { name: "Ranked observable objects" });
  await expect(ranked).toContainText("The sky never gets dark enough tonight");
  await expect(ranked).not.toContainText("darker sky preset");
  await expect(ranked.getByRole("link", { name: "verdict explanation" })).toHaveAttribute(
    "href",
    "#tonights-verdict",
  );
  const timeline = await box(page.getByRole("region", { name: "Night sky timeline" }));
  expect(timeline.y + timeline.height, "timeline fits in a 1440x900 viewport").toBeLessThanOrEqual(900);
  await page.waitForTimeout(650);
  await page.screenshot({ path: screenshotPath("polar-day.png"), fullPage: false });
});

test("shows the latitude error for latitude 95", async ({ page }) => {
  await page.route(OPEN_METEO, (route) => route.abort());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?lat=45&lon=0&date=2026-11-17");
  const header = page.locator("header");
  const latitude = page.getByLabel("Latitude");
  await expect(page.getByRole("region", { name: "Tonight's verdict" })).toBeVisible();
  const validHeader = await box(header);

  await latitude.fill("95");
  await expect(latitude).toHaveAttribute("aria-invalid", "true");
  const alert = page.getByRole("alert");
  await expect(alert).toHaveText("Latitude must be between -90° and 90°.");
  await expect(latitude).toHaveAttribute("aria-describedby", (await alert.getAttribute("id"))!);
  expect((await box(header)).height, "the error does not change the header's height").toBeCloseTo(
    validHeader.height,
    0,
  );
  const latBox = await box(latitude);
  const alertBox = await box(alert);
  expect(alertBox.y, "the error sits below the field").toBeGreaterThanOrEqual(latBox.y + latBox.height);
  await expect(page.getByRole("heading", { name: "Check the coordinates or date above" })).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: screenshotPath("input-error.png"), fullPage: false });
});

test("labels every control and keeps focus visible in red-light mode", async ({ page }) => {
  await page.route(OPEN_METEO, (route) => route.abort());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(LONG_BEACH);
  await expect(page.getByRole("region", { name: "Ranked observable objects" })).toBeVisible();

  const unlabelled = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>("button, input, select, [role='slider'], [role='button']"),
    )
      .filter((control) => control.getClientRects().length > 0)
      .filter((control) => {
        const labels = (control as HTMLInputElement).labels;
        const name =
          control.getAttribute("aria-label") ||
          control.getAttribute("aria-labelledby") ||
          (labels && labels.length > 0 ? labels[0]?.textContent : "") ||
          control.textContent;
        return !name?.trim();
      })
      .map((control) => control.outerHTML.slice(0, 120)),
  );
  expect(unlabelled).toEqual([]);

  const highlights = page.getByRole("group", { name: "Tonight's highlights" }).getByRole("button");
  for (const button of await highlights.all()) await expect(button).toHaveAttribute("aria-pressed", /.+/);
  const chips = page.getByRole("group", { name: "Filter objects by category" }).getByRole("button");
  for (const chip of await chips.all()) await expect(chip).toHaveAttribute("aria-pressed", /.+/);
  const cards = page
    .getByRole("region", { name: "Ranked observable objects" })
    .locator("button[aria-expanded]");
  expect(await cards.count()).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Red light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "red");

  const focusTargets = [
    page.getByRole("button", { name: "Red light" }),
    page.getByLabel("Latitude"),
    page.getByRole("group", { name: "Filter objects by category" }).getByRole("button").first(),
    cards.first(),
  ];
  await page.keyboard.press("Tab");
  for (const target of focusTargets) {
    await target.focus();
    // transition-colors also animates outline-color, so wait for it to settle.
    await expect
      .poll(() =>
        target.evaluate((element) => {
          const style = getComputedStyle(element);
          return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`;
        }),
      )
      .toBe("solid 2px rgb(255, 90, 78)");
  }
});
