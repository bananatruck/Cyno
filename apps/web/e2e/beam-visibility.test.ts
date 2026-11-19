import { afterEach, describe, expect, it } from "vitest";
import { readBeamVisibility } from "./beam-visibility";

afterEach(() => document.body.replaceChildren());

describe("selected card beam visibility", () => {
  for (const cardOpacity of [0, 0.5, 1]) {
    it(`includes the card opacity of ${cardOpacity}`, () => {
      const card = document.createElement("div");
      card.style.opacity = String(cardOpacity);
      const ring = document.createElement("div");
      ring.style.opacity = "0.8";
      const beam = document.createElement("div");
      beam.dataset.borderBeam = "";
      beam.style.opacity = "0.5";
      ring.append(beam);
      card.append(ring);
      document.body.append(card);

      expect(readBeamVisibility(card).opacity).toBeCloseTo(cardOpacity * 0.8 * 0.5);
    });
  }
});
