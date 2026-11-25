import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { compareCardShots, readBeamVisibility } from "./beam-visibility";
import { waitForPageSettle } from "../src/lib/page-settle";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.resolve(__dirname, "../../../docs/screenshots");
const OPEN_METEO = "https://api.open-meteo.com/**";
const PLAN_DATE = "2026-11-17";
const LONG_BEACH = `/?lat=33.77&lon=-118.19&date=${PLAN_DATE}&sky=suburban&eq=eye`;

test.beforeAll(() => {
  fs.mkdirSync(screenshotsDir, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  // The forecast window and the default date both follow "today", so pin it to the plan date.
  await page.clock.setFixedTime(new Date(`${PLAN_DATE}T20:00:00Z`));
  await page.emulateMedia({ reducedMotion: "reduce" });
});

function screenshotPath(name: string) {
  return path.join(screenshotsDir, name);
}

/** Waits until web fonts are loaded and every finite animation or transition has finished. */
async function settle(page: Page) {
  try {
    await page.evaluate(waitForPageSettle);
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
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

  await settle(page);
  await page.screenshot({ path: screenshotPath("desktop.png"), fullPage: false, animations: "disabled" });

  const redLightButton = page.getByRole("button", { name: "Red light" });
  await redLightButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "red");
  await settle(page);
  await page.screenshot({ path: screenshotPath("red-light.png"), fullPage: false, animations: "disabled" });
  await redLightButton.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-mode", "red");

  await page.setViewportSize({ width: 390, height: 844 });
  const summary = page.locator('button[aria-controls="cyno-controls-sheet"]');
  await expect(summary).toBeVisible();
  await expect(reasoningRegion).toBeVisible();
  expect(await nestedScrollRegions(page), "no nested scroll regions on a phone").toEqual([]);

  const summaryLines = summary.locator(":scope > span > span");
  await expect(summaryLines).toHaveText(["Long Beach, CA", "2026-11-17, Suburban sky, Eye"]);
  for (const line of await summaryLines.all()) {
    const fits = await line.evaluate((element) => element.scrollWidth <= element.clientWidth);
    expect(fits, "summary line is not truncated").toBe(true);
    expect((await line.boundingBox())?.height, "summary line stays on one line").toBeLessThan(26);
  }

  await settle(page);
  await page.screenshot({ path: screenshotPath("phone.png"), fullPage: true, animations: "disabled" });
});

