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
    // The ring's mask shows the beam only on its border band, so the visible part must reach into it.
    reachesBorderBand:
      visible.left < ringRect.left + ringWidth ||
      visible.right > ringRect.right - ringWidth ||
      visible.top < ringRect.top + ringWidth ||
      visible.bottom > ringRect.bottom - ringWidth,
  };
}
