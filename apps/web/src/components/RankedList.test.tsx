import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { planNight, type CloudSample } from "@cyno/engine";
import { formatSignedPoints, formatTimeHHMM } from "@/lib/format";
import { RankedList } from "./RankedList";

afterEach(() => {
  cleanup();
});

const samplePlan = planNight({
  latitude: 33.77,
  longitude: -118.19,
  date: "2026-11-17",
  sky: "suburban",
  equipment: "eye",
});

const CLOUD_REASON = "Clouds block every otherwise visible moment.";

/** Hourly cloud cover from 2026-11-17T18:00Z for 30 hours, covering the Long Beach night window. */
function hourlyClouds(percentAt: (time: Date) => number): CloudSample[] {
  const start = Date.parse("2026-11-17T18:00:00Z");
  return Array.from({ length: 30 }, (_, hour) => {
    const time = new Date(start + hour * 3_600_000);
    return { time: time.toISOString(), percent: percentAt(time) };
  });
}

function hoursBetween(from: string, to: string) {
  return (Date.parse(to) - Date.parse(from)) / 3_600_000;
}

describe("RankedList", () => {
  it("renders every factor with its signed points when an object is selected", () => {
    const firstObject = samplePlan.objects[0]!;
    const onSelect = vi.fn();

    render(<RankedList plan={samplePlan} selectedId={firstObject.id} onSelect={onSelect} />);

    const reasoningRegion = screen.getByRole("region", {
      name: `${firstObject.name} visibility reasoning`,
    });

    expect(firstObject.factors).toHaveLength(6);
    for (const factor of firstObject.factors) {
      const term = within(reasoningRegion).getByText(factor.label, { selector: "dt" });
      const group = term.closest<HTMLElement>("dl > div");
      if (!group) throw new Error(`Expected ${factor.label} to sit in its own group`);
      expect(within(group).getByRole("definition").textContent).toBe(formatSignedPoints(factor.points));
      expect(within(group).getByText(factor.value)).toBeTruthy();
      expect(within(group).getByText(factor.detail)).toBeTruthy();
      expect(group.textContent).toBe(
        `${factor.label}${formatSignedPoints(factor.points)}${factor.value}${factor.detail}`,
      );
    }
  });

  it("switches the filter to All when the selection moves outside it", () => {
    const planet = samplePlan.objects.find((object) => object.kind === "planet")!;
    const star = samplePlan.objects.find((object) => object.kind === "star")!;
    const { rerender } = render(<RankedList plan={samplePlan} selectedId={null} onSelect={() => {}} />);
    const chips = screen.getByRole("group", { name: "Filter objects by category" });
    const all = within(chips).getByRole("button", { name: /^All/ });
    const stars = within(chips).getByRole("button", { name: /^Stars/ });

    fireEvent.click(stars);
    rerender(<RankedList plan={samplePlan} selectedId={star.id} onSelect={() => {}} />);
    expect(stars.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: `${star.name} visibility reasoning` })).toBeTruthy();

    rerender(<RankedList plan={samplePlan} selectedId={planet.id} onSelect={() => {}} />);
    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: `${planet.name} visibility reasoning` })).toBeTruthy();

    fireEvent.click(stars);
    expect(stars.getAttribute("aria-pressed")).toBe("true");
  });

  it("switches back to All when the selected object is activated again from outside the filter", () => {
    const planet = samplePlan.objects.find((object) => object.kind === "moon" || object.kind === "planet")!;
    const onSelect = vi.fn();
    render(<RankedList plan={samplePlan} selectedId={planet.id} onSelect={onSelect} />);
    const chips = screen.getByRole("group", { name: "Filter objects by category" });
    const all = within(chips).getByRole("button", { name: /^All/ });
    const stars = within(chips).getByRole("button", { name: /^Stars/ });
    const reasoning = () => screen.queryByRole("region", { name: `${planet.name} visibility reasoning` });

    fireEvent.click(stars);
    expect(reasoning()).toBeNull();

    const highlights = screen.getByRole("group", { name: "Tonight's highlights" });
    fireEvent.click(within(highlights).getByRole("button", { name: /^Moon or planet/ }));
    expect(onSelect).toHaveBeenCalledWith(planet.id);
    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(reasoning()).toBeTruthy();
  });

  it("keeps a deliberate filter when the activated object belongs to it", () => {
    const star = samplePlan.objects.find((object) => object.kind === "star")!;
    render(<RankedList plan={samplePlan} selectedId={star.id} onSelect={() => {}} />);
    const chips = screen.getByRole("group", { name: "Filter objects by category" });
    const stars = within(chips).getByRole("button", { name: /^Stars/ });
    fireEvent.click(stars);

    const highlights = screen.getByRole("group", { name: "Tonight's highlights" });
    const highlightedStar = within(highlights)
      .getAllByRole("button")
      .find((button) => button.textContent?.startsWith("Star"));
    fireEvent.click(highlightedStar!);
    expect(stars.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the visible window and Moon distance as separate lines, without middle dots", () => {
    const firstObject = samplePlan.objects.find((object) => object.moonSeparationDeg !== null)!;
    const zone = samplePlan.input.timeZone;
    render(<RankedList plan={samplePlan} selectedId={firstObject.id} onSelect={() => {}} />);

    const region = screen.getByRole("region", { name: `${firstObject.name} visibility reasoning` });
    const visible = within(region).getByText(
      `Visible ${formatTimeHHMM(firstObject.visibleFrom, zone)} to ${formatTimeHHMM(firstObject.visibleTo, zone)}`,
    );
    const moon = within(region).getByText(`${Math.round(firstObject.moonSeparationDeg!)}° from the Moon`);
    expect(visible).not.toBe(moon);
    expect(visible.textContent).not.toContain("Moon");

    const list = screen.getByRole("region", { name: "Ranked observable objects" });
    expect(list.textContent).not.toContain("\u00b7");
  });

  describe("visible window", () => {
    const visibleLine = (name: string) => {
      const region = screen.getByRole("region", { name: `${name} visibility reasoning` });
      return within(region).getByText(/^Visible /, { selector: "p" }).textContent;
    };

    it("discloses the accumulated hours when clouds open a gap between the first and last visible moment", () => {
      const gappy = planNight({
        latitude: 33.77,
        longitude: -118.19,
        date: "2026-11-17",
        sky: "suburban",
        equipment: "eye",
        cloudCover: hourlyClouds((time) =>
          time >= new Date("2026-11-18T03:00:00Z") && time <= new Date("2026-11-18T10:00:00Z") ? 100 : 0,
        ),
      });
      const polaris = gappy.objects.find((object) => object.name === "Polaris");
      if (!polaris) throw new Error("Expected Polaris to be visible outside the cloudy hours");
      const span = hoursBetween(polaris.visibleFrom, polaris.visibleTo);
      expect(span - polaris.hoursVisible).toBeGreaterThan(gappy.input.stepMinutes / 60);

      const zone = gappy.input.timeZone;
      render(<RankedList plan={gappy} selectedId={polaris.id} onSelect={() => {}} />);
      expect(visibleLine(polaris.name)).toBe(
        `Visible for ${polaris.hoursVisible.toFixed(1)} hours between ` +
          `${formatTimeHHMM(polaris.visibleFrom, zone)} and ${formatTimeHHMM(polaris.visibleTo, zone)}`,
      );
    });

    it("keeps the plain range when the object is visible throughout it", () => {
      const step = samplePlan.input.stepMinutes / 60;
      const continuous = samplePlan.objects.find(
        (object) =>
          Math.abs(hoursBetween(object.visibleFrom, object.visibleTo) - object.hoursVisible) <= step,
      );
      if (!continuous) throw new Error("Expected an object visible without gaps");
      const zone = samplePlan.input.timeZone;
      render(<RankedList plan={samplePlan} selectedId={continuous.id} onSelect={() => {}} />);
      expect(visibleLine(continuous.name)).toBe(
        `Visible ${formatTimeHHMM(continuous.visibleFrom, zone)} to ${formatTimeHHMM(continuous.visibleTo, zone)}`,
      );
    });
  });

  it("labels highlights with the best time and score, as toggle buttons", () => {
    const top = samplePlan.objects[0]!;
    render(<RankedList plan={samplePlan} selectedId={top.id} onSelect={() => {}} />);
    const highlights = screen.getByRole("group", { name: "Tonight's highlights" });
    const buttons = within(highlights).getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.textContent).toMatch(/Best at \d\d:\d\d, score \d+$/);
      expect(button.getAttribute("aria-pressed")).toMatch(/^(true|false)$/);
    }
    const pressed = buttons.filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]!.textContent).toContain(
      `Best at ${formatTimeHHMM(top.best.time, samplePlan.input.timeZone)}, score ${Math.round(top.score)}`,
    );
  });

  it("toggles filter chips with aria-pressed", () => {
    render(<RankedList plan={samplePlan} selectedId={null} onSelect={() => {}} />);
    const chips = screen.getByRole("group", { name: "Filter objects by category" });
    const all = within(chips).getByRole("button", { name: /^All/ });
    const stars = within(chips).getByRole("button", { name: /^Stars/ });
    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(stars.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(stars);
    expect(all.getAttribute("aria-pressed")).toBe("false");
    expect(stars.getAttribute("aria-pressed")).toBe("true");
  });

  it("links each expanded card button to its reasoning with aria-expanded and aria-controls", () => {
    const [first, second] = samplePlan.objects;
    const onSelect = vi.fn();
    render(<RankedList plan={samplePlan} selectedId={first!.id} onSelect={onSelect} />);

    const expanded = screen
      .getAllByRole("button", { expanded: true })
      .filter((button) => button.textContent?.includes(first!.name));
    expect(expanded).toHaveLength(1);
    const controls = expanded[0]!.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls!)?.getAttribute("aria-label")).toBe(
      `${first!.name} visibility reasoning`,
    );

    const collapsed = screen
      .getAllByRole("button", { expanded: false })
      .find((button) => button.textContent?.includes(second!.name))!;
    fireEvent.click(collapsed);
    expect(onSelect).toHaveBeenCalledWith(second!.id);
  });

  it("shows the top ten, any selected object further down, and the rest on request", () => {
    expect(samplePlan.objects.length).toBeGreaterThan(12);
    const cardButtons = () =>
      screen.getAllByRole("button").filter((button) => button.hasAttribute("aria-expanded"));
    const twelfth = samplePlan.objects[11]!;

    render(<RankedList plan={samplePlan} selectedId={null} onSelect={() => {}} />);
    expect(cardButtons()).toHaveLength(10);
    cleanup();

    render(<RankedList plan={samplePlan} selectedId={twelfth.id} onSelect={() => {}} />);
    expect(cardButtons()).toHaveLength(12);
    const more = samplePlan.objects.length - 12;
    fireEvent.click(screen.getByRole("button", { name: `Show ${more} more objects` }));
    expect(cardButtons()).toHaveLength(samplePlan.objects.length);
    expect(screen.queryByRole("button", { name: /^Show \d+ more/ })).toBeNull();
  });

  it("filters the not-visible list by search query", () => {
    expect(samplePlan.hidden.length).toBeGreaterThan(1);
    const targetHidden = samplePlan.hidden[0]!;
    const otherHidden = samplePlan.hidden.find((h) => h.name !== targetHidden.name)!;

    render(<RankedList plan={samplePlan} selectedId={null} onSelect={() => {}} />);

    const searchInput = screen.getByRole("searchbox", {
      name: "Search not visible objects",
    });

    fireEvent.change(searchInput, { target: { value: targetHidden.name } });

    const hiddenList = screen.getByRole("list", {
      name: "Objects not visible tonight",
    });
    expect(within(hiddenList).getByText(targetHidden.name)).toBeTruthy();
    expect(within(hiddenList).queryByText(otherHidden.name)).toBeNull();
  });

  it("hides the kind label when it only repeats the object's name", () => {
    const moon = samplePlan.objects.find((object) => object.kind === "moon")!;
    const planet = samplePlan.objects.find((object) => object.kind === "planet")!;
    render(<RankedList plan={samplePlan} selectedId={moon.id} onSelect={() => {}} />);
    const cardButton = (name: string) =>
      screen
        .getAllByRole("button")
        .find((button) => button.hasAttribute("aria-expanded") && button.textContent?.includes(name))!;
    expect(cardButton(moon.name).textContent).not.toMatch(/Moon\s*Moon/);
    expect(within(cardButton(moon.name)).getAllByText(/^moon$/i)).toHaveLength(1);
    expect(within(cardButton(planet.name)).getByText("Planet")).toBeTruthy();
  });

  describe("empty state", () => {
    const polarDay = planNight({ latitude: 69.65, longitude: 18.96, date: "2026-06-21" });
    const antarcticDay = planNight({ latitude: -75, longitude: 0, date: "2026-12-21" });
    const emptyList = () => screen.getByRole("region", { name: "Ranked observable objects" });

    it.each([
      ["Tromso in June", polarDay],
      ["Antarctica in December", antarcticDay],
    ])("says the sky never gets dark on a polar day (%s)", (_, plan) => {
      expect(plan.condition).toBe("polar-day");
      expect(plan.objects).toHaveLength(0);
      render(<RankedList plan={plan} selectedId={null} onSelect={() => {}} />);
      const text = emptyList().textContent ?? "";
      expect(text).toContain("The sky never gets dark enough tonight");
      expect(text).not.toMatch(/darker sky|binoculars|telescope/);
      const link = within(emptyList()).getByRole("link", { name: /verdict explanation/ });
      expect(link.getAttribute("href")).toBe("#tonights-verdict");
    });

    it("says the sky never gets dark on a white night even with a normal-looking hidden list", () => {
      const whiteNight = { ...samplePlan, condition: "white-night" as const, objects: [] };
      render(<RankedList plan={whiteNight} selectedId={null} onSelect={() => {}} />);
      expect(emptyList().textContent).toContain("The sky never gets dark enough tonight");
    });

    it("says the sky never gets dark when every hidden reason says so", () => {
      const neverDark = {
        ...samplePlan,
        objects: [],
        hidden: samplePlan.hidden.map((item) => ({
          ...item,
          reason: "The sky never gets dark here tonight.",
        })),
      };
      render(<RankedList plan={neverDark} selectedId={null} onSelect={() => {}} />);
      expect(emptyList().textContent).toContain("The sky never gets dark enough tonight");
    });

    it("says the forecast clouds hide everything on a fully overcast night", () => {
      const overcast = planNight({
        latitude: 33.77,
        longitude: -118.19,
        date: "2026-11-17",
        sky: "suburban",
        equipment: "eye",
        cloudCover: hourlyClouds(() => 100),
      });
      expect(overcast.objects).toHaveLength(0);
      expect(overcast.hidden.some((item) => item.reason === CLOUD_REASON)).toBe(true);
      render(<RankedList plan={overcast} selectedId={null} onSelect={() => {}} />);
      const text = emptyList().textContent ?? "";
      expect(text).toContain("The forecast clouds hide everything tonight");
      expect(text).not.toMatch(/darker sky|binoculars|telescope|never gets dark/);
    });

    it("keeps the sky and equipment advice for nights that do get dark", () => {
      const darkButEmpty = { ...samplePlan, objects: [] };
      expect(darkButEmpty.condition).toBe("normal");
      render(<RankedList plan={darkButEmpty} selectedId={null} onSelect={() => {}} />);
      const text = emptyList().textContent ?? "";
      expect(text).toContain("Try switching to a darker sky preset");
      expect(text).not.toContain("never gets dark");
    });
  });
});
