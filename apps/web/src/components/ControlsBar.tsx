import { useId, useMemo, useRef, useState } from "react";
import { Eye, LocateFixed, SlidersHorizontal } from "lucide-react";
import type { Equipment, InputError, SkyQuality } from "@cyno/engine";
import { parsePlanInput } from "@cyno/engine/input";
import type { PlacePreset } from "@/lib/places";
import { parseCoordinateText } from "@/lib/urlState";
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

/** Out of flow on desktop so an error never changes the header's height or wrapping. */
const FIELD_ERRORS_CLASS =
  "flex w-full flex-col items-center text-[12px] text-horizon lg:pointer-events-none lg:absolute lg:top-full lg:left-0 lg:z-10 lg:mt-0.5 lg:w-max lg:items-start lg:rounded-md lg:bg-abyss/95 lg:px-1.5 lg:py-0.5";

type FieldWithError = "latitude" | "longitude" | "date";

function describeGeolocationError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location access was denied.";
    case err.POSITION_UNAVAILABLE:
      return "Your device could not determine its location.";
    case err.TIMEOUT:
      return "Your location could not be found in time.";
    default:
      return "Your location could not be found.";
  }
}

function optionLabel<T extends string>(options: readonly SegmentOption<T>[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

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
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const geoRequestRef = useRef(0);
  const errorIdPrefix = useId();
  const errorId = (field: FieldWithError) => `${errorIdPrefix}${field}-error`;

  const validationErrors = useMemo<InputError[]>(() => {
    const parsed = parsePlanInput({
      latitude: parseCoordinateText(latText),
      longitude: parseCoordinateText(lonText),
      date,
      sky,
      equipment,
    });
    if (!parsed.ok) return parsed.errors;
    return errors ?? [];
  }, [latText, lonText, date, sky, equipment, errors]);

  const hasValidationErrors = validationErrors.length > 0;
  const [sheetOpen, setSheetOpen] = useState(hasValidationErrors);
  const [sheetSawErrors, setSheetSawErrors] = useState(hasValidationErrors);
  if (hasValidationErrors !== sheetSawErrors) {
    setSheetSawErrors(hasValidationErrors);
    if (hasValidationErrors) setSheetOpen(true);
  }

  /**
   * A location edit supersedes any geolocation request still in flight, and its error: once the user has
   * chosen a place, "choose a preset" no longer applies. The request ID keeps a late reply from bringing
   * the error back.
   */
  const supersedeGeoRequest = () => {
    geoRequestRef.current += 1;
    setLocating(false);
    setGeoStatus(null);
  };

  const latError = validationErrors.find((e) => e.field === "latitude")?.message;
  const lonError = validationErrors.find((e) => e.field === "longitude")?.message;
  const dateError = validationErrors.find((e) => e.field === "date")?.message;
  const fieldErrors = (
    [
      ["latitude", latError],
      ["longitude", lonError],
      ["date", dateError],
    ] as const
  ).flatMap(([field, message]) => (message ? [{ field, message }] : []));

  const handleLocate = () => {
    setGeoStatus(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("Geolocation is not available in this browser. Choose a preset or enter coordinates.");
      return;
    }
    const requestId = ++geoRequestRef.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (geoRequestRef.current !== requestId) return;
        setLocating(false);
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        onUseGeoLocation(lat, lon);
      },
      (err) => {
        if (geoRequestRef.current !== requestId) return;
        setLocating(false);
        setGeoStatus(`${describeGeolocationError(err)} Choose a preset or enter coordinates manually.`);
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

        <button
          type="button"
          aria-pressed={redMode}
          onClick={onToggleRedMode}
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1 text-[13px] font-medium transition-colors lg:order-last",
            redMode
              ? "border-signal bg-nautical text-starlight"
              : "border-moonsilver/30 bg-nautical/65 text-moonsilver hover:border-signal/55 hover:text-starlight",
          )}
        >
          <Eye className="h-3.5 w-3.5 text-signal" aria-hidden="true" />
          <span>Red light</span>
        </button>

        <button
          type="button"
          aria-expanded={sheetOpen}
          aria-controls="cyno-controls-sheet"
          onClick={() => setSheetOpen((prev) => !prev)}
          className="flex w-full items-center gap-2.5 rounded-2xl border border-moonsilver/30 bg-nautical/65 px-3 py-1.5 text-left text-[13px] leading-snug text-moonsilver transition-colors hover:border-signal/55 hover:text-starlight lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-signal" aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className="font-display text-[17px] leading-tight text-starlight">{placeName}</span>
            <span className="tabular-nums">
              {date}, {optionLabel(SKY_OPTIONS, sky)} sky, {optionLabel(EQUIPMENT_OPTIONS, equipment)}
            </span>
          </span>
        </button>

        <div
          id="cyno-controls-sheet"
          className={cn("w-full lg:w-auto lg:flex-1", sheetOpen ? "block" : "max-lg:hidden")}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2">
            <PlaceCombobox
              selectedName={placeName}
              latitude={latText}
              longitude={lonText}
              onSelectPreset={(preset) => {
                supersedeGeoRequest();
                onSelectPreset(preset);
              }}
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

            <div className="relative flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2">
              <label className="flex items-center gap-1 text-[13px] text-moonsilver">
                <span>Lat</span>
                <input
                  type="number"
                  step="any"
                  aria-label="Latitude"
                  aria-invalid={Boolean(latError)}
                  aria-describedby={latError ? errorId("latitude") : undefined}
                  value={latText}
                  onChange={(e) => {
                    supersedeGeoRequest();
                    onLatChange(e.target.value);
                  }}
                  className={cn(
                    "w-19 rounded-full border bg-nautical/65 px-2 py-1 text-[13px] tabular-nums text-starlight",
                    latError ? "border-horizon" : "border-moonsilver/25",
                  )}
                />
              </label>
              <label className="flex items-center gap-1 text-[13px] text-moonsilver">
                <span>Lon</span>
                <input
                  type="number"
                  step="any"
                  aria-label="Longitude"
                  aria-invalid={Boolean(lonError)}
                  aria-describedby={lonError ? errorId("longitude") : undefined}
                  value={lonText}
                  onChange={(e) => {
                    supersedeGeoRequest();
                    onLonChange(e.target.value);
                  }}
                  className={cn(
                    "w-21 rounded-full border bg-nautical/65 px-2 py-1 text-[13px] tabular-nums text-starlight",
                    lonError ? "border-horizon" : "border-moonsilver/25",
                  )}
                />
              </label>
              <label className="flex items-center gap-1 text-[13px] text-moonsilver">
                <span className="sr-only">Date</span>
                <input
                  type="date"
                  aria-label="Date"
                  aria-invalid={Boolean(dateError)}
                  aria-describedby={dateError ? errorId("date") : undefined}
                  value={date}
                  onChange={(e) => onDateChange(e.target.value)}
                  className={cn(
                    "rounded-full border bg-nautical/65 px-2.5 py-1 text-[13px] tabular-nums text-starlight",
                    dateError ? "border-horizon" : "border-moonsilver/25",
                  )}
                />
              </label>
              {fieldErrors.length > 0 && (
                <div className={FIELD_ERRORS_CLASS}>
                  {fieldErrors.map(({ field, message }) => (
                    <span key={field} id={errorId(field)} role="alert">
                      {message}
                    </span>
                  ))}
                </div>
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
      </div>
    </header>
  );
}
