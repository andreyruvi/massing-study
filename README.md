# Massing Study

What fits on the plot, before anyone draws a plan.

[![CI](https://github.com/andreyruvi/massing-study/actions/workflows/ci.yml/badge.svg)](https://github.com/andreyruvi/massing-study/actions/workflows/ci.yml)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

**[Open the tool →](https://andreyruvi.github.io/massing-study/)**

You have a plot, a setback rule, a height cap and a plot-ratio limit, and
someone wants to know by tomorrow whether the brief fits. Massing Study does
that arithmetic and draws the result: the buildable envelope after setbacks, a
storey-by-storey area schedule, gross and net floor area, plot ratio, site
coverage, overall height, a pass/fail against each limit, and the ground
shadow at any date and hour.

It runs entirely in the browser. Nothing is uploaded, there is no account, and
the page keeps working with the network off once it has loaded — which matters,
because a feasibility study is commercially sensitive long before it is
planning-ready.

## What it does

- **Setbacks per edge.** Front, rear and two sides, taken off their own edge,
  the way an ordinance is actually written. The remaining envelope is drawn as
  a dashed line on the site.
- **Irregular plots.** Enter the surveyed area and it overrides width × depth
  in every ratio. General polygon offsetting is deliberately *not* attempted —
  see [Limits](#limits).
- **Per-storey schedule.** Floor area by level, with an optional upper-storey
  stepback, totalled to gross floor area and converted to net by an efficiency
  you set.
- **Planning checks.** Plot ratio, height and coverage against the plot's
  limits, each with its headroom. Leave a limit blank and it is not checked.
  When the scheme complies, the tool also reports the tallest storey count that
  still would.
- **Sun and shadow.** Solar altitude and azimuth from the NOAA equations, and
  the building's ground shadow at that moment. Day 355 — the December solstice
  — is the default, because that is the worst overshadowing case north of the
  equator.
- **Axonometric, not perspective.** Parallel projection, so equal lengths stay
  equal and the drawing can be measured. Camera bearing and elevation are
  yours to set.
- **Exports.** A Wavefront OBJ of the mass for Revit, SketchUp or 3ds Max; the
  area schedule as CSV; the drawing as PNG; and the whole scheme as a JSON
  preset you can reload later.
- **A print sheet.** One A4 page with the drawing above the schedule, the
  controls stripped out and everything forced to black on white, so a
  dark-theme screen does not print a black page.

## Use it

Nothing to install — [open the hosted
version](https://andreyruvi.github.io/massing-study/) and start typing. Your
last scheme is remembered in the browser, on your machine only.

To run it locally:

```sh
git clone https://github.com/andreyruvi/massing-study.git
cd massing-study
npm run serve      # then open http://localhost:8080
```

Use the server rather than opening `index.html` directly. The page is built
from ES modules, and browsers refuse to load a module over `file://` — you get
a CORS error and a blank tool. `npm run serve` is thirty lines of `node:http`
with no dependencies.

## The model, stated plainly

A tool that hands you a plot ratio to four decimal places should say what it
assumes.

| Quantity | How it is computed |
| --- | --- |
| Site area | Surveyed area if given, otherwise width × depth |
| Buildable envelope | `width − (left + right)` by `depth − (front + rear)` |
| Footprint | Ground-floor area, i.e. the envelope |
| Gross floor area | Sum of every storey's area |
| Net floor area | GFA × the net-to-gross percentage |
| Plot ratio | GFA ÷ site area |
| Site coverage | Footprint ÷ site area, as a percentage |
| Height | Storeys × floor-to-floor |
| Shadow length | Height ÷ tan(solar altitude) |

Every storey is a rectangular box on the envelope. A stepback shrinks the
envelope equally on all four sides from the storey you nominate upwards.
Lengths are in metres and rounded to millimetres; angles to two decimals.

Solar positions follow the NOAA solar-position equations. Azimuth is measured
clockwise from true north, so 90° is east and 180° south. The tool works in
*solar* time, where 12:00 is solar noon, which keeps the geometry independent
of timezone and longitude.

## Limits

Worth knowing before you rely on a number:

- **Figures are indicative.** This is the arithmetic of a feasibility sketch,
  not a planning determination. Check every figure against the applicable
  ordinance and a surveyed site plan.
- **The plot is a rectangle.** An irregular plot is handled by entering its
  surveyed area, which fixes the ratios but not the envelope: the envelope is
  still computed from width and depth. Offsetting an arbitrary polygon
  correctly is real work, and approximating it badly would be worse than not
  offering it.
- **Definitions vary by jurisdiction.** What counts towards gross floor area —
  balconies, plant, parking, the ground floor — differs everywhere, and so does
  whether height is measured to eaves, parapet or ridge. The tool measures to
  the top of the topmost storey.
- **The shadow is a flat-ground shadow.** No terrain, no neighbouring
  buildings, no reflection, no atmospheric refraction near the horizon.
- **Latitude is capped at ±66°.** Inside the polar circles the day-length
  behaviour needs handling this model does not attempt.
- **No daylight or sunlight-hours assessment.** Overshadowing here is a
  geometric shadow, not a BRE-style or VSC assessment.

## Development

```sh
npm test           # 128 tests, no dependencies
npm run serve      # local static server on :8080
```

The tests are the specification. The engine is pure functions, so the
arithmetic, the solar equations, the projection and the depth sorting are all
checked without a browser — including the values a drawing cannot show you,
like whether a face that turns away from the camera was correctly dropped.

```
src/engine/geometry.js    setbacks, rectangles, shoelace area
src/engine/massing.js     the scheme: areas, ratios, planning checks
src/engine/sun.js         solar position and ground shadows
src/engine/exporters.js   OBJ, CSV and JSON preset
src/ui/projection.js      axonometric camera and viewport fit
src/ui/scene.js           depth-sorted faces, back-face culling, north point
src/ui/renderer.js        the only file that touches a canvas
src/ui/format.js          number and unit formatting
src/ui/schedule.js        the readouts, as real text in the document
src/ui/controls.js        the form
src/ui/download.js        exports and local persistence
src/main.js               wiring
```

`test/markup.test.js` checks the contract between the page and the scripts:
every `data-` hook the JavaScript queries has to exist in `index.html`, every
named input has to be read, every button action has to have a handler, and
every palette token the renderer reads has to be defined in the stylesheet. A
rename that breaks a panel fails the suite instead of silently blanking a
readout.

## Accessibility

The drawing is the illustration; the schedule is the deliverable. Every figure
on the canvas also exists as real text in the document — selectable, printable
and readable by a screen reader. The canvas carries a text alternative, status
messages go through a polite live region, every input has a bound label, there
is a skip link to the drawing, and the page respects
`prefers-reduced-motion` and `prefers-color-scheme`.

## Provenance

Massing Study is original work. It is not a fork, a template or a rebrand: no
third-party code, no dependencies, nothing vendored. If you find something in
here that you believe is yours, please
[open an issue](https://github.com/andreyruvi/massing-study/issues) and it will
be addressed properly.

## Licence

[MIT](LICENSE) © 2026 Duong L.
