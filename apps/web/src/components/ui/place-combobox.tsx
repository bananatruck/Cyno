// Source: https://21st.dev/@hero_ui/components/heroui-combo-box
// License: MIT (as listed on the 21st.dev component page)
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { PLACE_PRESETS, type PlacePreset } from "@/lib/places";
import { cn } from "@/lib/utils";

export interface PlaceComboboxProps {
  selectedName: string;
  latitude: number | string;
  longitude: number | string;
  onSelectPreset: (preset: PlacePreset) => void;
  className?: string;
}

export function PlaceCombobox({
  selectedName,
  latitude,
  longitude,
  onSelectPreset,
  className,
}: PlaceComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const filtered = PLACE_PRESETS.filter((preset) =>
    preset.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const choosePreset = (preset: PlacePreset) => {
    onSelectPreset(preset);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={`Place preset: ${selectedName}`}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            setTimeout(() => inputRef.current?.focus(), 10);
          }
        }}
        className="inline-flex w-full items-center justify-between gap-2 rounded-full border border-moonsilver/25 bg-nautical/65 px-3 py-1.5 text-[13px] text-starlight transition-colors hover:border-signal/55"
      >
        <span className="inline-flex items-center gap-1.5 truncate">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-signal" aria-hidden="true" />
          <span className="font-display text-[15px] tracking-tight text-starlight">{selectedName}</span>
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 text-moonsilver transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-40 mt-1.5 w-64 rounded-xl border border-moonsilver/30 bg-abyss/95 p-2 shadow-xl backdrop-blur-md"
          role="dialog"
          aria-label="Choose a preset place"
        >
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-label="Filter preset places"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
              } else if (e.key === "Enter" && filtered[activeIndex]) {
                e.preventDefault();
                choosePreset(filtered[activeIndex]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            placeholder="Search preset places..."
            className="mb-1.5 w-full rounded-lg border border-moonsilver/25 bg-nautical/60 px-2.5 py-1.5 text-[13px] text-starlight placeholder:text-moonsilver/70"
          />
          <ul id={listboxId} role="listbox" aria-label="Preset places" className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-2.5 py-2 text-[13px] text-moonsilver">
                No matching preset. Enter latitude and longitude directly.
              </li>
            ) : (
              filtered.map((preset, idx) => {
                const isSelected =
                  Math.abs(Number(latitude) - preset.latitude) < 0.005 &&
                  Math.abs(Number(longitude) - preset.longitude) < 0.005;
                const isHighlighted = idx === activeIndex;
                return (
                  <li
                    key={preset.name}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => choosePreset(preset)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                      isHighlighted ? "bg-civil/55 text-starlight" : "text-moonsilver hover:text-starlight",
                    )}
                  >
                    <div>
                      <div className="font-medium text-starlight">{preset.name}</div>
                      <div className="tabular-nums text-[12px] text-moonsilver">
                        {preset.latitude.toFixed(2)}°, {preset.longitude.toFixed(2)}°
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-signal" aria-hidden="true" />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
