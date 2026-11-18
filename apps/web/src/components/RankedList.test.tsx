import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { planNight } from "@cyno/engine";
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
      expect(within(reasoningRegion).getByText(factor.label)).toBeTruthy();
      expect(within(reasoningRegion).getByText(factor.value)).toBeTruthy();
      expect(within(reasoningRegion).getByText(factor.detail)).toBeTruthy();
      const signed = formatSignedPoints(factor.points);
      expect(within(reasoningRegion).getAllByText(signed).length).toBeGreaterThan(0);
    }
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
});