test("fits the loading placeholder to a 320-pixel phone", async ({ page }) => {
  await page.route(OPEN_METEO, (route) => route.abort());
  // Hold the calculation worker back so the placeholder stays on screen while it is measured.
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/plan\.worker[^/]*\.js/, async (route) => {
    await held;
    await route.continue();
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(LONG_BEACH);
  await expect(page.getByRole("status", { name: "Computing night plan" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  release();
  expect(overflow, "page wider than the viewport while the plan computes").toBeLessThanOrEqual(0);
});

test("keeps the sky chart usable in a short desktop window and lets the page scroll", async ({ page }) => {
  await page.route(OPEN_METEO, (route) => route.abort());
  await page.setViewportSize({ width: 1280, height: 380 });
  await page.goto(LONG_BEACH);

  const chart = page.getByRole("region", { name: "Tonight's sky" }).locator("figure > svg");
  await expect(chart).toBeVisible();
  const bounds = await box(chart);
  expect(bounds.width, "chart keeps a usable width").toBeGreaterThanOrEqual(260);
  expect(Math.abs(bounds.width - bounds.height), "chart is square").toBeLessThan(1.5);

  const timeline = page.getByRole("region", { name: "Night sky timeline" });
  await timeline.scrollIntoViewIfNeeded();
  await expect(timeline).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY), "the page scrolls to reach the timeline").toBeGreaterThan(
    0,
  );
});

test("keeps an empty or non-decimal latitude from the URL invalid after a reload", async ({ page }) => {
  await page.route(OPEN_METEO, (route) => route.abort());
  await page.setViewportSize({ width: 1440, height: 900 });
  const latitude = page.getByLabel("Latitude");
  const latitudeError = page.getByRole("alert");

  for (const rawLat of ["", "0x21"]) {
    await page.goto(`/?lat=${rawLat}&lon=-118.19&date=${PLAN_DATE}&sky=suburban&eq=eye`);
    await expect(latitudeError).toHaveText("Latitude must be between -90° and 90°.");
    await expect(latitude).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("heading", { name: "Check the coordinates or date above" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Tonight's verdict" })).toHaveCount(0);

    await page.reload();
    await expect(latitudeError).toHaveText("Latitude must be between -90° and 90°.");
    await expect(page.getByRole("region", { name: "Tonight's verdict" })).toHaveCount(0);
  }
});

test("uses a mocked Open-Meteo forecast for the clouds factor", async ({ page }) => {
  await page.route(OPEN_METEO, async (route) => {
    const start = Date.parse(`${PLAN_DATE}T00:00:00Z`);
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
  await page.goto(LONG_BEACH);

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
  await settle(page);
  await page.screenshot({ path: screenshotPath("polar-day.png"), fullPage: false, animations: "disabled" });
});

test("shows the latitude error for latitude 95", async ({ page }) => {
  await page.route(OPEN_METEO, (route) => route.abort());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/?lat=45&lon=0&date=${PLAN_DATE}`);
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
  await settle(page);
  await page.screenshot({ path: screenshotPath("input-error.png"), fullPage: false, animations: "disabled" });
});

test("labels every control and keeps focus visible in red-light mode", async ({ page }) => {
  await page.route(OPEN_METEO, (route) => route.abort());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(LONG_BEACH);
  await expect(page.getByRole("region", { name: "Ranked observable objects" })).toBeVisible();

  const controls = page.locator("button, input, select, [role='slider'], [role='button']");
  expect(await controls.count()).toBeGreaterThan(0);
  for (const control of await controls.all()) {
    if (!(await control.isVisible())) continue;
    await expect(
      control,
      (await control.evaluate((element) => element.outerHTML)).slice(0, 120),
    ).toHaveAccessibleName(/\S/);
  }

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

test("stops decorative animation under reduced motion so the page goes idle", async ({ page }) => {
  await page.route(OPEN_METEO, (route) => route.abort());
  await page.goto(LONG_BEACH);
  const rankedSection = page.getByRole("region", { name: "Ranked observable objects" });
  await rankedSection.locator("button[aria-expanded]").first().click();
  // A selected card carries the border beam; with reduced motion nothing may keep animating.
  const runningFinite = () =>
    page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((a) => a.playState === "running" && a.effect?.getComputedTiming().endTime !== Infinity)
          .length,
    );
  await expect.poll(runningFinite, { timeout: 2_000 }).toBe(0);
  for (let i = 0; i < 10; i++) {
    expect(await runningFinite(), "no animation restarts once the page is idle").toBe(0);
    await page.waitForTimeout(50);
  }

  const beam = rankedSection.locator("[data-border-beam]").first();
  await expect(beam).toBeVisible();
  const offsetSamples = await page.evaluate(async () => {
    const element = document.querySelector("[data-border-beam]");
    if (!(element instanceof HTMLElement)) {
      throw new Error("Expected a border beam element");
    }
    const read = () => getComputedStyle(element).offsetDistance;
    const samples: string[] = [];
    for (let i = 0; i < 10; i++) {
      samples.push(read());
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return samples;
  });
  expect(new Set(offsetSamples).size, "border beam offset-distance stays constant under reduced motion").toBe(
    1,
  );
});

test("draws a visible border beam inside the selected ranked card", async ({ page }, testInfo) => {
  await page.route(OPEN_METEO, (route) => route.abort());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(LONG_BEACH);
  const rankedSection = page.getByRole("region", { name: "Ranked observable objects" });
  const cardButton = rankedSection.locator("button[aria-expanded]").first();
  await cardButton.click();
  await expect(cardButton).toHaveAttribute("aria-expanded", "true");
  const card = cardButton.locator("xpath=..");
  await expect(card.locator("[data-border-beam]")).toHaveCount(1);
  await settle(page);

  const beam = await card.evaluate(readBeamVisibility);

  expect(beam.width, "beam width").toBeGreaterThan(0);
  expect(beam.height, "beam height").toBeGreaterThan(0);
  expect(beam.opacity, "beam opacity through the card").toBeGreaterThan(0);
  expect(beam.visibility).toBe("visible");
  expect(beam.display).not.toBe("none");
  expect(beam.backgroundImage).toContain("gradient");
  expect(beam.ringWidth, "ring border width").toBeGreaterThan(0);
  expect(beam.visibleWidth, "visible width inside the card's border box").toBeGreaterThan(0);
  expect(beam.visibleHeight, "visible height inside the card's border box").toBeGreaterThan(0);
  expect(beam.reachesBorderBand, "the beam's box reaches the ring's border band").toBe(true);

  // What a person sees: the same card with and without the beam must differ on the border band and
  // nowhere inside it. A mask that hides the beam leaves the band unchanged; a missing mask paints
  // the beam over the interior.
  const { band, interiorFrom } = await card.evaluate((element) => {
    const ring = element.querySelector("[data-border-beam]")?.parentElement;
    if (!ring) throw new Error("Expected the beam inside its ring");
    const width = (node: Element, property: "borderTopWidth" | "borderTopLeftRadius") =>
      Number.parseFloat(getComputedStyle(node)[property]) || 0;
    const band = Math.ceil(width(element, "borderTopWidth") + width(ring, "borderTopWidth")) + 1;
    return { band, interiorFrom: band + Math.ceil(width(element, "borderTopLeftRadius")) + 2 };
  });
  const beamElement = card.locator("[data-border-beam]");
  const withBeam = (await card.screenshot({ animations: "disabled" })).toString("base64");
  await beamElement.evaluate((element) => {
    (element as HTMLElement).style.visibility = "hidden";
  });
  const withoutBeam = (await card.screenshot({ animations: "disabled" })).toString("base64");
  await beamElement.evaluate((element) => {
    (element as HTMLElement).style.visibility = "";
  });
  const painted = await page.evaluate(compareCardShots, { withBeam, withoutBeam, band, interiorFrom });
  expect(painted.inBand, "beam pixels painted on the border band").toBeGreaterThan(20);
  expect(painted.inside, "beam pixels painted inside the card").toBe(0);

  await card.screenshot({
    path: testInfo.outputPath("selected-card-border-beam.png"),
    animations: "disabled",
  });
});

test("settle gives up after its deadline even with the browser clock fixed", async ({ page }) => {
  test.setTimeout(20_000);
  // beforeEach fixed Date.now(); performance.now() must still advance, or no deadline can fire.
  await page.setContent("<div id='busy' style='width:10px;height:10px'></div>");
  const clocks = await page.evaluate(async () => {
    const d0 = Date.now();
    const p0 = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { date: Date.now() - d0, perf: performance.now() - p0 };
  });
  expect(clocks.date, "Date.now() is frozen by the fixed clock").toBe(0);
  expect(clocks.perf, "performance.now() keeps running").toBeGreaterThan(250);
  // A finite animation that outlasts the deadline keeps the page busy.
  await page.evaluate(() => {
    document.getElementById("busy")?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 60_000 });
  });
  const started = Date.now();
  await expect(page.evaluate(waitForPageSettle)).rejects.toThrow(/did not settle within 5000 ms/);
  expect(Date.now() - started).toBeLessThan(10_000);
});
