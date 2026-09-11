# Contributing

Thanks for looking. This is a small, deliberately plain project, and the
constraints below are what keep it small.

## The constraints

1. **No runtime dependencies.** Not one. The tool has to load from a static
   host, work offline, and still open in five years. A dependency is a promise
   someone else has to keep.
2. **No build step.** What is in the repository is what the browser runs. If a
   change needs compiling, it is the wrong change.
3. **Every figure exists as text.** Nothing may be readable only as pixels on
   the canvas. The drawing illustrates the schedule; it never replaces it.
4. **The engine stays pure.** Anything under `src/engine/` takes values and
   returns values — no DOM, no canvas, no globals. That is what makes the
   arithmetic testable.
5. **State what the model assumes.** A new computed figure needs a row in the
   README's model table, and a new simplification needs a line under Limits.

## Getting set up

```sh
git clone https://github.com/andreyruvi/massing-study.git
cd massing-study
npm test           # the whole suite, no install needed
npm run serve      # http://localhost:8080
```

There is no `npm install` because there is nothing to install. Node 20 or
newer is required for the built-in test runner.

Open the page through the server, not by double-clicking `index.html`: ES
modules do not load over `file://`.

## Tests

The tests are the specification, so a change to behaviour is a change to a
test.

```sh
npm test                              # everything
node --test test/sun.test.js          # one file
```

What good coverage looks like here:

- **Arithmetic**: pin the actual numbers, not just the shape. `gfa === 1056`
  says more than `typeof gfa === 'number'`.
- **Solar maths**: check against values that are true independently of the
  implementation — declination at the solstices, ≈90° altitude at the equator
  at equinox solar noon, azimuth 180 at northern solar noon, a negative
  altitude at midnight.
- **Geometry**: a setback that consumes the plot must report an unbuildable
  envelope rather than a negative one.
- **Projection and scene**: that back faces are dropped, that the painter's
  order runs far to near, and that the whole drawing lands inside the
  viewport.
- **Markup**: if you add a `data-` hook or a named input, the contract test in
  `test/markup.test.js` will already be checking it. If you remove one, remove
  it from both sides.

CI runs the suite on Node 20 and 22. Both must pass.

## Style

- ES modules, two-space indent, semicolons, single quotes.
- Comments explain *why*, not *what*. If a line needs a comment to say what it
  does, rename something instead.
- British spelling in prose; `licence` the noun, `license` the verb.
- Metric throughout, metres and square metres, rounded at the boundary rather
  than mid-calculation.
- Prefer a named function to a clever expression.

## Reporting a problem

For a wrong number, the useful report is the inputs plus the figure you
expected and why — a clause from the ordinance, a hand calculation, a
screenshot from another tool. That is enough to write a failing test from,
which is the first thing that will happen.

For a rendering problem, say which browser and which camera bearing and
elevation, and attach the PNG export if you can.

## What is out of scope

Some things are not oversights:

- **Arbitrary polygon plots.** Offsetting a general polygon correctly is a
  different project. Surveyed area is the honest approximation here.
- **Perspective views.** A massing study is measured off the drawing.
- **A jurisdiction's rulebook.** The tool checks limits you enter; it does not
  encode anybody's planning code, and it should not start pretending to.
- **Anything that phones home.** No analytics, no fonts from a CDN, no
  telemetry.
