import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const redModeBlock = stylesheet.match(/html\[data-mode="red"\]\s*\{(?<tokens>[\s\S]*?)\}/)?.groups?.tokens;

function token(name: string) {
  const value = redModeBlock?.match(new RegExp(`${name}:\\s*(#[\\da-f]{6})`, "i"))?.[1];
  if (!value) throw new Error(`Missing ${name} in the red-mode token block`);
  return value;
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("red-mode contrast", () => {
  it("keeps every text token at WCAG AA contrast on every panel background token", () => {
    const textTokens = ["--starlight", "--moonsilver", "--signal", "--horizon"];
    const backgroundTokens = ["--abyss", "--nautical", "--civil"];

    for (const textName of textTokens) {
      for (const backgroundName of backgroundTokens) {
        expect(
          contrast(token(textName), token(backgroundName)),
          `${textName} on ${backgroundName}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
