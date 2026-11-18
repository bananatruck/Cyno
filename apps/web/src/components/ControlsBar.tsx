import { useMemo, useState } from "react";
import { Eye, LocateFixed, SlidersHorizontal } from "lucide-react";
import { parsePlanInput, type Equipment, type InputError, type SkyQuality } from "@cyno/engine";
import type { PlacePreset } from "@/lib/places";
import { PlaceCombobox } from "./ui/place-combobox";
import { SegmentedControl, type SegmentOption } from "./ui/segmented-control";
import { cn } from "@/lib/utils";

const SKY_OPTIONS: readonly SegmentOption<SkyQuality>[] = [
  { value: "city", label: "City" },
  { value: "suburban", label: "Suburban" },
  { value: "rural", label: "Rural" },
  { value: "dark", label: "Dark" },
];

const EQUIPMENT_OPTIONS: readonly SegmentOption<Equipment>[] = [
  { value: "eye", label: "Eye" },
  { value: "binoculars", label: "Binoculars" },
  { value: "telescope", label: "Telescope" },
];

export interface ControlsBarProps {
  placeName: string;
  latText: string;
  lonText: string;
  date: string;
  sky: SkyQuality;
  equipment: Equipment;
  redMode: boolean;
  onToggleRedMode: () => void;
  onSelectPreset: (preset: PlacePreset) => void;
  onLatChange: (value: string) => void;
  onLonChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onSkyChange: (value: SkyQuality) => void;
  onEquipmentChange: (value: Equipment) => void;
  onUseGeoLocation: (latitude: number, longitude: number) => void;
  errors?: InputError[];
}

