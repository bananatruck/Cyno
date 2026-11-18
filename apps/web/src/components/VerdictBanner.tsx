import type { NightPlan, VerdictLabel } from "@cyno/engine";
import { zoneLabel } from "@/components/sky";
import {
  describeConditionDirection,
  describeWeatherStatus,
  formatDarkAndMoonSummary,
  reasonsBesideDarkAndMoon,
} from "@/lib/format";
import type { WeatherStatus } from "@/lib/weather";
import { BlurText } from "./ui/blur-text";
import { NumberTicker } from "./ui/number-ticker";

export const VERDICT_ANCHOR_ID = "tonights-verdict";

export interface VerdictBannerProps {
  plan: NightPlan;
  placeName: string;
  weatherStatus?: WeatherStatus | "loading";
}

function formatVerdictWord(label: VerdictLabel): string {
  switch (label) {
    case "go":
      return "Go";
    case "marginal":
      return "Marginal";
    case "no-go":
      return "No-go";
  }
}

export function VerdictBanner({ plan, placeName, weatherStatus = "ok" }: VerdictBannerProps) {
  const verdictWord = formatVerdictWord(plan.verdict.label);
  const roundedScore = Math.round(plan.verdict.score);
  const isNoGo = plan.verdict.label === "no-go";
  const summary = isNoGo ? null : formatDarkAndMoonSummary(plan);
  const otherReasons = isNoGo ? [] : reasonsBesideDarkAndMoon(plan.verdict.reasons);
  const conditionDirection = describeConditionDirection(plan.condition);
  const allReasons = plan.verdict.reasons.join(" ");

  return (
    <section id={VERDICT_ANCHOR_ID} aria-label="Tonight's verdict" className="mb-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="m-0 flex items-baseline gap-2 font-display text-[34px] leading-none font-normal tracking-tight text-starlight md:text-[44px]">
          <BlurText text={verdictWord} animateBy="letters" delay={35} />
          <NumberTicker
            value={roundedScore}
            className="font-display text-[34px] font-normal tracking-tight text-starlight md:text-[44px]"
          />
        </h1>
        <p className="m-0 text-[13px] text-moonsilver">
          <span className="font-display text-[18px] text-starlight">{placeName}</span>,{" "}
          {zoneLabel(plan.input.timeZone)}
        </p>
      </div>

      {summary && <p className="mt-1.5 mb-0 text-[15px] tabular-nums text-starlight">{summary}</p>}

      <p className="mt-0.5 mb-0 text-[13px] text-moonsilver">
        {otherReasons.length > 0 && <span>{otherReasons.join(" ")} </span>}
        <span role="status" aria-label="Cloud forecast">
          {describeWeatherStatus(weatherStatus)}
        </span>
      </p>

      {isNoGo && (
        <div
          data-verdict-note
          role="region"
          aria-label={conditionDirection ? "Sky condition note" : "No-go condition note"}
          className="mt-2 rounded-xl border border-horizon/40 bg-nautical/50 px-3 py-2 text-[14px] text-starlight"
        >
          <p className="m-0 font-medium text-starlight">
            {conditionDirection ? conditionDirection.title : "Challenging conditions tonight."}
          </p>
          <p className="mt-0.5 mb-0 text-[13px] text-moonsilver">
            {allReasons}{" "}
            {conditionDirection
              ? conditionDirection.suggestion
              : "Try another date with less moonlight or clearer skies, or switch equipment to binoculars or a telescope for brighter targets."}
          </p>
        </div>
      )}

      {!isNoGo && conditionDirection && (
        <div
          data-verdict-note
          role="region"
          aria-label="Sky condition note"
          className="mt-2 rounded-xl border border-horizon/40 bg-nautical/50 px-3 py-2 text-[14px] text-starlight"
        >
          <p className="m-0 font-medium text-starlight">{conditionDirection.title}</p>
          <p className="mt-0.5 mb-0 text-[13px] text-moonsilver">{conditionDirection.suggestion}</p>
        </div>
      )}
    </section>
  );
}
