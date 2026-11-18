import { useId } from "react";
import type { NightPlan, ObjectKind } from "@cyno/engine";
import { clock, colors, nearest, trackPath, zoneLabel } from "./chart-utils";
import { project } from "./projection";
import "./sky.css";

export interface SkyChartProps {
  plan: NightPlan;
  time: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

const kindColors = {
  moon: colors.moonsilver,
  planet: colors.horizon,
  star: colors.starlight,
  "open-cluster": colors.signal,
  "globular-cluster": colors.signal,
  nebula: colors.signal,
  "planetary-nebula": colors.signal,
  galaxy: colors.moonsilver,
  "double-star": colors.starlight,
  other: colors.starlight,
} satisfies Record<ObjectKind, string>;
const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const CHART_RADIUS = 200;
const LABEL_FONT_SIZE = 17;
const LABEL_GAP = 13;
const LABEL_PADDING = 2;
const DOT_PADDING = 2;
const LABEL_DIRECTIONS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
] as const;

interface LabelBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface LabelPlacement {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
  box: LabelBox;
}

function labelBox(name: string, x: number, y: number, textAnchor: LabelPlacement["textAnchor"]) {
  const width = name.length * LABEL_FONT_SIZE * 0.6;
  const left = textAnchor === "end" ? x - width : textAnchor === "middle" ? x - width / 2 : x;
  return {
    left,
    right: left + width,
    top: y - LABEL_FONT_SIZE,
    bottom: y + LABEL_FONT_SIZE * 0.2,
  };
}

function overlaps(first: LabelBox, second: LabelBox) {
  return (
    first.left - LABEL_PADDING < second.right &&
    first.right + LABEL_PADDING > second.left &&
    first.top - LABEL_PADDING < second.bottom &&
    first.bottom + LABEL_PADDING > second.top
  );
}

function boxOverlapsCircle(box: LabelBox, centerX: number, centerY: number, radius: number) {
  const closestX = Math.max(box.left, Math.min(centerX, box.right));
  const closestY = Math.max(box.top, Math.min(centerY, box.bottom));
  return Math.hypot(centerX - closestX, centerY - closestY) < radius;
}

function altitudeRingLabelBoxes(): LabelBox[] {
  return [30, 60].map((alt) => {
    const y = (-CHART_RADIUS * (90 - alt)) / 90 + 14;
    return labelBox(`${alt}°`, 5, y, "start");
  });
}

function insideChart(box: LabelBox) {
  return [
    [box.left, box.top],
    [box.right, box.top],
    [box.left, box.bottom],
    [box.right, box.bottom],
  ].every(([x, y]) => Math.hypot(x ?? 0, y ?? 0) <= CHART_RADIUS);
}

interface DotObstacle {
  id: string;
  x: number;
  y: number;
  r: number;
}

function dotRadius(kind: ObjectKind, magnitude: number) {
  return kind === "moon" ? 7 : Math.max(2.5, Math.min(6, 4.5 - magnitude * 0.5));
}

function clearPlacement(
  box: LabelBox,
  occupied: readonly LabelBox[],
  dots: readonly DotObstacle[],
  objectId: string,
) {
  if (!insideChart(box)) return false;
  if (!occupied.every((placed) => !overlaps(box, placed))) return false;
  return dots.every(
    (dot) => dot.id === objectId || !boxOverlapsCircle(box, dot.x, dot.y, dot.r + DOT_PADDING),
  );
}

function labelCandidates(x: number, y: number, distances: readonly number[]) {
  const centeredBaseline = y + LABEL_FONT_SIZE * 0.4;
  const candidates: Omit<LabelPlacement, "box">[] = [];
  for (const distance of distances) {
    for (const [unitX, unitY] of LABEL_DIRECTIONS) {
      const length = Math.hypot(unitX, unitY);
      const offsetX = (unitX / length) * distance;
      const offsetY = (unitY / length) * distance;
      const textAnchor: LabelPlacement["textAnchor"] =
        offsetX > distance * 0.25 ? "start" : offsetX < -distance * 0.25 ? "end" : "middle";
      candidates.push({
        x: x + offsetX,
        y: centeredBaseline + offsetY,
        textAnchor,
      });
    }
  }
  return candidates;
}

function placeLabel(
  name: string,
  x: number,
  y: number,
  occupied: readonly LabelBox[],
  dots: readonly DotObstacle[],
  objectId: string,
  required: boolean,
) {
  const distances = required ? [LABEL_GAP, LABEL_GAP * 2, LABEL_GAP * 3] : [LABEL_GAP, LABEL_GAP * 2];
  for (const candidate of labelCandidates(x, y, distances)) {
    const box = labelBox(name, candidate.x, candidate.y, candidate.textAnchor);
    if (clearPlacement(box, occupied, dots, objectId)) {
      return { ...candidate, box };
    }
  }
  return undefined;
}