export function ControlsBar({
  placeName,
  latText,
  lonText,
  date,
  sky,
  equipment,
  redMode,
  onToggleRedMode,
  onSelectPreset,
  onLatChange,
  onLonChange,
  onDateChange,
  onSkyChange,
  onEquipmentChange,
  onUseGeoLocation,
  errors,
}: ControlsBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const validationErrors = useMemo<InputError[]>(() => {
    const parsedLat = latText.trim() === "" ? Number.NaN : Number(latText);
    const parsedLon = lonText.trim() === "" ? Number.NaN : Number(lonText);
    const parsed = parsePlanInput({
      latitude: parsedLat,
      longitude: parsedLon,
      date,
      sky,
      equipment,
    });
    if (!parsed.ok) return parsed.errors;
    return errors ?? [];
  }, [latText, lonText, date, sky, equipment, errors]);

  const latError = validationErrors.find((e) => e.field === "latitude")?.message;
  const lonError = validationErrors.find((e) => e.field === "longitude")?.message;
  const dateError = validationErrors.find((e) => e.field === "date")?.message;

  const handleLocate = () => {
    setGeoStatus(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("Geolocation is not available in this browser. Choose a preset or enter coordinates.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        onUseGeoLocation(lat, lon);
      },
      () => {
        setLocating(false);
        setGeoStatus("Location access was denied. Choose a preset or enter coordinates manually.");
      },
      { timeout: 8000 },
    );
  };

  return (
    <header className="relative z-30 border-b border-moonsilver/15 bg-abyss/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 md:px-6">
        <a
          href="#top"
          className="font-display text-[34px] leading-none font-normal tracking-tight text-starlight no-underline"
        >
          Cyno
        </a>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            aria-expanded={sheetOpen}
            aria-controls="cyno-controls-sheet"
            onClick={() => setSheetOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-full border border-moonsilver/30 bg-nautical/65 px-3 py-1 text-[13px] text-moonsilver transition-colors hover:border-signal/55 hover:text-starlight"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-signal" aria-hidden="true" />
            <span className="max-w-[190px] truncate">
              {placeName}, {date}, {sky}, {equipment}
            </span>
          </button>

          <button
            type="button"
            aria-pressed={redMode}
            onClick={onToggleRedMode}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
              redMode
                ? "border-signal bg-nautical text-starlight"
                : "border-moonsilver/30 bg-nautical/65 text-moonsilver hover:border-signal/55 hover:text-starlight",
            )}
          >
            <Eye className="h-3.5 w-3.5 text-signal" aria-hidden="true" />
            <span>Red light</span>
          </button>
        </div>

        <div
          id="cyno-controls-sheet"
          className={cn(
            "w-full lg:w-auto lg:flex-1",
            !sheetOpen && validationErrors.length === 0 ? "max-lg:hidden" : "block",
          )}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2">
            <PlaceCombobox
              selectedName={placeName}
              latitude={latText}
              longitude={lonText}
              onSelectPreset={onSelectPreset}
            />

            <button
              type="button"
              onClick={handleLocate}
              disabled={locating}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-moonsilver/25 bg-nautical/55 px-2.5 py-1 text-[13px] text-moonsilver transition-colors hover:border-signal/55 hover:text-starlight disabled:opacity-50"
            >
              <LocateFixed className="h-3.5 w-3.5 text-signal" aria-hidden="true" />
              <span>{locating ? "Locating..." : "Use my location"}</span>
            </button>

            <div className="flex flex-col">
              <label className="flex items-center gap-1 text-[13px] text-moonsilver">
                <span>Lat</span>
                <input
                  type="number"
                  step="any"
                  aria-label="Latitude"
                  aria-invalid={Boolean(latError)}
                  value={latText}
                  onChange={(e) => onLatChange(e.target.value)}
                  className={cn(
                    "w-19 rounded-full border bg-nautical/65 px-2 py-1 text-[13px] tabular-nums text-starlight",
                    latError ? "border-horizon" : "border-moonsilver/25",
                  )}
                />
              </label>
              {latError && (
                <span role="alert" className="mt-0.5 text-[12px] text-horizon">
                  {latError}
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-1 text-[13px] text-moonsilver">
                <span>Lon</span>
                <input
                  type="number"
                  step="any"
                  aria-label="Longitude"
                  aria-invalid={Boolean(lonError)}
                  value={lonText}
                  onChange={(e) => onLonChange(e.target.value)}
                  className={cn(
                    "w-21 rounded-full border bg-nautical/65 px-2 py-1 text-[13px] tabular-nums text-starlight",
                    lonError ? "border-horizon" : "border-moonsilver/25",
                  )}
                />
              </label>
              {lonError && (
                <span role="alert" className="mt-0.5 text-[12px] text-horizon">
                  {lonError}
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <label className="flex items-center gap-1 text-[13px] text-moonsilver">
                <span className="sr-only">Date</span>
                <input
                  type="date"
                  aria-label="Date"
                  aria-invalid={Boolean(dateError)}
                  value={date}
                  onChange={(e) => onDateChange(e.target.value)}
                  className={cn(
                    "rounded-full border bg-nautical/65 px-2.5 py-1 text-[13px] tabular-nums text-starlight",
                    dateError ? "border-horizon" : "border-moonsilver/25",
                  )}
                />
              </label>
              {dateError && (
                <span role="alert" className="mt-0.5 text-[12px] text-horizon">
                  {dateError}
                </span>
              )}
            </div>

            <SegmentedControl label="Sky quality" options={SKY_OPTIONS} value={sky} onChange={onSkyChange} />

            <SegmentedControl
              label="Equipment"
              options={EQUIPMENT_OPTIONS}
              value={equipment}
              onChange={onEquipmentChange}
            />
          </div>

          {geoStatus && (
            <p role="status" className="mt-1.5 text-center text-[13px] text-horizon">
              {geoStatus}
            </p>
          )}
        </div>

        <div className="hidden items-center lg:flex">
          <button
            type="button"
            aria-pressed={redMode}
            onClick={onToggleRedMode}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1 text-[13px] font-medium transition-colors",
              redMode
                ? "border-signal bg-nautical text-starlight"
                : "border-moonsilver/30 bg-nautical/65 text-moonsilver hover:border-signal/55 hover:text-starlight",
            )}
          >
            <Eye className="h-3.5 w-3.5 text-signal" aria-hidden="true" />
            <span>Red light</span>
          </button>
        </div>
      </div>
    </header>
  );
}
