# Build contract: TechRun 2027 scroll film

The site is the same cinematic scroll film as before (same engine, same 24-shot flow, same animation language):
a fixed 1920x1080 "stage" scaled to the window, 24 scenes ("shots") scrubbed by scroll with GSAP, Lenis smooth
scroll, HUD corners, film grain, a cursor ring, star particles, a three.js hero object that moves between scenes
(exploded view, per-part content), iris transitions between colour fields. **Only the content, the colour palette,
the type, the imagery and the 3D object change.** Keep every scene's choreography (timings, reveals, masks, decodes,
irises, holds) as close to the original as the new content allows.

Brand: **TechRun 2027**, a tech-powered fun run organised by **GN Club**. Tagline "Move people for a brighter
tomorrow". Contact techrun.contactus@gmail.com. Date, venue and registration are **TBA** (say so; never invent a
date, price, or URL). The look is black + white with the cyan → lime → orange gradient, Y2K/retro-computer and pixel
art accents (pixel staircase, Win98 windows, pixel trophy, pixel runners).

## Palette and type (single source of truth)

`js/palette.js` exports `PALETTE {ink #000000, paper #ffffff, lime #c6f24e, cyan #33c7e0, orange #f2b84e, ash}`,
`RGB`, `rgba(name, a)`, `HEX` (three.js numbers), `GRADIENT`, `GRADIENT_STOPS`, `FIELD_BG`, `LIGHT_FIELDS`.
`css/style.css` mirrors them as `--ink --paper --lime --cyan --orange --ash`, `--*-rgb` triples, `--accent` (= lime),
`--grad`. **No raw hex/rgb colour literals in JS or HTML strings**: import from palette.js, or use `var(--x)` /
`rgba(var(--x-rgb), a)` in inline styles. (Exception: the fixed Win98 greys of `.win` in style.css.)
Lime is the main accent (old "red" role); paper is the old "bone"; cyan and orange are secondary accents.
Text on lime/cyan/orange/paper fields is ink. Never put lime text on paper (contrast); on paper use ink or the gradient.

Fonts (Google Fonts, already linked): **Tektur** (variable, wdth 75..100, wght 400..900) is `--sans` and `--mono`;
**Tiny5** (pixel, single weight 400) is `--pixel`. `.mega/.big/.mid` use Tektur 900 condensed (`font-stretch:75%`).
Use the `.pixel` class (Tiny5) for the brand wordmark bits ("2027", counters, % readouts, bib numbers, decode text)
at ≥ 28px; small labels stay Tektur (`.mono`, `.eyebrow`). Tektur and Tiny5 are wider than the old Geist; re-check
every width-fitting computation (`fit()` helpers assume an advance factor `k`; Tektur 900 @ 75% ≈ 0.58, Tiny5 ≈ 0.72).

Shared CSS helpers (style.css): `.pixel`, `.grad-text`, `.grad-bg`, `.band` (brand gradient ticker strip with
repeated "TECHRUN 2027"), `.sprite` (pixelated img), `.photo` (object-fit img), `.win > .bar + .body` (Win98 window
chrome), `.mask > span`, `.eyebrow`, `.dim`, `.ol` (outline type), `.ol-accent`, `.links a`, `a.lnk`, `.card`, `.cert`,
`.tag3`, `.phone`, `.chip`, `.dot`, `.period`, `.live`, `.scanline`.
**Only main.js's owner edits style.css.** Scene-specific CSS goes in a `<style>` block inside the scene's `html`,
every selector prefixed with `.scene[data-slug="<slug>"]`.

## Assets (`C.assets`, see js/content.js)

Images in `assets/img/` (TR mark, logo ring, runner legs cut-out, pixel staircase, splash, trophy, paint window, icons,
gradient blob, photos: computer, hills, runners, paintGuy, matrix, errors, tv, bibs, singlets, sweater, backpack,
caps, crew). Pixel runners in `assets/gif/`: `C.assets.runners.{cyber,hoodie,cap}.{walk,run}` — 512x512 transparent
GIFs, 8 frames, character faces right; render with class `sprite` (image-rendering: pixelated), sizes 128/192/256/384 px.
GIFs animate on their own (not scrubbed) — that's fine and intended. Use `<img alt="">` (decorative) or meaningful alt.
Logos (keyed, transparent): `logoRing`, `badge`, `mark` are for DARK fields; `markInk`, `markSolid` for LIGHT
fields (never put a white mark on paper). Use logos as accents (badges, stamps, the rotating badge in showcases /
partners, a small lockup) — not wallpaper. `covers.dark` / `covers.halftone` are 851x315 social banners: show them only
at ≤ 900px wide inside a framed element (e.g. a `.win` window or a card), never full-bleed (they would pixelate).
`halftone` (1000px) can be a framed texture. Every asset must earn its place; the editorial composition comes first.
Every image you place must be inside the 1920x1080 frame unless deliberately bleeding off the edge
(then mark it `data-bleed`).

