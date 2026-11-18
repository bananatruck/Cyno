# Cyno design plan

## Subject, audience, job

Cyno is a stargazing planner used outdoors at dusk, on a phone held in a cold hand or a laptop on a car bonnet.
Its one job is to answer "what should I look at tonight, when, and why" for one place and one night.
Kesh's own direction in `GeminiPlan.md` is "Comfort in the Cosmos", "Nebula & Glass", a Red-Light Mode that preserves night vision, and a Go/No-Go score; this plan follows those words.

## Palette

| Token      | Hex     | Role                                                                                 |
| ---------- | ------- | ------------------------------------------------------------------------------------ |
| abyss      | #050816 | Page background: the sky at astronomical night, blue-black rather than neutral black |
| nautical   | #13204A | Panels and the nautical-twilight band                                                |
| civil      | #34508F | Civil-twilight band, hover surfaces                                                  |
| horizon    | #F2B880 | Sunset and sunrise band only, plus the best-time marker                              |
| starlight  | #F4EFE2 | Primary text and star glyphs, a warm white                                           |
| moonsilver | #AEB8D6 | Secondary text, the Moon and its arc                                                 |
| signal     | #8EA7FF | Selection and focus, a cool periwinkle                                               |

Red-Light Mode replaces every token with reds on #120000: text #FF5A4E, secondary #ED6158 (at least 4.5:1 on both red backgrounds), panels #2A0505, nothing blue or white anywhere.

## Type

Cormorant Garamond (display): object names, the verdict word, the place name; it echoes the engraved lettering of old star atlases.
Manrope (interface): everything else, with tabular figures for times, altitudes and scores.
Both are bundled with the app through Fontsource, so the app works offline.
Scale: 13, 15, 18, 24, 34, 52 px; sentence case throughout; no all-caps labels.

## Layout

Desktop, 1440 wide:

```
 Cyno   [ place / lat, lon ][ date ][ sky ][ equipment ]            [ red light ]
 +-------------------------------------------+  +---------------------------+
 | Go . 78    Dark 18:15-05:20, Moon 53% lit |  | 1  Saturn            86   |
 |                                           |  |    why: altitude +27 ...  |
 |              sky chart dome               |  | 2  Moon              81   |
 |       (zenith centre, horizon rim,        |  | 3  Vega              74   |
 |        N up, E left, objects + stars)     |  | ...                       |
 +-------------------------------------------+  +---------------------------+
 [ night timeline: sunset ... sunrise as a band of real sky colour, Moon arc,   ]
 [ selected object's altitude curve, cloud bars, scrubber shared with the chart ]
```

Phone, 390 wide: header, controls in a collapsible sheet, verdict, chart at full width, timeline, then the ranked list.
Content is left aligned; the chart is the only centred element.

## Principles

The memorable thing is the timeline: it is drawn as the actual colour of the sky through the night, amber to blue to black and back, so darkness is seen rather than read.
Everything around it stays quiet: glass panels at low opacity, thin hairlines, no gradient washes.
Motion happens once on load (the stars fade in and the chart's objects rise to their positions) and otherwise only in answer to the user (scrubbing, selecting, expanding the reasoning).
Every object's reasoning is one tap away and reads as plain sentences with the points beside them.
Empty and error states give direction: "No dark sky here tonight: the Sun stays 4 degrees below the horizon at its lowest. Try a date nearer the winter solstice or a place closer to the equator."
Reduced motion turns off the starfield drift and shooting stars; keyboard focus is always visible; contrast meets WCAG AA in both modes.

## Self-review against generic defaults

The first draft used a single acid-cyan accent on near-black, which is one of the stock looks; it was replaced by the periwinkle signal colour on a blue-black that is the subject's own colour.
The first draft also put a big score number with a gradient in the hero; the hero is now the sky chart itself, and the score sits in one line beside the verdict word.
Monospace data labels were dropped in favour of Manrope's tabular figures.

## Component sources

Backdrop: Aceternity UI Stars Background and Shooting Stars, at low density.
Scores and counts: Magic UI Number Ticker; the selected object card carries Magic UI Border Beam.
Headline and verdict entrance: React Bits Blur Text; list cards use React Bits Spotlight Card.
Controls: a segmented control and a combobox from 21st.dev.
Each adapted component keeps a header comment naming its source and licence.
