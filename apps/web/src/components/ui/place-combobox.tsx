// Source: https://21st.dev/@hero_ui/components/heroui-combo-box
// License: MIT (as listed on the 21st.dev component page)
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { PLACE_PRESETS, type PlacePreset } from "@/lib/places";
import { parseCoordinateText } from "@/lib/urlState";
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef(new Map<string, HTMLLIElement>());
  const scrollActiveOption = useRef(false);
  const listboxId = useId();
  const dialogId = useId();

  const filtered = PLACE_PRESETS.filter((preset) =>
    preset.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const optionId = (preset: PlacePreset) => `${listboxId}-option-${PLACE_PRESETS.indexOf(preset)}`;
  const activeOptionId = filtered[activeIndex] ? optionId(filtered[activeIndex]) : undefined;
  const asCoordinate = (value: number | string) =>
    typeof value === "number" ? value : parseCoordinateText(value);
  const selectedLatitude = asCoordinate(latitude);
  const selectedLongitude = asCoordinate(longitude);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!scrollActiveOption.current || !activeOptionId) return;
    scrollActiveOption.current = false;
    optionRefs.current.get(activeOptionId)?.scrollIntoView({ block: "nearest" });
    // A query change can reset the active option to one that is not in view; browsers do not reveal an
    // aria-activedescendant target on their own, so Enter would choose an option the user cannot see.
  }, [activeOptionId, query]);

  const choosePreset = (preset: PlacePreset, returnFocus = false) => {
    onSelectPreset(preset);
    setQuery("");
    setOpen(false);
    if (returnFocus) {
      buttonRef.current?.focus();
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        aria-label={`Place preset: ${selectedName}`}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            // The listbox mounts scrolled to the top, so the active option starts there too.
            setActiveIndex(0);
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
          id={dialogId}
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
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-label="Filter preset places"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              scrollActiveOption.current = true;
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                scrollActiveOption.current = true;
                setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                scrollActiveOption.current = true;
                setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
              } else if (e.key === "Enter" && filtered[activeIndex]) {
                e.preventDefault();
                choosePreset(filtered[activeIndex], true);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                buttonRef.current?.focus();
              }
            }}
            placeholder="Search preset places..."
            className="mb-1.5 w-full rounded-lg border border-moonsilver/25 bg-nautical/60 px-2.5 py-1.5 text-[13px] text-starlight placeholder:text-moonsilver"
          />
          <ul id={listboxId} role="listbox" aria-label="Preset places" className="max-h-56 overflow-y-auto">
            {filtered.map((preset, idx) => {
              const isSelected =
                Math.abs(selectedLatitude - preset.latitude) < 0.005 &&
                Math.abs(selectedLongitude - preset.longitude) < 0.005;
              const isHighlighted = idx === activeIndex;
              const id = optionId(preset);
              return (
                <li
                  id={id}
                  ref={(node) => {
                    if (node) optionRefs.current.set(id, node);
                    else optionRefs.current.delete(id);
                  }}
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
            })}
          </ul>
          <div
            role="status"
            className={cn("text-[13px] text-moonsilver", filtered.length === 0 && "px-2.5 py-2")}
          >
            {filtered.length === 0 ? "No matching preset. Enter latitude and longitude directly." : ""}
          </div>
        </div>
      )}
    </div>
  );
}