## Files and owners

- `js/scenes/boot.js`        scenes 01-05
- `js/scenes/about.js`       scenes 06-10
- `js/scenes/kit.js`         scenes 11-19  (was arsenal.js)
- `js/shoe.js`               three.js running shoe (was gun.js) — same owner as kit.js
- `js/scenes/highlights.js`  scenes 20-24  (was projects.js)
- `js/main.js`, `css/style.css`, `index.html`   engine
- `js/scenes/index.js`, `js/scenes/util.js`, `js/content.js`, `js/palette.js`  shared, do not edit (report issues)

`index.js` loads the four scene modules with dynamic imports; a module that throws is skipped and logged, so other
scenes keep working while you build yours.

## Scene module interface

Each scene file: `export function scenes(C, P) { return [ ...sceneObjects ] }` where `C` is `CONTENT` and `P` is the
shared shoe poser from `makePoser` (util.js). A scene object:

```js
{ slug, name, act, field,      // field: "ink" | "lime" | "cyan" | "orange" | "paper" | "quad" (quad = ink root with four coloured cells)
  dur,                          // seconds
  stars: bool,                  // star particles show behind it (ink scenes only; root is then transparent: class "starry")
  ammo: 0..3,                   // how many HUD pips glow (now "energy" pips)
  turn: null | [sec, field],    // the field changes mid-scene; the scene animates that itself
  rest: null | "hint text",     // resting frame: the scroll holds here so people can read/click
  restAt: null | seconds,       // where in the scene it holds (default: dur*0.55)
  shoe: bool,                   // the 3D shoe canvas is visible in this scene   (was `gun`)
  html: `...`,                  // inner HTML of the scene root (a 1920x1080 absolute box). position:absolute px layout.
  anim(root, tl, env),          // add tweens to the paused GSAP timeline `tl` (time 0..dur). Must be scrub-safe.
  tick(root, st, env)           // optional, every frame while active; st = seconds into the scene
}
```
`env` = `{ shoe: shoeApi, mouse: {sx, sy}, clock, C }` (`mouse.sx/sy` smoothed -1..1; `clock` = wall seconds).

Rules for `anim`: use `tl.from/fromTo/to/set` only; every tween must be reversible (the user scrubs both ways);
no `tl.call` for visual state, no timers, no Math.random/Date (use deterministic hash values). Element start states
come from `from`/`fromTo`; do not rely on CSS initial hidden states. Text reveals: wrap lines in `.mask > span` and
animate `yPercent`. Put an iris/flood circle inside the scene for `turn` changes and flip text colours with
`tl.set(el, {color}, t)`. Only `<a>` and `.chip` receive pointer events. Do NOT build the generic scene-to-scene
iris; main.js appends it whenever a scene's ending field differs from the next scene's starting field.
Links: `mailto:` links have no target; any http link is `<a href target="_blank" rel="noopener">`. All links come
from content.js; never invent URLs.

Shoe scenes: `P.pose(tl, at, dur, {px,py,rx,ry,rz,s,ex}, ease)` tweens the shared shoe state from the previous pose.
The first P.pose call in each shoe scene must be at = 0. The first shoe scene starts the shoe off-screen left
(poser default px = -16). The last shoe scene must fly it off-screen (px: 16) before it ends.
World units: camera fov 30 at z 14 → stage shows 13.3 x 7.5 units (144 px per unit at 1080 tall).
Model faces +x (toe right). `shoe.js` exports `PARTS = ["toe","laces","upper","heel","midsole","outsole"]` and
`PART_CENTER = { part: [x, y] }` (model units, assembled, before scale). To frame a part at screen (sx, sy) with
scale s and ry≈0: `px = sx - cx*s`, `py = sy - cy*s`. `env.shoe.project(part)` -> `[x, y]` stage px or null.
Part content lives in `C.kit[part]` = `{part, group, items, primary}`.

## shoe.js interface (same shape as the old gun.js)

```js
export const PARTS, PART_CENTER;
export async function mountShoe(canvas, state, opts) // canvas #gun element (id kept), opts {pixelRatio, interactive}
  -> { render({sway:[rx,ry], light:[x,y], t}), pick(clientX, clientY) -> part|null,
       project(part) -> [x,y]|null, highlight(part|null), setVisible(bool), setPixelRatio(n) }
```
Procedural low-poly running shoe (no external model files): six Groups named by part, materials from `HEX`
(ink/graphite body, paper outlines via EdgesGeometry, gradient accents cyan/lime/orange on midsole/outsole/laces),
a lime point light following `light`, transparent background, emissive lime highlight on hover. Explode offsets move
parts apart as `ex` 0→1 with no overlaps at ex = 1.

## main.js responsibilities (deltas from before)

