import { useEffect, useMemo, useState } from "react";
import type { Equipment, NightPlan, SkyQuality } from "@cyno/engine";
import { NightTimeline, SkyChart } from "@/components/sky";
import { ControlsBar } from "@/components/ControlsBar";
import { RankedList } from "@/components/RankedList";
import { VerdictBanner } from "@/components/VerdictBanner";
import { ShootingStars } from "@/components/ui/shooting-stars";
import { StarsBackground } from "@/components/ui/stars-background";
import { DEFAULT_PLACE, findMatchingPreset, todayInPlaceTimeZone, type PlacePreset } from "@/lib/places";
import { usePlan } from "@/lib/usePlan";

const RED_MODE_STORAGE_KEY = "cyno:red-mode";

interface UrlState {
  latText: string;
  lonText: string;
  date: string;
  sky: SkyQuality;
  equipment: Equipment;
  placeName: string;
}

function readInitialUrlState(): UrlState {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const rawLat = params.get("lat");
  const rawLon = params.get("lon");
  const latNum = rawLat !== null && rawLat.trim() !== "" ? Number(rawLat) : DEFAULT_PLACE.latitude;
  const lonNum = rawLon !== null && rawLon.trim() !== "" ? Number(rawLon) : DEFAULT_PLACE.longitude;

  const latText = rawLat !== null && rawLat.trim() !== "" ? rawLat : String(DEFAULT_PLACE.latitude);
  const lonText = rawLon !== null && rawLon.trim() !== "" ? rawLon : String(DEFAULT_PLACE.longitude);

  const defaultDate = todayInPlaceTimeZone(
    Number.isFinite(latNum) ? latNum : DEFAULT_PLACE.latitude,
    Number.isFinite(lonNum) ? lonNum : DEFAULT_PLACE.longitude,
  );
  const date = params.get("date") || defaultDate;

  const rawSky = params.get("sky");
  const sky: SkyQuality =
    rawSky === "city" || rawSky === "suburban" || rawSky === "rural" || rawSky === "dark"
      ? rawSky
      : "suburban";

  const rawEq = params.get("eq");
  const equipment: Equipment =
    rawEq === "eye" || rawEq === "binoculars" || rawEq === "telescope" ? rawEq : "eye";

  const explicitName = params.get("name")?.trim();
  const matchedPreset =
    Number.isFinite(latNum) && Number.isFinite(lonNum) ? findMatchingPreset(latNum, lonNum) : undefined;
  const placeName =
    explicitName ||
    matchedPreset?.name ||
    (Number.isFinite(latNum) && Number.isFinite(lonNum)
      ? `${latNum.toFixed(2)}°, ${lonNum.toFixed(2)}°`
      : DEFAULT_PLACE.name);

  return { latText, lonText, date, sky, equipment, placeName };
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
  const initial = useMemo(() => readInitialUrlState(), []);
  const [latText, setLatText] = useState(initial.latText);
  const [lonText, setLonText] = useState(initial.lonText);
  const [date, setDate] = useState(initial.date);
  const [sky, setSky] = useState<SkyQuality>(initial.sky);
  const [equipment, setEquipment] = useState<Equipment>(initial.equipment);
  const [placeName, setPlaceName] = useState(initial.placeName);
  const [redMode, setRedMode] = useState<boolean>(() => readInitialRedMode());

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

  const rawPlanInput = useMemo(() => {
    const latitude = latText.trim() === "" ? Number.NaN : Number(latText);
    const longitude = lonText.trim() === "" ? Number.NaN : Number(lonText);
    return {
      latitude,
      longitude,
      date,
      sky,
      equipment,
    };
  }, [latText, lonText, date, sky, equipment]);

  const { plan, status, errors, isWorkerError, weatherStatus, retry } = usePlan(rawPlanInput);

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

  const handleLatChange = (val: string) => {
    setLatText(val);
    const latNum = Number(val);
    const lonNum = Number(lonText);
    if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
      const match = findMatchingPreset(latNum, lonNum);
      setPlaceName(match ? match.name : `${latNum.toFixed(2)}°, ${lonNum.toFixed(2)}°`);
    }
  };

  const handleLonChange = (val: string) => {
    setLonText(val);
    const latNum = Number(latText);
    const lonNum = Number(val);
    if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
      const match = findMatchingPreset(latNum, lonNum);
      setPlaceName(match ? match.name : `${latNum.toFixed(2)}°, ${lonNum.toFixed(2)}°`);
    }
  };

  const handleUseGeoLocation = (lat: number, lon: number) => {
    setLatText(String(lat));
    setLonText(String(lon));
    const match = findMatchingPreset(lat, lon);
    setPlaceName(match ? match.name : `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`);
  };

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
            <div className="order-1 flex flex-col justify-start rounded-2xl border border-moonsilver/20 bg-nautical/35 px-4 py-3 backdrop-blur-md lg:col-span-7 lg:order-1">
              <VerdictBanner plan={plan} placeName={placeName} weatherStatus={weatherStatus} />
              <div className="mx-auto flex w-full flex-1 items-center justify-center [&_svg]:mx-auto [&_svg]:max-h-[440px] [&_svg]:w-auto">
                <SkyChart
                  plan={plan}
                  time={activeTime}
                  selectedId={selectedId}
                  onSelect={handleSelectObject}
                  className="w-full"
                />
              </div>
            </div>

            <section
              aria-label="Night sky timeline"
              className="order-2 rounded-2xl border border-moonsilver/20 bg-nautical/35 px-4 py-2.5 backdrop-blur-md lg:col-span-12 lg:order-3"
            >
              <NightTimeline
                plan={plan}
                time={activeTime}
                onTimeChange={handleTimeChange}
                selectedId={selectedId}
              />
            </section>

            <div className="order-3 rounded-2xl border border-moonsilver/20 bg-nautical/35 px-4 py-3 backdrop-blur-md lg:col-span-5 lg:order-2">
              <RankedList plan={plan} selectedId={selectedId} onSelect={handleSelectObject} />
            </div>
          </div>
        )}
      </main>

      <footer className="relative z-10 mx-auto max-w-[1400px] border-t border-moonsilver/15 px-4 py-4 text-[13px] text-moonsilver md:px-6">
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
          .
        </p>
      </footer>
    </div>
  );
}
