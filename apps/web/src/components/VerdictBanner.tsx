import type { NightPlan, VerdictLabel } from "@cyno/engine";
import { describeConditionDirection, formatTimeHHMM } from "@/lib/format";
import type { WeatherStatus } from "@/lib/weather";
import { BlurText } from "./ui/blur-text";
import { NumberTicker } from "./ui/number-ticker";

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
  const moonLitPercent = Math.round(plan.moon.illumination * 100);
  const darkWindowSummary = plan.darkWindow
    ? `Dark ${formatTimeHHMM(plan.darkWindow.start, plan.input.timeZone)} to ${formatTimeHHMM(plan.darkWindow.end, plan.input.timeZone)}`
    : "No dark sky tonight";
  const topReasons = plan.verdict.reasons.slice(0, 2);
  const conditionDirection = describeConditionDirection(plan.condition);
  const showNoGoAdvice = plan.verdict.label === "no-go" && plan.condition === "normal";

  return (
    <section aria-label="Tonight's verdict" className="mb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="m-0 flex items-baseline gap-2 font-display text-[34px] leading-none font-normal tracking-tight text-starlight md:text-[44px]">
            <BlurText text={verdictWord} animateBy="letters" delay={35} />
            <NumberTicker
              value={roundedScore}
              className="font-display text-[34px] font-normal tracking-tight text-starlight md:text-[44px]"
            />
          </h1>
          <p className="m-0 text-[15px] tabular-nums text-moonsilver">
            <span>{darkWindowSummary}</span>
            <span>, </span>
            <span>
              {plan.moon.phaseName} ({moonLitPercent}% lit)
            </span>
          </p>
        </div>

        <div className="text-[13px] text-moonsilver">
          <span className="font-display text-[18px] text-starlight">{placeName}</span>
          <span> · </span>
          <span className="tabular-nums">{plan.input.timeZone}</span>
        </div>
      </div>

      {topReasons.length > 0 && (
        <p className="mt-1 mb-0 text-[13px] text-moonsilver">
          {topReasons.join(" ")}
          {weatherStatus === "offline" && " No cloud forecast (offline). Ranking ignores clouds."}
          {weatherStatus === "out-of-range" &&
            " No cloud forecast for this date (Open-Meteo covers the next 16 days). Ranking ignores clouds."}
          {weatherStatus === "unavailable" &&
            " No cloud forecast available right now. Ranking ignores clouds."}
        </p>
      )}

      {conditionDirection && (
        <div
          role="region"
          aria-label="Sky condition note"
          className="mt-2 rounded-xl border border-horizon/40 bg-nautical/50 px-3 py-2 text-[14px] text-starlight"
        >
          <p className="m-0 font-medium text-starlight">{conditionDirection.title}</p>
          <p className="mt-0.5 mb-0 text-[13px] text-moonsilver">
            {plan.verdict.reasons.join(" ")} {conditionDirection.suggestion}
          </p>
        </div>
      )}

      {showNoGoAdvice && (
        <div
          role="region"
          aria-label="No-go condition note"
          className="mt-2 rounded-xl border border-horizon/40 bg-nautical/50 px-3 py-2 text-[14px] text-starlight"
        >
          <p className="m-0 font-medium text-starlight">
            Challenging conditions tonight ({plan.condition} night).
          </p>
          <p className="mt-0.5 mb-0 text-[13px] text-moonsilver">
            {plan.verdict.reasons.join(" ")} Try another date with less moonlight or clearer skies, or switch
            equipment to binoculars or a telescope for brighter targets.
          </p>
        </div>
      )}
    </section>
  );
}