Fields/colours from palette.js; HUD light on LIGHT_FIELDS. Imports `./shoe.js` (`mountShoe`), scene flag `shoe`,
`env.shoe`. `REST_SLUG = "laced-rest"`. Skills panel → kit panel reading `C.kit` ("Part · Toe" / "Distances").
`#about-text` plain-text copy from the new CONTENT keys (brand, location, organizer, categories, kit, highlights,
showcases, partners, contact). Stars in paper. **New: pixel runner** — a fixed `#runner` sprite rides a thin
gradient `#track` along the bottom between the ammo pips and the act label, positioned by film progress
(t / TOTAL_T); shows the `walk` GIF when scroll velocity is low and the `run` GIF when scrolling fast (hysteresis,
no flicker; preload all six); the character changes per act (cyber: acts 00-02, hoodie: 03-05, cap: 06-08);
flips/faces right; hidden during boot autoplay before the landing, on quad scenes, and under reduced motion
(css). `#track.light` on light fields.

## Scene list (slug | field | dur | content) — choreography identical to the original unless noted

01 biometric-scan | ink | 2.4 | runner check-in fingerprint scan; lime scanline; % counter (Tiny5) to 97 at 2.3 then 100
02 access-granted | ink | 1.2 | "READY / SET." decode (was ACCESS GRANTED), bracket flash
03 collapse-to-the-dot | ink | 1.8 | everything collapses into one lime dot, stars on
04 name | lime | 3.4 | hero: "TECH" / "RUN" / "2027" (2027 in Tiny5), period; landing rest at 1.5s ("scroll to enter"); period swells to cover (ink) at the end. Add the TR mark / runner legs as a supporting visual.
05 word-burst | quad | 2.0 | four cells cyan / lime / orange / paper, words MOVE PEOPLE BRIGHTER TOMORROW slam in, cells shrink away to ink
06 location | ink | 3.6 | stars, rotating globe to the pin (Metro Manila, Philippines), "Venue TBA"
07 timezone | cyan | 3.0 | race-day clock, live in C.location.tz
08 organizer | paper | 3.4 | "Organized by" GN Club, mission line, edition, "Date TBA", outline type, logo ring image
09 distances | lime | 2.0 | turn [1.45,"ink"]; "DISTANCES" slides, flood to ink
10 distances-rest | ink | 3.0 | rest "pick your distance"; stars; 3 category rows (3K/5K/10K) linking (mailto), each with a pixel runner GIF
11 kit | orange | 2.0 | turn [1.75,"paper"]; shoe slides in; "THE KIT."
12 exploded | paper | 3.0 | shoe explodes, six labelled parts (tag3 + leader) tracked with env.shoe.project; "Six parts. One run."
13-18 | ink | 2.5 each | toe-distances, laces-race-kit, upper-finish-line, heel-support, midsole-tech, outsole-route: camera pushes onto the part, outline name, group title, items tick in (primary in lime). name = "<Part> · <Group>"
19 laced-rest | ink | 4.0 | rest at ~1.15; shoe reassembled centre idle; "LACED UP."; six `.chip[data-part]` tabindex=0; hint "hover a part to see what's inside"; shoe flies off at the end
20 highlights-rest | cyan | 7.0 | rest at 6.27; C.highlights as a belt/grid of linked cards with photos, "8 REASONS TO RUN" counter
21 showcase-1 | per C.showcases[0].field | 4.0 | rest links; retro .win frame holding the photo (replaces phone mock), runner GIF, big title, ghost letter, strikes, stack, rotating badge
22 showcase-2 | per C.showcases[1].field | 4.0 | same layout
23 partners-rest | ink | 4.6 | rest "become a partner"; four linked partner cards, rotating logo-ring badge
24 blast | ink | 5.0 | turn [0.2,"lime"]; "LET'S RUN" mega; contact rows (links) with arrows; footer line; a pixel runner sprints across

Act labels: "00 · Check-in", "01 · TechRun", "02 · About", "03 · Distances", "04 · The Kit", "05 · Highlights",
"06 · Race Kits", "07 · Partners", "08 · Register".

## Verification harness

Server: `http://localhost:8765/` (already running; do not start another). Screenshots:
`node "<scratchpad>/harness/shot.mjs" --out <dir> --slugs a,b --at 0.35,rest,0.92` (fractions of dur, "rest" = restAt)
→ prints JSON {errors, scenes[{slug, shots[{file, sec, overflow[]}]}]}; read the PNGs to check them visually.
Without --slugs it shoots every scene and a scroll smoke test.

## Quality bar

Premium black/gradient editorial film with Y2K pixel accents; everything inside 1920x1080 with margins ≥ 90px
(except deliberate bleeds), no overflow or overlapping text; type legible when the stage is scaled to ~0.6; no
console errors; all links real; contrast ≥ 4.5:1 for body-size text. Keep each file under ~700 lines; no
console.log; do not touch files you do not own.
