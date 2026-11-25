import { useId, useMemo, useState } from "react";
import { ChevronDown, Search, Sparkles } from "lucide-react";
import type { NightPlan, ObjectKind, RankedObject } from "@cyno/engine";
import { formatObjectKind, formatSignedPoints, formatTimeHHMM } from "@/lib/format";
import { BorderBeam } from "./ui/border-beam";
import { NumberTicker } from "./ui/number-ticker";
import { SpotlightCard } from "./ui/spotlight-card";
import { VERDICT_ANCHOR_ID } from "./VerdictBanner";
import { cn } from "@/lib/utils";

export type ObjectFilterCategory = "all" | "solar-system" | "stars" | "deep-sky";

export function categorizeKind(kind: ObjectKind): Exclude<ObjectFilterCategory, "all"> {
  if (kind === "moon" || kind === "planet") return "solar-system";
  if (kind === "star" || kind === "double-star") return "stars";
  return "deep-sky";
}

const INITIAL_SHOWN = 10;
const NEVER_DARK_REASON = "The sky never gets dark here tonight.";
const CLOUDS_REASON = "Clouds block every otherwise visible moment.";

function skyNeverGetsDark(plan: NightPlan): boolean {
  if (plan.condition === "polar-day" || plan.condition === "white-night") return true;
  return (
    plan.objects.length === 0 &&
    plan.hidden.length > 0 &&
    plan.hidden.every((item) => item.reason === NEVER_DARK_REASON)
  );
}

/** With nothing visible, any cloud-blocked object means the clouds, not the sky or equipment, emptied the list. */
function cloudsHideEverything(plan: NightPlan): boolean {
  return plan.objects.length === 0 && plan.hidden.some((item) => item.reason === CLOUDS_REASON);
}

/**
 * visibleFrom and visibleTo are the first and last visible samples, so a gap inside them only shows up as
 * fewer accumulated hours than the span. A gap of a single sample is indistinguishable from sampling.
 */
function describeVisibleWindow(object: RankedObject, plan: NightPlan): string {
  const zone = plan.input.timeZone;
  const from = formatTimeHHMM(object.visibleFrom, zone);
  const to = formatTimeHHMM(object.visibleTo, zone);
  const spanHours = (Date.parse(object.visibleTo) - Date.parse(object.visibleFrom)) / 3_600_000;
  const stepHours = plan.input.stepMinutes / 60;
  if (spanHours - object.hoursVisible <= stepHours / 2) return `Visible ${from} to ${to}`;
  return `Visible for ${object.hoursVisible.toFixed(1)} hours between ${from} and ${to}`;
}

/** Null when the kind would only repeat the name, as for the Moon. */
function kindLabel(name: string, kind: ObjectKind): string | null {
  const label = formatObjectKind(kind);
  return label.toLowerCase() === name.trim().toLowerCase() ? null : label;
}

export interface RankedListProps {
  plan: NightPlan;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function RankedList({ plan, selectedId, onSelect }: RankedListProps) {
  const idPrefix = useId();
  const reasoningId = (objectId: string) => `${idPrefix}reasoning-${objectId.replace(/[^\w-]/g, "-")}`;
  const [filter, setFilter] = useState<ObjectFilterCategory>("all");
  const [hiddenSearch, setHiddenSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [filteredSelectionId, setFilteredSelectionId] = useState(selectedId);

  const showInFilter = (object: RankedObject | undefined) => {
    if (object && filter !== "all" && categorizeKind(object.kind) !== filter) setFilter("all");
  };

  if (selectedId !== filteredSelectionId) {
    setFilteredSelectionId(selectedId);
    showInFilter(plan.objects.find((obj) => obj.id === selectedId));
  }

  // Selecting the already selected object keeps selectedId, so its activation must reveal it here.
  const activate = (object: RankedObject) => {
    showInFilter(object);
    onSelect(object.id);
  };

  const counts = useMemo(() => {
    const result = {
      all: plan.objects.length,
      "solar-system": 0,
      stars: 0,
      "deep-sky": 0,
    };
    for (const obj of plan.objects) {
      result[categorizeKind(obj.kind)] += 1;
    }
    return result;
  }, [plan.objects]);

  const highlights = useMemo(() => {
    const bestSolar = plan.objects.find((o) => categorizeKind(o.kind) === "solar-system");
    const bestDeepSky = plan.objects.find((o) => categorizeKind(o.kind) === "deep-sky");
    const bestStar = plan.objects.find((o) => categorizeKind(o.kind) === "stars");

    const items: { groupLabel: string; object: RankedObject }[] = [];
    if (bestSolar) items.push({ groupLabel: "Moon or planet", object: bestSolar });
    if (bestDeepSky) items.push({ groupLabel: "Deep-sky object", object: bestDeepSky });
    if (bestStar) items.push({ groupLabel: "Star", object: bestStar });
    return items;
  }, [plan.objects]);

  const filteredObjects = useMemo(() => {
    if (filter === "all") return plan.objects;
    return plan.objects.filter((obj) => categorizeKind(obj.kind) === filter);
  }, [plan.objects, filter]);

  const selectedIndex = filteredObjects.findIndex((obj) => obj.id === selectedId);
  const shownCount = showAll ? filteredObjects.length : Math.max(INITIAL_SHOWN, selectedIndex + 1);
  const shownObjects = filteredObjects.slice(0, shownCount);
  const moreCount = filteredObjects.length - shownObjects.length;

  const filteredHidden = useMemo(() => {
    const q = hiddenSearch.trim().toLowerCase();
    if (!q) return plan.hidden;
    return plan.hidden.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        formatObjectKind(item.kind).toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q),
    );
  }, [plan.hidden, hiddenSearch]);