export function SkyChart({ plan, time, selectedId, onSelect, className }: SkyChartProps) {
  const id = useId();
  const visible = plan.objects.flatMap((object) => {
    const point = nearest(object.track, Date.parse(time));
    const position = point && project(point.altDeg, point.azDeg, CHART_RADIUS);
    return point && position ? [{ object, point, position }] : [];
  });
  const selected = plan.objects.find((object) => object.id === selectedId);
  const dotObstacles: DotObstacle[] = visible.map(({ object, position }) => ({
    id: object.id,
    x: position.x,
    y: position.y,
    r: dotRadius(object.kind, object.magnitude),
  }));
  const labelPlacements = new Map<string, LabelPlacement>();
  const occupied: LabelBox[] = [...altitudeRingLabelBoxes()];
  for (const { object, position } of [...visible].sort((first, second) => {
    if (first.object.id === selectedId) return -1;
    if (second.object.id === selectedId) return 1;
    return first.object.rank - second.object.rank;
  })) {
    const placement = placeLabel(
      object.name,
      position.x,
      position.y,
      occupied,
      dotObstacles,
      object.id,
      object.id === selectedId,
    );
    if (placement) {
      labelPlacements.set(object.id, placement);
      occupied.push(placement.box);
    }
  }
  const illumination = Math.max(0, Math.min(1, plan.moon.illumination));
  const terminator = Math.abs(1 - 2 * illumination) * 7;
  const waning = plan.moon.phaseName.startsWith("Waning") || plan.moon.phaseName === "Last Quarter";

  return (
    <figure className={`cyno-sky ${className ?? ""}`} style={{ margin: 0, color: colors.starlight }}>
      <svg
        viewBox="-240 -240 480 480"
        width="100%"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-summary`}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          maxWidth: "none",
          aspectRatio: "1 / 1",
          overflow: "visible",
        }}
      >
        <title id={`${id}-title`}>Sky looking up, east on the left</title>
        <circle r="200" fill={colors.abyss} fillOpacity="0.55" stroke={colors.signal} strokeOpacity="0.45" />
        {[30, 60].map((alt) => (
          <g key={alt} fill={colors.moonsilver}>
            <circle
              r={(200 * (90 - alt)) / 90}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.2"
              strokeDasharray="2 5"
            />
            <text x="5" y={(-200 * (90 - alt)) / 90 + 14} fontSize="17" opacity="0.75">
              {alt}°
            </text>
          </g>
        ))}
        <path d="M-200 0H200 M0-200V200" stroke={colors.moonsilver} strokeOpacity="0.12" />
        {selected && (
          <path
            d={trackPath(selected.track, (point) => project(point.altDeg, point.azDeg, 200))}
            fill="none"
            stroke={colors.signal}
            strokeOpacity="0.4"
            strokeWidth="1.5"
          />
        )}
        {[
          { name: "N", x: 0, y: -216 },
          { name: "E", x: -220, y: 5 },
          { name: "S", x: 0, y: 227 },
          { name: "W", x: 220, y: 5 },
        ].map((direction) => (
          <text
            key={direction.name}
            x={direction.x}
            y={direction.y}
            textAnchor="middle"
            fill={colors.moonsilver}
            fontSize="17"
          >
            {direction.name}
          </text>
        ))}
        {visible.map(({ object, point, position }) => {
          const radius = Math.max(2.5, Math.min(6, 4.5 - object.magnitude * 0.5));
          const isSelected = object.id === selectedId;
          const label = `${object.name}, ${Math.round(point.altDeg)}° up, ${compass[Math.round((((point.azDeg % 360) + 360) % 360) / 45) % 8]}`;
          const labelPlacement = labelPlacements.get(object.id);
          return (
            <g
              key={object.id}
              transform={`translate(${position.x} ${position.y})`}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={isSelected}
              className="cyno-sky-object"
              onClick={() => onSelect(object.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(object.id);
                }
              }}
            >
              <circle r="13" fill="transparent" />
              <circle className="cyno-sky-focus" r="11" fill="none" stroke={colors.signal} strokeWidth="2" />
              {isSelected && <circle r="10" fill="none" stroke={colors.signal} strokeWidth="1.5" />}
              {object.kind === "moon" ? (
                <g transform={waning ? "scale(-1 1)" : undefined}>
                  <circle r="7" fill={colors.abyss} stroke={colors.moonsilver} strokeWidth="0.7" />
                  <path
                    d={`M0,-7 A7,7 0 0,1 0,7 A${terminator},7 0 0,${illumination > 0.5 ? 1 : 0} 0,-7Z`}
                    fill={colors.moonsilver}
                  />
                </g>
              ) : (
                <circle r={radius} fill={kindColors[object.kind]} />
              )}
              {labelPlacement && (
                <text
                  x={labelPlacement.x - position.x}
                  y={labelPlacement.y - position.y}
                  textAnchor={labelPlacement.textAnchor}
                  fontSize={LABEL_FONT_SIZE}
                  fill={colors.starlight}
                  style={{
                    fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
                    pointerEvents: "none",
                  }}
                >
                  {object.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p id={`${id}-summary`} className="cyno-sky-sr">
        {visible.length} objects above the horizon.{" "}
        {visible
          .map(({ object, point }) => `${object.name}, ${Math.round(point.altDeg)} degrees up`)
          .join("; ")}
        . North is up, east is left. Use Tab to focus an object and Enter or Space to select it.
      </p>
      <figcaption
        style={{
          textAlign: "center",
          fontSize: 13,
          color: colors.moonsilver,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <time dateTime={time}>{clock(plan.input.timeZone).format(new Date(time))}</time>{" "}
        {zoneLabel(plan.input.timeZone)}
        {visible.length === 0 && (
          <span style={{ display: "block", marginTop: 8 }}>
            No planned objects above the horizon at this time. Try another time or date.
          </span>
        )}
      </figcaption>
    </figure>
  );
}
