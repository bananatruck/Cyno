import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { planNight, type NightPlan } from "@cyno/engine";
import { RankedList } from "../RankedList";

const stylesheet = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const redModeBlock = stylesheet.match(/html\[data-mode="red"\]\s*\{(?<tokens>[\s\S]*?)\}/)?.groups?.tokens;

function token(name: string) {
  const value = redModeBlock?.match(new RegExp(`${name}:\\s*(#[\\da-f]{6})`, "i"))?.[1];
  if (!value) throw new Error(`Missing ${name} in the red-mode token block`);
  return value;
}

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as Rgb;
}

function luminance(color: Rgb) {
  const [red = 0, green = 0, blue = 0] = color.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: Rgb, second: Rgb) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Source-over compositing in sRGB, which is what the browser does for a colour with alpha. */
function over(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return top.map((channel, i) => channel * alpha + bottom[i]! * (1 - alpha)) as Rgb;
}

describe("red-mode contrast", () => {
  it("keeps every text token at WCAG AA contrast on every panel background token", () => {
    const textTokens = ["--starlight", "--moonsilver", "--signal", "--horizon"];
    const backgroundTokens = ["--abyss", "--nautical", "--civil"];

    for (const textName of textTokens) {
      for (const backgroundName of backgroundTokens) {
        expect(
          contrast(rgb(token(textName)), rgb(token(backgroundName))),
          `${textName} on ${backgroundName}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

const COLOR_TOKENS = "abyss|nautical|civil|horizon|starlight|moonsilver|signal";
const TEXT_CLASS = new RegExp(`^text-(${COLOR_TOKENS})(?:/(\\d+))?$`);
const BACKGROUND_CLASS = new RegExp(`^bg-(${COLOR_TOKENS})(?:/(\\d+))?$`);
const PLACEHOLDER_CLASS = new RegExp(`^placeholder:text-(${COLOR_TOKENS})(?:/(\\d+))?$`);
const OPACITY_CLASS = /^opacity-(\d+)$/;

function classesOf(element: Element): string[] {
  return (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

function tokenColor(match: RegExpMatchArray): { color: Rgb; alpha: number } {
  return { color: rgb(token(`--${match[1]}`)), alpha: match[2] ? Number(match[2]) / 100 : 1 };
}

/** Ancestors from the outermost down to the element itself. */
function lineage(element: Element): Element[] {
  const chain: Element[] = [];
  for (let node: Element | null = element; node; node = node.parentElement) chain.unshift(node);
  return chain;
}

function backgroundBehind(element: Element): Rgb {
  let background = rgb(token("--abyss"));
  for (const node of lineage(element)) {
    for (const name of classesOf(node)) {
      const match = name.match(BACKGROUND_CLASS);
      if (match) {
        const { color, alpha } = tokenColor(match);
        background = over(color, alpha, background);
      }
    }
  }
  return background;
}

function opacityOf(element: Element): number {
  let opacity = 1;
  for (const node of lineage(element)) {
    for (const name of classesOf(node)) {
      const match = name.match(OPACITY_CLASS);
      if (match) opacity *= Number(match[1]) / 100;
    }
  }
  return opacity;
}

function textColorOf(element: Element, pattern: RegExp): { color: Rgb; alpha: number } | null {
  for (const node of lineage(element).reverse()) {
    for (const name of classesOf(node)) {
      const match = name.match(pattern);
      if (match) return tokenColor(match);
    }
  }
  return null;
}

function composedContrast(element: Element, pattern: RegExp): number | null {
  const text = textColorOf(element, pattern);
  if (!text) return null;
  const background = backgroundBehind(element);
  return contrast(over(text.color, text.alpha * opacityOf(element), background), background);
}

/** Every element that paints text of its own, with the composed contrast of that text. */
function textContrasts(root: Element): { text: string; ratio: number | null }[] {
  const results: { text: string; ratio: number | null }[] = [];
  for (const element of root.querySelectorAll("*")) {
    const ownText = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();
    if (ownText) results.push({ text: ownText, ratio: composedContrast(element, TEXT_CLASS) });
    if (element instanceof HTMLInputElement && element.placeholder) {
      results.push({
        text: `placeholder "${element.placeholder}"`,
        ratio: composedContrast(element, PLACEHOLDER_CLASS),
      });
    }
  }
  return results;
}

/** Renders the list inside the panel App puts it in, so the composed backgrounds match the page. */
function renderInPanel(plan: NightPlan, selectedId: string | null) {
  return render(
    createElement(
      "div",
      { className: "bg-abyss text-starlight" },
      createElement(
        "div",
        { className: "rounded-2xl border border-moonsilver/20 bg-nautical/35 px-4 py-3" },
        createElement(RankedList, { plan, selectedId, onSelect: () => {} }),
      ),
    ),
  );
}

function expectSmallTextToPass(container: Element) {
  const results = textContrasts(container);
  expect(results.length).toBeGreaterThan(0);
  const failing = results.filter(({ ratio }) => ratio === null || ratio < 4.5);
  expect(
    failing.map(({ text, ratio }) => `${ratio === null ? "no colour class" : ratio.toFixed(2)}: ${text}`),
  ).toEqual([]);
}

describe("red-mode contrast of the ranked list, composed through its translucent layers", () => {
  const longBeach = {
    latitude: 33.77,
    longitude: -118.19,
    date: "2026-11-17",
    sky: "suburban",
    equipment: "eye",
  } as const;
  const plan = planNight(longBeach);
  const start = Date.parse("2026-11-17T18:00:00Z");
  const overcast = planNight({
    ...longBeach,
    cloudCover: Array.from({ length: 30 }, (_, hour) => ({
      time: new Date(start + hour * 3_600_000).toISOString(),
      percent: 100,
    })),
  });
  const polarDay = planNight({ latitude: 69.65, longitude: 18.96, date: "2026-06-21" });

  afterEach(() => {
    cleanup();
  });

  it("composes alpha the way the browser does", () => {
    expect(over([255, 255, 255], 0.5, [0, 0, 0])).toEqual([127.5, 127.5, 127.5]);
    expect(contrast([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
  });

  it("passes 4.5:1 for every text style on the selected card, its factor tiles, highlights, chips and hidden list", () => {
    const { container } = renderInPanel(plan, plan.objects[0]!.id);
    expect(container.querySelector('[role="region"] dl')).not.toBeNull();
    expectSmallTextToPass(container);
  });

  it("passes 4.5:1 for the hidden-list search with no matches", () => {
    const { container } = renderInPanel(plan, null);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search not visible objects" }), {
      target: { value: "no such object" },
    });
    expectSmallTextToPass(container);
  });

  it.each([
    ["clouds hide everything", overcast],
    ["the sky never gets dark", polarDay],
    ["nothing passes the threshold", { ...plan, objects: [] }],
  ])("passes 4.5:1 for the empty state when %s", (_, emptyPlan) => {
    expect(emptyPlan.objects).toHaveLength(0);
    const { container } = renderInPanel(emptyPlan, null);
    expectSmallTextToPass(container);
  });
});
