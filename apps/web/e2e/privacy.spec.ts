import { expect, test } from "@playwright/test";

const OPEN_METEO = "https://api.open-meteo.com/**";
const LONG_BEACH = "/?lat=33.77&lon=-118.19&date=2026-11-17&sky=suburban&eq=eye";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-17T20:00:00Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("weather opt-out persists and leaves the full astronomy plan usable without sending coordinates", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("privacy-test-seeded")) return;
    localStorage.setItem("cyno:weather-enabled", "0");
    sessionStorage.setItem("privacy-test-seeded", "1");
  });
  let requests = 0;
  await page.route(OPEN_METEO, async (route) => {
    requests += 1;
    await route.abort();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(LONG_BEACH);
  const setting = page.getByRole("checkbox", { name: "Use Open-Meteo cloud forecast" });
  await expect(setting).not.toBeChecked();
  const forecast = page.getByRole("status", { name: "Cloud forecast" });
  await expect(forecast).toHaveText(
    "Cloud forecast is off. Cloud cover is unknown; rankings and the verdict ignore clouds.",
  );
  await expect(page.locator("#weather-privacy-note")).toContainText(
    "your coordinates are sent to Open-Meteo",
  );
  await page.getByRole("spinbutton", { name: "Latitude" }).fill("34");
  await expect(page.getByRole("region", { name: "Tonight's verdict" })).toContainText("34.00°");
  await page
    .getByRole("group", { name: "Equipment", exact: true })
    .getByRole("button", { name: "Binoculars", exact: true })
    .click();
  const ranked = page.getByRole("region", { name: "Ranked observable objects" });
  const firstCard = ranked.locator("button[aria-expanded]").first();
  await firstCard.click();
  await expect(firstCard).toHaveAttribute("aria-expanded", "true");
  await expect(ranked.locator('[role="region"][aria-label$="visibility reasoning"]')).toContainText(
    "No forecast.",
  );
  const chart = page.getByRole("region", { name: "Tonight's sky" }).locator("figure > svg");
  await expect(chart.getByRole("button").first()).toBeVisible();
  const slider = page.getByRole("slider");
  await slider.focus();
  await page.keyboard.press("Home");
  const start = await slider.getAttribute("aria-valuenow");
  await page.keyboard.press("ArrowRight");
  await expect(slider).not.toHaveAttribute("aria-valuenow", start!);
  expect(requests).toBe(0);

  // The initialization script seeds only once; reload tests the app's persisted choice.
  await setting.check();
  await expect(forecast).toContainText("offline");
  expect(requests).toBeGreaterThan(0);
  await setting.uncheck();
  await expect(forecast).toContainText("Cloud forecast is off");
  const sent = requests;
  await page.reload();
  await expect(setting).not.toBeChecked();
  await expect(forecast).toContainText("Cloud forecast is off");
  expect(requests).toBe(sent);
});