  const filterChips: { key: ObjectFilterCategory; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "solar-system", label: "Moon and planets", count: counts["solar-system"] },
    { key: "stars", label: "Stars", count: counts.stars },
    { key: "deep-sky", label: "Deep sky", count: counts["deep-sky"] },
  ];

  return (
    <section aria-label="Ranked observable objects" className="flex flex-col gap-2 lg:h-full lg:min-h-0">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="m-0 font-display text-[22px] leading-tight font-normal text-starlight">
            Tonight&apos;s ranked targets
          </h2>
          <span className="text-[13px] tabular-nums text-moonsilver">{plan.objects.length} visible</span>
        </div>
        <p className="mt-0.5 mb-0 text-[12px] leading-snug text-moonsilver">
          Visibility score (0 to 100) combines altitude, brightness margin, moonlight, viewing duration, sky
          darkness, and cloud cover.
        </p>
      </div>

      {highlights.length > 0 && (
        <div
          role="group"
          aria-label="Tonight's highlights"
          className="rounded-xl border border-moonsilver/20 bg-nautical/40 px-2.5 py-2"
        >
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-moonsilver">
            <Sparkles className="h-3 w-3 text-horizon" aria-hidden="true" />
            <span>Tonight&apos;s highlights</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {highlights.map(({ groupLabel, object }) => {
              const isSelected = object.id === selectedId;
              return (
                <button
                  key={groupLabel}
                  type="button"
                  onClick={() => activate(object)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex cursor-pointer flex-col items-start rounded-lg border px-2 py-1 text-left transition-colors",
                    isSelected
                      ? "border-signal/70 bg-civil/45 text-starlight"
                      : "border-moonsilver/15 bg-abyss/45 text-starlight hover:border-signal/45",
                  )}
                >
                  <span className="truncate text-[11px] text-moonsilver">{groupLabel}</span>
                  <span className="truncate font-display text-[16px] leading-tight text-starlight">
                    {object.name}
                  </span>
                  <span className="text-[11px] tabular-nums text-horizon">
                    Best at {formatTimeHHMM(object.best.time, plan.input.timeZone)}, score{" "}
                    {Math.round(object.score)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        role="group"
        aria-label="Filter objects by category"
        className="flex flex-wrap items-center gap-1.5"
      >
        {filterChips.map((chip) => {
          const active = filter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(chip.key)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] transition-colors",
                active
                  ? "border-signal/70 bg-civil/55 font-medium text-starlight"
                  : "border-moonsilver/20 bg-nautical/45 text-moonsilver hover:border-signal/40 hover:text-starlight",
              )}
            >
              <span>{chip.label}</span>
              <span className="tabular-nums">({chip.count})</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 lg:-mr-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2 [&_:focus-visible]:-outline-offset-2">
        {filteredObjects.length === 0 ? (
          <div className="rounded-xl border border-moonsilver/20 bg-nautical/35 p-3.5 text-[14px] text-moonsilver">
            {plan.objects.length === 0 && skyNeverGetsDark(plan) ? (
              <p className="m-0">
                The sky never gets dark enough tonight for catalog objects to stand out. See the{" "}
                <a
                  href={`#${VERDICT_ANCHOR_ID}`}
                  className="text-signal underline underline-offset-2 hover:text-starlight"
                >
                  verdict explanation
                </a>{" "}
                for why, and which dates or places would work.
              </p>
            ) : cloudsHideEverything(plan) ? (
              <p className="m-0">
                The forecast clouds hide everything tonight: every object that would otherwise be visible is
                behind cloud. Check the forecast again closer to the night, or pick another date.
              </p>
            ) : plan.objects.length === 0 ? (
              <p className="m-0">
                No catalog objects pass the visibility threshold tonight. Try switching to a darker sky
                preset, choosing binoculars or a telescope, or picking another date.
              </p>
            ) : (
              <p className="m-0">
                No objects in this category tonight. Switch the filter above to see the other{" "}
                {plan.objects.length} visible objects.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {shownObjects.map((object) => {
              const isSelected = object.id === selectedId;
              const kind = kindLabel(object.name, object.kind);
              const visibleWindow = describeVisibleWindow(object, plan);
              const moonSepText =
                object.moonSeparationDeg === null
                  ? "The Moon itself"
                  : `${Math.round(object.moonSeparationDeg)}° from the Moon`;

              return (
                <SpotlightCard
                  key={object.id}
                  className={cn(
                    "transition-colors",
                    isSelected
                      ? "border-signal/75 bg-nautical/75"
                      : "border-moonsilver/20 bg-nautical/40 hover:border-moonsilver/40",
                  )}
                >
                  {isSelected && <BorderBeam size={80} duration={8} />}
                  <button
                    type="button"
                    aria-expanded={isSelected}
                    aria-controls={isSelected ? reasoningId(object.id) : undefined}
                    onClick={() => activate(object)}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-left"
                  >
                    <div className="flex min-w-0 flex-col">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="w-5 text-[14px] tabular-nums text-moonsilver">{object.rank}</span>
                        <span className="font-display text-[20px] leading-none text-starlight">
                          {object.name}
                        </span>
                        {kind && <span className="text-[12px] text-moonsilver">{kind}</span>}
                      </div>
                      <p className="m-0 mt-0.5 pl-7 text-[12px] leading-snug text-moonsilver">
                        {object.summary}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end">
                      <NumberTicker
                        value={Math.round(object.score)}
                        className="font-sans text-[20px] leading-none font-medium tabular-nums text-starlight"
                      />
                      <span className="mt-0.5 text-[11px] text-moonsilver">visibility score</span>
                    </div>
                  </button>

                  {isSelected && (
                    <div
                      id={reasoningId(object.id)}
                      role="region"
                      aria-label={`${object.name} visibility reasoning`}
                      className="border-t border-moonsilver/20 px-3 pt-1.5 pb-2 text-[12px]"
                    >
                      <div className="mb-1.5 flex flex-col tabular-nums text-moonsilver">
                        <p className="m-0">{visibleWindow}</p>
                        <p className="m-0">{moonSepText}</p>
                      </div>

                      <dl className="m-0 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {object.factors.map((factor) => (
                          <div
                            key={factor.key}
                            className="rounded-lg border border-moonsilver/15 bg-abyss/45 px-2 py-1"
                          >
                            <div className="flex items-baseline justify-between gap-1.5">
                              <dt className="font-medium text-starlight">{factor.label}</dt>
                              <dd className="m-0 font-medium tabular-nums text-signal">
                                {formatSignedPoints(factor.points)}
                              </dd>
                            </div>
                            <div className="text-[11px] leading-tight tabular-nums text-moonsilver">
                              {factor.value}
                            </div>
                            <div className="text-[11px] leading-tight text-moonsilver">{factor.detail}</div>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </SpotlightCard>
              );
            })}
            {moreCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="cursor-pointer rounded-xl border border-moonsilver/20 bg-nautical/35 px-3 py-1.5 text-[13px] font-medium text-moonsilver transition-colors hover:border-signal/45 hover:text-starlight"
              >
                Show {moreCount} more {moreCount === 1 ? "object" : "objects"}
              </button>
            )}
          </div>
        )}

        <details className="group rounded-xl border border-moonsilver/20 bg-nautical/35">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-1.5 text-[13px] font-medium text-moonsilver hover:text-starlight">
            <span>Not visible tonight ({plan.hidden.length})</span>
            <ChevronDown
              className="h-3.5 w-3.5 text-moonsilver transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="border-t border-moonsilver/15 px-3 py-2.5">
            <div className="relative mb-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-moonsilver"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search not visible objects"
                placeholder="Search not visible objects..."
                value={hiddenSearch}
                onChange={(e) => setHiddenSearch(e.target.value)}
                className="w-full rounded-full border border-moonsilver/25 bg-abyss/65 py-1 pr-3 pl-8 text-[13px] text-starlight placeholder:text-moonsilver"
              />
            </div>

            {/* Always present, so a change to its text is announced: the result of a search, while the
                list stays outside it. The match count is for screen readers; no matches is shown too. */}
            <p
              role="status"
              aria-label="Not visible search results"
              className="m-0 text-[13px] text-moonsilver"
            >
              {hiddenSearch.trim() === "" ? null : filteredHidden.length === 0 ? (
                <>No hidden objects match &ldquo;{hiddenSearch}&rdquo;.</>
              ) : (
                <span className="sr-only">
                  {filteredHidden.length} hidden{" "}
                  {filteredHidden.length === 1 ? "object matches" : "objects match"} &ldquo;{hiddenSearch}
                  &rdquo;.
                </span>
              )}
            </p>
            {filteredHidden.length === 0 ? null : (
              <ul
                aria-label="Objects not visible tonight"
                className="m-0 flex list-none flex-col gap-1.5 p-0 text-[12px]"
              >
                {filteredHidden.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col justify-between gap-0.5 rounded-lg border border-moonsilver/10 bg-abyss/40 px-2.5 py-1.5 sm:flex-row sm:items-baseline sm:gap-3"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-[15px] text-starlight">{item.name}</span>
                      {kindLabel(item.name, item.kind) && (
                        <span className="text-[11px] text-moonsilver">{kindLabel(item.name, item.kind)}</span>
                      )}
                    </div>
                    <span className="text-moonsilver">{item.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}
