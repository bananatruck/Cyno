export function readBeamVisibility(cardElement: Element) {
  const beamElement = cardElement.querySelector("[data-border-beam]");
  const ring = beamElement?.parentElement;
  if (!(beamElement instanceof HTMLElement) || !ring) throw new Error("Expected the beam inside its ring");
  const beamRect = beamElement.getBoundingClientRect();
  const cardRect = cardElement.getBoundingClientRect();
  const ringRect = ring.getBoundingClientRect();
  const ringWidth = Number.parseFloat(getComputedStyle(ring).borderTopWidth);
  let opacity = 1;
  for (let node: Element | null = beamElement; node; node = node.parentElement) {
    opacity *= Number(getComputedStyle(node).opacity);
    if (node === cardElement) break;
  }
  const visible = {
    left: Math.max(beamRect.left, cardRect.left),
    right: Math.min(beamRect.right, cardRect.right),
    top: Math.max(beamRect.top, cardRect.top),
    bottom: Math.min(beamRect.bottom, cardRect.bottom),
  };
  const style = getComputedStyle(beamElement);
  return {
    width: beamRect.width,
    height: beamRect.height,
    opacity,
    visibility: style.visibility,
    display: style.display,
    backgroundImage: style.backgroundImage,
    ringWidth,
    visibleWidth: Math.max(0, visible.right - visible.left),
    visibleHeight: Math.max(0, visible.bottom - visible.top),
    // Geometry only: the beam's box reaches the ring's border band. Whether the mask actually paints it
    // there is checked from rendered pixels by compareCardShots.
    reachesBorderBand:
      visible.left < ringRect.left + ringWidth ||
      visible.right > ringRect.right - ringWidth ||
      visible.top < ringRect.top + ringWidth ||
      visible.bottom > ringRect.bottom - ringWidth,
  };
}

/**
 * Counts the pixels that differ between two screenshots of the same card, one with the beam and one with
 * only the beam hidden, so it measures what a person sees rather than computed style. A pixel counts as
 * changed when its red, green and blue values differ by more than 30 in total. Pixels within `band` of the
 * card's edge are the border band; pixels at least `interiorFrom` from every edge are the interior, which
 * leaves the rounded corners, where the band curves inward, out of both. Runs in the page, which can
 * decode the PNG screenshots, so it uses nothing from outside its own body.
 */
export async function compareCardShots({
  withBeam,
  withoutBeam,
  band,
  interiorFrom,
}: {
  withBeam: string;
  withoutBeam: string;
  band: number;
  interiorFrom: number;
}) {
  const load = (base64: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Screenshot did not decode"));
      image.src = `data:image/png;base64,${base64}`;
    });
  const pixels = (image: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2D canvas");
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, image.width, image.height).data;
  };
  const [shown, hidden] = await Promise.all([load(withBeam), load(withoutBeam)]);
  if (shown.width !== hidden.width || shown.height !== hidden.height) {
    throw new Error("Screenshots differ in size");
  }
  const a = pixels(shown);
  const b = pixels(hidden);
  const { width, height } = shown;
  let inBand = 0;
  let inside = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const difference =
        Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      if (difference <= 30) continue;
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      if (edge < band) inBand++;
      else if (edge >= interiorFrom) inside++;
    }
  }
  return { inBand, inside };
}
