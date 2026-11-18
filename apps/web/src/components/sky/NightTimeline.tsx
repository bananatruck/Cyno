import { useId, useMemo } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { Darkness, NightPlan } from "@cyno/engine";
import { clock, colors, nearest, trackPath, zoneLabel } from "./chart-utils";
import "./sky.css";

export interface NightTimelineProps {
  plan: NightPlan;
  time: string;
  onTimeChange: (iso: string) => void;
  selectedId: string | null;
  className?: string;
  /** Rendered height of the strip in pixels, including the hour labels. */
  height?: number;
}

const skyColors = {
  day: `var(--sky-day, ${colors.horizon})`,
  "civil-twilight": `var(--sky-civil, ${colors.civil})`,
  "nautical-twilight": `var(--sky-nautical, ${colors.nautical})`,
  "astronomical-twilight": `var(--sky-astro, ${colors.abyss})`,
  night: `var(--sky-night, ${colors.abyss})`,
} satisfies Record<Darkness, string>;
const HOUR = 3_600_000;
const WIDTH = 800;
const TOP = 12;
const BOTTOM = 116;
const VIEW_HEIGHT = 148;
const LABEL_TOP = 130;

export function NightTimeline({
  plan,
  time,
  onTimeChange,
  selectedId,
  className,
  height = VIEW_HEIGHT,
}: NightTimelineProps) {
  const id = useId();
  const windowStart = Date.parse(plan.window.start);
  const windowEnd = Date.parse(plan.window.end);
  const sunset = plan.events.find(
    (event) =>
      event.kind === "sunset" && Date.parse(event.time) >= windowStart && Date.parse(event.time) <= windowEnd,
  );
  const sunrise = plan.events.find(
    (event) =>
      event.kind === "sunrise" &&
      Date.parse(event.time) > Date.parse(sunset?.time ?? plan.window.start) &&
      Date.parse(event.time) <= windowEnd,
  );
  const start = sunset && sunrise ? Date.parse(sunset.time) : windowStart;
  const end = sunset && sunrise ? Date.parse(sunrise.time) : windowEnd;
  const duration = end - start;
  const samples = plan.timeline.filter(
    (sample) => Date.parse(sample.time) >= start && Date.parse(sample.time) <= end,
  );
  const first = samples[0];
  const last = samples.at(-1);
  const x = (instant: number) => ((instant - start) / duration) * WIDTH;
  const altitudeY = (alt: number) => BOTTOM - (Math.max(0, Math.min(90, alt)) / 90) * (BOTTOM - TOP);
  const selected = plan.objects.find((object) => object.id === selectedId);
  const current = nearest(samples, Date.parse(time));
  const currentTime = current ? Date.parse(current.time) : start;
  const scrubberX = Math.max(0, Math.min(WIDTH, x(Date.parse(time))));
  const formatter = clock(plan.input.timeZone);
  const hours = clock(plan.input.timeZone, true);
  const timeZoneLabel = zoneLabel(plan.input.timeZone);
  const ticks = useMemo(() => {
    const result: number[] = [];
    // Find local hour boundaries, including zones with half-hour and quarter-hour offsets.
    const minuteFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: plan.input.timeZone,
      minute: "2-digit",
    });
    for (let instant = Math.ceil(start / 60_000) * 60_000; instant <= end; instant += 60_000) {
      if (Number(minuteFormatter.format(new Date(instant))) === 0) result.push(instant);
    }
    return result;
  }, [start, end, plan.input.timeZone]);
  const choose = (instant: number) => {
    const sample = nearest(samples, instant);
    if (sample) onTimeChange(sample.time);
  };
  const chooseFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width > 0)
      choose(start + Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * duration);
  };
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = current ? samples.indexOf(current) : 0;
    let target: number;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        target = Date.parse(samples[Math.max(0, index - 1)]?.time ?? plan.window.start);
        break;
      case "ArrowRight":
      case "ArrowUp":
        target = Date.parse(samples[Math.min(samples.length - 1, index + 1)]?.time ?? plan.window.end);
        break;
      case "PageUp":
        target = currentTime + HOUR;
        break;
      case "PageDown":
        target = currentTime - HOUR;
        break;
      case "Home":
        target = Date.parse(first?.time ?? plan.window.start);
        break;
      case "End":
        target = Date.parse(last?.time ?? plan.window.end);
        break;
      default:
        return;
    }
    event.preventDefault();
    choose(target);
  };
  // Keep samples just outside the strip for accurate interpolation at its boundaries.
  const moonPath = plan.timeline
    .map(
      (sample, index) =>
        `${index === 0 ? "M" : "L"}${x(Date.parse(sample.time)).toFixed(2)},${altitudeY(sample.moonAltDeg).toFixed(2)}`,
    )
    .join(" ");
  const darkStart = plan.darkWindow ? Math.max(start, Date.parse(plan.darkWindow.start)) : end;
  const darkEnd = plan.darkWindow ? Math.min(end, Date.parse(plan.darkWindow.end)) : start;
  const stops = plan.timeline.filter((sample, index, all) => {
    const instant = Date.parse(sample.time);
    const previous = all[index - 1];
    const next = all[index + 1];
    return (
      (instant >= start && instant <= end) ||
      (instant < start && next !== undefined && Date.parse(next.time) >= start) ||
      (instant > end && previous !== undefined && Date.parse(previous.time) <= end)
    );
  });

  return (
    <figure className={`cyno-sky ${className ?? ""}`} style={{ margin: 0, color: colors.moonsilver }}>
      <div
        className="cyno-night-slider"
        role="slider"
        tabIndex={0}
        aria-label="Time of night"
        aria-orientation="horizontal"
        aria-valuemin={Date.parse(first?.time ?? plan.window.start)}
        aria-valuemax={Date.parse(last?.time ?? plan.window.end)}
        aria-valuenow={currentTime}
        aria-valuetext={`${formatter.format(new Date(currentTime))} ${timeZoneLabel}`}
        aria-describedby={`${id}-help`}
        onKeyDown={handleKey}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          chooseFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) chooseFromPointer(event);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            chooseFromPointer(event);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        style={{ position: "relative", touchAction: "none", cursor: "ew-resize", borderRadius: 8 }}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${VIEW_HEIGHT}`}
          width="100%"
          height={height}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id={`${id}-sky`} x1="0" x2="1" y1="0" y2="0">
              {stops.map((sample) => (
                <stop
                  key={sample.time}
                  offset={Math.max(0, Math.min(1, (Date.parse(sample.time) - start) / duration))}
                  stopColor={skyColors[sample.darkness]}
                />
              ))}
            </linearGradient>
            <clipPath id={`${id}-clip`}>
              <rect y={TOP} width={WIDTH} height={BOTTOM - TOP} rx="7" />
            </clipPath>
          </defs>
          <rect
            y={TOP}
            width={WIDTH}
            height={BOTTOM - TOP}
            rx="7"
            fill={`url(#${id}-sky)`}
            stroke={colors.moonsilver}
            strokeOpacity="0.3"
          />
          <g clipPath={`url(#${id}-clip)`}>
            {samples.map((sample) =>
              sample.cloudPercent === null ? null : (
                <rect
                  key={sample.time}
                  x={x(Date.parse(sample.time)) - 2}
                  y={TOP}
                  width="4"
                  height={(sample.cloudPercent / 100) * 28}
                  fill={colors.moonsilver}
                  opacity="0.25"
                />
              ),
            )}
            <path
              d={moonPath}
              fill="none"
              stroke={colors.moonsilver}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            {selected && (
              <path
                d={trackPath(selected.track, (point) =>
                  point.altDeg < 0 ? null : { x: x(Date.parse(point.time)), y: altitudeY(point.altDeg) },
                )}
                fill="none"
                stroke={colors.signal}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {selected && (
              <path
                d={`M${x(Date.parse(selected.best.time))},${TOP}v14`}
                stroke={colors.horizon}
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {ticks.map((tick) => (
              <path
                key={tick}
                d={`M${x(tick)},${BOTTOM - 5}v5`}
                stroke={colors.moonsilver}
                strokeOpacity="0.65"
              />
            ))}
          </g>
          {darkStart < darkEnd && (
            <path
              d={`M${x(darkStart)},124v5H${x(darkEnd)}v-5`}
              fill="none"
              stroke={colors.moonsilver}
              strokeOpacity="0.6"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={`M${scrubberX},${TOP}V${BOTTOM}`}
            stroke={colors.starlight}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          <path d={`M${scrubberX - 5},3h10v8l-5,5 -5,-5Z`} fill={colors.horizon} />
        </svg>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: `${(height * LABEL_TOP) / VIEW_HEIGHT}px 0 auto`,
            height: 18,
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
            pointerEvents: "none",
          }}
        >
          {ticks.map((tick) => (
            <span
              className="cyno-hour-label"
              key={tick}
              style={{
                position: "absolute",
                left: `${(x(tick) / WIDTH) * 100}%`,
                transform:
                  x(tick) < 12 ? undefined : x(tick) > WIDTH - 12 ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {hours.format(new Date(tick))}
            </span>
          ))}
        </div>
      </div>
      <figcaption style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 8, fontSize: 13 }}>
        <span>Moon altitude</span>
        {selected && <span style={{ color: colors.signal }}>{selected.name} altitude</span>}
        {selected && (
          <span style={{ color: colors.horizon }}>Best {formatter.format(new Date(selected.best.time))}</span>
        )}
        <span>
          {plan.darkWindow
            ? `Darkest sky ${formatter.format(new Date(plan.darkWindow.start))} to ${formatter.format(new Date(plan.darkWindow.end))}`
            : "No dark window tonight"}
        </span>
        <span>{timeZoneLabel}</span>
      </figcaption>
      <p className="cyno-sky-sr" id={`${id}-help`}>
        Drag to choose a time. Left, Down, Right, and Up move one sample; Page Up and Page Down move one hour;
        Home and End move to the first and last sample. Silver shows Moon altitude, the selection curve shows
        object altitude, amber marks its best time, the bracket marks the darkest sky, and top bars show known
        cloud cover.
      </p>
    </figure>
  );
}
