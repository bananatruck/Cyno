import { useId } from "react";
import type { NightPlan, ObjectKind } from "@cyno/engine";
import { clock, colors, nearest, trackPath } from "./chart-utils";
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

export function SkyChart({ plan, time, selectedId, onSelect, className }: SkyChartProps) {
  const id = useId();
  const visible = plan.objects.flatMap((object) => {
    const point = nearest(object.track, Date.parse(time));
    const position = point && project(point.altDeg, point.azDeg, 200);
    return point && position ? [{ object, point, position }] : [];
  });
  const selected = plan.objects.find((object) => object.id === selectedId);
  const labelled = new Set(
    [...plan.objects]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 8)
      .map((object) => object.id),
  );
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
        style={{ display: "block", overflow: "visible" }}
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
            <text x="5" y={(-200 * (90 - alt)) / 90 + 14} fontSize="10" opacity="0.75">
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
            fontSize="15"
          >
            {direction.name}
          </text>
        ))}
        {visible.map(({ object, point, position }) => {
          const radius = Math.max(2.5, Math.min(6, 4.5 - object.magnitude * 0.5));
          const isSelected = object.id === selectedId;
          const label = `${object.name}, ${Math.round(point.altDeg)}° up, ${compass[Math.round((((point.azDeg % 360) + 360) % 360) / 45) % 8]}`;
          const leftLabel = position.x > 120;
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
              {(labelled.has(object.id) || isSelected) && (
                <text
                  x={leftLabel ? -12 : 12}
                  y="-9"
                  textAnchor={leftLabel ? "end" : "start"}
                  fontSize="13"
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
        <time dateTime={time}>{clock(plan.input.timeZone).format(new Date(time))}</time> ·{" "}
        {plan.input.timeZone}
        {visible.length === 0 && (
          <span style={{ display: "block", marginTop: 8 }}>
            No planned objects above the horizon at this time. Try another time or date.
          </span>
        )}
      </figcaption>
    </figure>
  );
}
