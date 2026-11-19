import { useEffect, useMemo, useState } from "react";
import type { Equipment, NightPlan, SkyQuality } from "@cyno/engine";
import { NightTimeline, SkyChart } from "@/components/sky";
import { ControlsBar } from "@/components/ControlsBar";
import { RankedList } from "@/components/RankedList";
import { VerdictBanner } from "@/components/VerdictBanner";
import { ShootingStars } from "@/components/ui/shooting-stars";
import { StarsBackground } from "@/components/ui/stars-background";
import type { PlacePreset } from "@/lib/places";
import { coordinatePlaceName, parseCoordinateText, readUrlState } from "@/lib/urlState";
import { usePlan } from "@/lib/usePlan";

const RED_MODE_STORAGE_KEY = "cyno:red-mode";
const WEATHER_STORAGE_KEY = "cyno:weather-enabled";
const TIMELINE_HEIGHT = 112;

function readInitialWeatherEnabled(): boolean {
  try {
    return window.localStorage.getItem(WEATHER_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

function readInitialRedMode(): boolean {
  try {
    return window.localStorage.getItem(RED_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function defaultSelectedTime(plan: NightPlan): string {
  const topObject = plan.objects[0];
  if (topObject) return topObject.best.time;
  if (plan.darkWindow) {
    const mid = (Date.parse(plan.darkWindow.start) + Date.parse(plan.darkWindow.end)) / 2;
    return new Date(mid).toISOString();
  }
  const mid = (Date.parse(plan.window.start) + Date.parse(plan.window.end)) / 2;
  return new Date(mid).toISOString();
}

export default function App() {
  const initial = useMemo(
    () => readUrlState(typeof window !== "undefined" ? window.location.search : ""),
    [],
  );
  const [latText, setLatText] = useState(initial.latText);
  const [lonText, setLonText] = useState(initial.lonText);
  const [date, setDate] = useState(initial.date);
  const [sky, setSky] = useState<SkyQuality>(initial.sky);
  const [equipment, setEquipment] = useState<Equipment>(initial.equipment);
  const [placeName, setPlaceName] = useState(initial.placeName);
  const [redMode, setRedMode] = useState<boolean>(() => readInitialRedMode());
  const [weatherEnabled, setWeatherEnabled] = useState(readInitialWeatherEnabled);

  useEffect(() => {
    try {
      window.localStorage.setItem(WEATHER_STORAGE_KEY, weatherEnabled ? "1" : "0");
    } catch {
      // The setting still applies to this page when storage is unavailable.
    }
  }, [weatherEnabled]);

  const [selection, setSelection] = useState<{
    planKey: string | null;
    objectId: string | null;
    time: string | null;
  }>({ planKey: null, objectId: null, time: null });

  useEffect(() => {
    if (redMode) {
      document.documentElement.setAttribute("data-mode", "red");
    } else {
      document.documentElement.removeAttribute("data-mode");
    }
    try {
      window.localStorage.setItem(RED_MODE_STORAGE_KEY, redMode ? "1" : "0");
    } catch {
      // Ignore storage errors in private browsing or restricted contexts.
    }
  }, [redMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    params.set("lat", latText);
    params.set("lon", lonText);
    params.set("date", date);
    params.set("sky", sky);
    params.set("eq", equipment);
    if (placeName) params.set("name", placeName);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
  }, [latText, lonText, date, sky, equipment, placeName]);

  const rawPlanInput = useMemo(
    () => ({
      latitude: parseCoordinateText(latText),
      longitude: parseCoordinateText(lonText),
      date,
      sky,
      equipment,
    }),
    [latText, lonText, date, sky, equipment],
  );

  const {
    plan: currentPlan,
    status,
    errors,
    isWorkerError,
    weatherStatus,
    stalePlan,
    retry,
  } = usePlan(rawPlanInput, placeName, weatherEnabled);
  const plan = currentPlan ?? stalePlan?.plan ?? null;

  const planIdentity = plan
    ? `${plan.input.latitude}:${plan.input.longitude}:${plan.input.date}:${plan.input.sky}:${plan.input.equipment}`
    : null;

  const selectedId = useMemo(() => {
    if (!plan || selection.planKey !== planIdentity || !selection.objectId) return null;
    return plan.objects.some((o) => o.id === selection.objectId) ? selection.objectId : null;
  }, [plan, planIdentity, selection]);

  const activeTime = useMemo(() => {
    if (!plan) return new Date().toISOString();
    if (selection.planKey === planIdentity && selection.time) {
      const ms = Date.parse(selection.time);
      const startMs = Date.parse(plan.window.start);
      const endMs = Date.parse(plan.window.end);
      if (Number.isFinite(ms) && ms >= startMs && ms <= endMs) {
        return selection.time;
      }
    }
    return defaultSelectedTime(plan);
  }, [plan, planIdentity, selection]);

  const handleSelectObject = (id: string) => {
    const found = plan?.objects.find((o) => o.id === id);
    setSelection((prev) => ({
      planKey: planIdentity,
      objectId: id,
      time: found ? found.best.time : prev.time,
    }));
  };

  const handleTimeChange = (iso: string) => {
    setSelection((prev) => ({
      planKey: planIdentity,
      objectId: prev.planKey === planIdentity ? prev.objectId : null,
      time: iso,
    }));
  };

  const handleSelectPreset = (preset: PlacePreset) => {
    setPlaceName(preset.name);
    setLatText(String(preset.latitude));
    setLonText(String(preset.longitude));
  };

  const updateCoordinates = (nextLatText: string, nextLonText: string) => {
    setLatText(nextLatText);
    setLonText(nextLonText);
    const latNum = parseCoordinateText(nextLatText);
    const lonNum = parseCoordinateText(nextLonText);
    if (Number.isFinite(latNum) && Number.isFinite(lonNum)) setPlaceName(coordinatePlaceName(latNum, lonNum));
  };

  const handleLatChange = (val: string) => updateCoordinates(val, lonText);
  const handleLonChange = (val: string) => updateCoordinates(latText, val);
  const handleUseGeoLocation = (lat: number, lon: number) => updateCoordinates(String(lat), String(lon));

  return (
    <div id="top" className="relative min-h-screen bg-abyss text-starlight">
      <StarsBackground />
      <ShootingStars />

      <ControlsBar
        placeName={placeName}
        latText={latText}
        lonText={lonText}
        date={date}
        sky={sky}
        equipment={equipment}
        redMode={redMode}
        onToggleRedMode={() => setRedMode((m) => !m)}
        onSelectPreset={handleSelectPreset}
        onLatChange={handleLatChange}
        onLonChange={handleLonChange}
        onDateChange={setDate}
        onSkyChange={setSky}
        onEquipmentChange={setEquipment}
        onUseGeoLocation={handleUseGeoLocation}
        errors={errors}
      />

      <main className="relative z-10 mx-auto max-w-[1400px] px-4 py-2.5 md:px-6">
        {status === "error" && isWorkerError && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-horizon/50 bg-nautical/65 p-5 backdrop-blur-md"
          >
            <h2 className="m-0 font-display text-[24px] font-normal text-starlight">
              Calculation interrupted
            </h2>
            <p className="mt-1.5 mb-3 text-[15px] text-moonsilver">
              {errors.map((e) => e.message).join(" ") ||
                "The astronomy worker stopped before finishing tonight's plan."}
            </p>
            <button
              type="button"
              onClick={retry}
              className="cursor-pointer rounded-full border border-signal/60 bg-civil/55 px-4 py-1.5 text-[13px] font-medium text-starlight transition-colors hover:bg-civil/80"
            >
              Retry calculation
            </button>
          </div>
        )}

        {status === "error" && !isWorkerError && errors.length > 0 && (
          <div
            role="status"
            className="mb-5 rounded-2xl border border-horizon/45 bg-nautical/55 p-5 backdrop-blur-md"
          >
            <h2 className="m-0 font-display text-[24px] font-normal text-starlight">
              Check the coordinates or date above
            </h2>
            <p className="mt-1 mb-0 text-[15px] text-moonsilver">
              {errors.map((e) => e.message).join(" ")} Correct the highlighted field in the controls bar to
              update the night plan.
            </p>
          </div>
        )}

        {!currentPlan && status === "computing" && stalePlan && (
          <p
            role="status"
            aria-label="Updating night plan"
            className="mb-2.5 rounded-xl border border-moonsilver/20 bg-nautical/50 px-3 py-1.5 text-[13px] text-moonsilver"
          >
            Computing the plan for {placeName}, {date}. Showing {stalePlan.label}, {stalePlan.plan.input.date}{" "}
            until it is ready.
          </p>
        )}

        {!plan && status === "computing" && (
          <div
            role="status"
            aria-label="Computing night plan"
            className="grid grid-cols-1 gap-5 lg:grid-cols-12"
          >
            <div className="h-[520px] animate-pulse rounded-2xl border border-moonsilver/15 bg-nautical/35 p-6 lg:col-span-7">
              <div className="h-10 w-44 rounded-lg bg-civil/35" />
              <div className="mt-3 h-4 w-72 rounded bg-civil/25" />
              <div className="mx-auto mt-10 h-80 w-80 rounded-full border border-moonsilver/15 bg-abyss/40" />
            </div>
            <div className="h-[520px] animate-pulse rounded-2xl border border-moonsilver/15 bg-nautical/35 p-6 lg:col-span-5">
              <div className="h-7 w-48 rounded bg-civil/35" />
              <div className="mt-4 space-y-3">
                <div className="h-16 rounded-xl bg-civil/25" />
                <div className="h-16 rounded-xl bg-civil/25" />
                <div className="h-16 rounded-xl bg-civil/25" />
              </div>
            </div>
          </div>
        )}

        {plan && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <section
              aria-label="Tonight's sky"
              className="order-1 rounded-2xl border border-moonsilver/20 bg-nautical/35 px-4 py-3 backdrop-blur-md lg:col-span-7 lg:[--chart-reserve:385px] lg:has-data-verdict-note:[--chart-reserve:475px]"
            >
              <VerdictBanner
                plan={plan}
                placeName={currentPlan ? placeName : (stalePlan?.label ?? placeName)}
                weatherStatus={currentPlan ? weatherStatus : (stalePlan?.weatherStatus ?? weatherStatus)}
              />
              {/* The floor keeps the chart usable in short windows; the page scrolls instead. */}
              <div className="mx-auto w-[max(min(100%,260px),min(100%,62vh,calc(100vh-var(--chart-reserve,0px))))]">
                <SkyChart
                  plan={plan}
                  time={activeTime}
                  selectedId={selectedId}
                  onSelect={handleSelectObject}
                  className="w-full"
                />
              </div>
            </section>

            <section
              aria-label="Night sky timeline"
              className="order-2 rounded-2xl border border-moonsilver/20 bg-nautical/35 px-4 py-2 backdrop-blur-md lg:order-3 lg:col-span-12"
            >
              <NightTimeline
                plan={plan}
                time={activeTime}
                onTimeChange={handleTimeChange}
                selectedId={selectedId}
                height={TIMELINE_HEIGHT}
              />
            </section>

            <div className="order-3 lg:relative lg:order-2 lg:col-span-5">
              <div className="rounded-2xl border border-moonsilver/20 bg-nautical/35 px-4 py-3 backdrop-blur-md lg:absolute lg:inset-0 lg:flex lg:flex-col">
                <RankedList plan={plan} selectedId={selectedId} onSelect={handleSelectObject} />
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="relative z-10 mx-auto max-w-[1400px] border-t border-moonsilver/15 px-4 py-4 text-[13px] text-moonsilver md:px-6">
        <label className="mb-1 flex cursor-pointer items-center gap-2 text-starlight">
          <input
            type="checkbox"
            checked={weatherEnabled}
            onChange={(event) => setWeatherEnabled(event.target.checked)}
            aria-describedby="weather-privacy-note"
          />
          Use Open-Meteo cloud forecast
        </label>
        <p id="weather-privacy-note" className="mt-0 mb-3">
          When enabled, your coordinates are sent to Open-Meteo. Turn this off to keep coordinates in your
          browser for planning. Without a forecast, cloud cover is unknown; rankings and the verdict ignore
          clouds. Positions, Moon information, sky chart and timeline still work.
        </p>
        <p className="m-0">
          Positions computed with astronomy-engine. Visibility is an estimate;{" "}
          <a
            href="https://github.com/bananatruck/Cyno#how-the-ranking-works"
            target="_blank"
            rel="noreferrer"
            className="text-signal underline underline-offset-2 hover:text-starlight"
          >
            see how ranking works
          </a>
          .{" "}
          <a href="./THIRD_PARTY_NOTICES.md" className="text-signal underline underline-offset-2">
            Third-party licences
          </a>{" "}
          and{" "}
          <a href="./LICENSE" className="text-signal underline underline-offset-2">
            Cyno licence
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
