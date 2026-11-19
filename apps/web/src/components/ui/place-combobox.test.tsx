import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlaceCombobox } from "./place-combobox";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderCombobox(
  onSelectPreset = vi.fn(),
  coordinates: { latitude: number | string; longitude: number | string } = {
    latitude: 33.77,
    longitude: -118.19,
  },
) {
  render(
    <PlaceCombobox
      selectedName="Long Beach, CA"
      latitude={coordinates.latitude}
      longitude={coordinates.longitude}
      onSelectPreset={onSelectPreset}
    />,
  );
  const button = screen.getByRole("button", { name: "Place preset: Long Beach, CA" });
  fireEvent.click(button);
  return { button, input: screen.getByRole("combobox"), onSelectPreset };
}

/** Replaces scrollIntoView on every element for the duration of `run`, then restores the original. */
function withScrollIntoView(run: (scrollIntoView: ReturnType<typeof vi.fn>) => void) {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  try {
    run(scrollIntoView);
  } finally {
    if (original) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", original);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  }
}

describe("PlaceCombobox", () => {
  it("connects the preset button to its dialog", () => {
    const { button } = renderCombobox();
    const dialog = screen.getByRole("dialog", { name: "Choose a preset place" });

    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-controls")).toBe(dialog.id);
  });

  it("identifies the highlighted option and scrolls it into view across wrap-around", () => {
    const before = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    withScrollIntoView((scrollIntoView) => {
      const { input } = renderCombobox();
      const options = screen.getAllByRole("option");

      expect(input.getAttribute("aria-activedescendant")).toBe(options[0]?.id);
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(input.getAttribute("aria-activedescendant")).toBe(options.at(-1)?.id);
      expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest" });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(input.getAttribute("aria-activedescendant")).toBe(options[0]?.id);
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
    });
    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView")).toEqual(before);
  });

  it("starts at the top option again when the picker reopens", () => {
    withScrollIntoView(() => {
      const { button, input } = renderCombobox();
      fireEvent.keyDown(input, { key: "ArrowUp" });
      fireEvent.keyDown(input, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();

      fireEvent.click(button);
      const options = screen.getAllByRole("option");
      expect(screen.getByRole("combobox").getAttribute("aria-activedescendant")).toBe(options[0]?.id);
    });
  });

  it("marks a preset as selected only when the coordinates are plain decimals the planner accepts", () => {
    renderCombobox(vi.fn(), { latitude: "3.377e1", longitude: "-118.19" });
    expect(screen.getByRole("option", { name: /Long Beach/ }).getAttribute("aria-selected")).toBe("false");
    cleanup();

    renderCombobox(vi.fn(), { latitude: "33.77", longitude: "-118.19" });
    expect(screen.getByRole("option", { name: /Long Beach/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("returns focus to the preset button after Escape and keyboard selection", () => {
    const first = renderCombobox();
    first.input.focus();
    fireEvent.keyDown(first.input, { key: "Escape" });
    expect(document.activeElement).toBe(first.button);

    cleanup();
    withScrollIntoView(() => {
      const second = renderCombobox();
      second.input.focus();
      fireEvent.keyDown(second.input, { key: "ArrowDown" });
      fireEvent.keyDown(second.input, { key: "Enter" });
      expect(second.onSelectPreset).toHaveBeenCalledWith(expect.objectContaining({ name: "London" }));
      expect(document.activeElement).toBe(second.button);
    });
  });

  it("does not return focus when an outside click dismisses the dialog", () => {
    const { button, input } = renderCombobox();
    input.focus();
    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).not.toBe(button);
  });

  it("keeps an empty status outside the listbox until there are no results", () => {
    const { input } = renderCombobox();
    const listbox = screen.getByRole("listbox");
    const status = screen.getByRole("status");

    expect(status.textContent).toBe("");
    expect(listbox.contains(status)).toBe(false);
    fireEvent.change(input, { target: { value: "No such place" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
    expect(status.textContent).toContain("No matching preset");
    expect(listbox.contains(status)).toBe(false);
  });
});
