# Third-party notices

Cyno's own code is MIT (see `LICENSE`).
The files and data below come from other projects and keep their own terms.

## UI components adapted into `apps/web/src/components/ui/`

### React Bits: `blur-text.tsx`, `spotlight-card.tsx`

Source: https://reactbits.dev, licence at https://github.com/DavidHDev/react-bits/blob/d965399df489c7b8da3874e07d716c0d98ab39fd/LICENSE.md

> MIT + Commons Clause License Condition v1.0
>
> Copyright (c) 2026 David Haz
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> Commons Clause Restriction: You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

These two files are part of this application and are not offered as components on their own.

### Aceternity UI: `stars-background.tsx`, `shooting-stars.tsx`

Source: https://ui.aceternity.com, licence at https://ui.aceternity.com/licence.
The Aceternity licence allows use in end products (websites and web apps) and forbids redistributing the items or their source files as components or templates.
These two files are not covered by Cyno's MIT licence.
Whether keeping their adapted source in a public repository is compatible with that licence has not been confirmed with Aceternity.

### Magic UI: `number-ticker.tsx`, `border-beam.tsx`

Source: https://magicui.design (repository https://github.com/magicuidesign/magicui).

> MIT License
>
> Copyright (c) Magic UI
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

### 21st.dev: `segmented-control.tsx`

Source: https://21st.dev/@halaska-studio/components/segmented-control, from https://github.com/Halaska-Studio/ui.

> MIT License
>
> Copyright (c) 2026 Halaska Studio
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

### 21st.dev: `place-combobox.tsx`

Source: https://21st.dev/@hero_ui/components/heroui-combo-box, listed there as MIT by Hero UI.
The HeroUI project it comes from (https://github.com/heroui-inc/heroui) is licensed under the Apache License 2.0, so this file is also offered under that licence; its full text is in [`licenses/HeroUI-Apache-2.0.txt`](licenses/HeroUI-Apache-2.0.txt).
The HeroUI repository has no NOTICE file.

## Data in `packages/engine/src/data/catalog.json`

- OpenNGC by Mattia Verga, https://github.com/mattiaverga/OpenNGC, CC BY-SA 4.0: positions, magnitudes, types, sizes and common names of the Messier objects. The derived catalog data is shared under the same licence.
- IAU Catalog of Star Names (WGSN), https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt: star names, positions and magnitudes.
- NGC 2000.0 (Dreyer, ed. R. W. Sinnott, 1988; HEASARC copy of CDS VII/118), as served by NASA HEASARC (https://heasarc.gsfc.nasa.gov/W3Browse/all/ngc2000.html): the visual magnitude of M35 (NGC 2168).
- Harris, Catalog of Parameters for Milky Way Globular Clusters (2010 edition), https://physics.mcmaster.ca/~harris/mwgc.dat: integrated V magnitudes of six globular clusters.
