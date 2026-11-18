import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { planNight } from "@cyno/engine";
import { formatSignedPoints } from "@/lib/format";
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
