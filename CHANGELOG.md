# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-09-11

First release.

### Added

- **Plot model** with per-edge setbacks (front, rear, left, right) and a
  buildable envelope that reports an unbuildable plot rather than a negative
  one. A surveyed area may be entered for an irregular plot and overrides
  width × depth in every ratio.
- **Massing model**: per-storey area schedule, optional upper-storey stepback
  from a nominated level, gross floor area, net floor area from a net-to-gross
  percentage, plot ratio, site coverage and overall height.
- **Planning checks** against plot ratio, height and coverage limits, each
  with its headroom, plus the tallest compliant storey count. A blank limit is
  not checked.
- **Solar model** from the NOAA solar-position equations: declination, the
  equation of time, altitude and azimuth in solar time, wall-clock conversion
  for a given longitude and UTC offset, and the building's ground shadow.
- **Axonometric viewer** on a Canvas 2D surface: parallel projection with an
  adjustable camera bearing and elevation, back-face culling, painter's
  ordering, a viewport fit that keeps the whole drawing in frame, and a north
  point anchored to the sheet corner.
- **Exports**: Wavefront OBJ of the mass, grouped per storey, in metres with Y
  up and Z south; the area schedule and planning checks as CSV; the drawing as
  PNG; and the scheme as a versioned JSON preset that can be reloaded.
- **A4 print sheet** — drawing above the schedule on one page, controls
  removed, palette forced to black on white, and the drawing repainted before
  the dialog opens because a canvas bitmap cannot be recoloured by a print
  stylesheet.
- **Light and dark themes** from `prefers-color-scheme`, with the drawing
  palette read from the stylesheet so the canvas follows the theme.
- **Accessibility**: the whole schedule as real document text, a text
  alternative on the canvas, a polite live region for status messages, labels
  bound to every input, a skip link, and `prefers-reduced-motion` respected.
- **128 tests** over the geometry, massing, solar, exporter, projection, scene
  and formatting modules, plus a contract test that checks every `data-` hook,
  named input, button action and palette token the scripts rely on actually
  exists in the page and the stylesheet.
- `npm run serve`, a dependency-free static server, because ES modules do not
  load over `file://`.

### Notes

- No runtime dependencies and no build step. What is in the repository is what
  the browser runs.
- Original work: not a fork, a template or a rebrand, and nothing vendored.
- Figures are indicative. The model's assumptions and its limits are stated in
  the README rather than left for the reader to discover.
