import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SCHEME, siteArea, computeScheme, runChecks, maxStoreysWithin,
} from '../src/engine/massing.js';

/** The worked example used throughout: a 600 m2 plot, 3 storeys at 3.2 m. */
const EXAMPLE = {
  site: { width: 20, depth: 30, surveyedArea: null },
  setbacks: { front: 5, rear: 3, left: 2, right: 2 },
  storeys: 3,
  floorToFloor: 3.2,
  efficiency: 0.82,
  limits: { plotRatio: 2, height: 12, coverage: 60 },
};

test('siteArea multiplies the plot dimensions', () => {
  assert.equal(siteArea({ width: 20, depth: 30, surveyedArea: null }), 600);
});

test('siteArea prefers a surveyed figure over width x depth', () => {
  assert.equal(siteArea({ width: 20, depth: 30, surveyedArea: 571.4 }), 571.4);
});

test('siteArea ignores a zero or nonsense surveyed figure', () => {
  assert.equal(siteArea({ width: 10, depth: 10, surveyedArea: 0 }), 100);
  assert.equal(siteArea({ width: 10, depth: 10, surveyedArea: -5 }), 100);
  assert.equal(siteArea({ width: 10, depth: 10, surveyedArea: NaN }), 100);
});

test('computeScheme produces the worked example figures', () => {
  const r = computeScheme(EXAMPLE);
  assert.equal(r.siteArea, 600);
  assert.equal(r.envelope.width, 16);
  assert.equal(r.envelope.depth, 22);
  assert.equal(r.footprint, 352);
  assert.equal(r.gfa, 1056); // 352 x 3
  assert.equal(r.nfa, 865.92); // 1056 x 0.82
  assert.equal(r.plotRatio, 1.76); // 1056 / 600
  assert.equal(r.coverage, 58.667); // 352 / 600
  assert.equal(r.height, 9.6); // 3 x 3.2
  assert.equal(r.buildable, true);
});

test('computeScheme schedules one storey per level with rising level heights', () => {
  const r = computeScheme(EXAMPLE);
  assert.equal(r.storeys.length, 3);
  assert.deepEqual(r.storeys.map((s) => s.level), [1, 2, 3]);
  assert.deepEqual(r.storeys.map((s) => s.levelHeight), [0, 3.2, 6.4]);
  assert.deepEqual(r.storeys.map((s) => s.area), [352, 352, 352]);
});

test('computeScheme applies the stepback from the nominated storey upwards', () => {
  const r = computeScheme({
    ...EXAMPLE,
    storeys: 4,
    stepback: { fromStorey: 3, distance: 2 },
  });
  assert.deepEqual(r.storeys.map((s) => s.steppedBack), [false, false, true, true]);
  // 16x22 becomes 12x18 = 216 m2 above the stepback.
  assert.deepEqual(r.storeys.map((s) => s.area), [352, 352, 216, 216]);
  assert.equal(r.gfa, 1136);
  assert.equal(r.footprint, 352, 'footprint stays the ground-floor area');
});

test('computeScheme ignores a stepback with no distance', () => {
  const r = computeScheme({ ...EXAMPLE, stepback: { fromStorey: 2, distance: 0 } });
  assert.deepEqual(r.storeys.map((s) => s.steppedBack), [false, false, false]);
  assert.equal(r.gfa, 1056);
});

test('computeScheme uses the surveyed area for the ratios', () => {
  const r = computeScheme({ ...EXAMPLE, site: { width: 20, depth: 30, surveyedArea: 500 } });
  assert.equal(r.siteArea, 500);
  assert.equal(r.footprint, 352, 'the envelope still comes from the rectangle');
  assert.equal(r.plotRatio, 2.112);
  assert.equal(r.coverage, 70.4);
});

test('computeScheme reports an unbuildable plot without throwing', () => {
  const r = computeScheme({
    ...EXAMPLE,
    site: { width: 8, depth: 30, surveyedArea: null },
    setbacks: { front: 5, rear: 3, left: 4, right: 4 },
  });
  assert.equal(r.buildable, false);
  assert.equal(r.footprint, 0);
  assert.equal(r.gfa, 0);
  assert.equal(r.plotRatio, 0);
});

test('computeScheme falls back to the defaults for an empty input', () => {
  const r = computeScheme();
  assert.equal(r.siteArea, siteArea(DEFAULT_SCHEME.site));
  assert.equal(r.storeys.length, DEFAULT_SCHEME.storeys);
});

test('computeScheme rejects impossible inputs', () => {
  assert.throws(() => computeScheme({ site: { width: 0, depth: 10 } }), RangeError);
  assert.throws(() => computeScheme({ storeys: 0 }), RangeError);
  assert.throws(() => computeScheme({ storeys: 2.5 }), RangeError);
  assert.throws(() => computeScheme({ floorToFloor: -3 }), RangeError);
  assert.throws(() => computeScheme({ efficiency: 1.4 }), RangeError);
  assert.throws(() => computeScheme({ setbacks: { front: -1 } }), RangeError);
});

test('the worked example passes all three planning checks', () => {
  const r = computeScheme(EXAMPLE);
  assert.equal(r.checks.length, 3);
  assert.ok(r.checks.every((c) => c.pass), 'every check passes');
  assert.deepEqual(r.checks.map((c) => c.label), ['Plot ratio', 'Building height', 'Site coverage']);
  assert.equal(r.checks[0].headroom, 0.24); // 2 - 1.76
});

test('a check fails once the limit is exceeded', () => {
  const r = computeScheme({ ...EXAMPLE, storeys: 5 });
  const height = r.checks.find((c) => c.label === 'Building height');
  assert.equal(height.value, 16);
  assert.equal(height.pass, false);
  assert.equal(height.headroom, -4);
});

test('runChecks skips limits that were left blank', () => {
  const r = computeScheme({ ...EXAMPLE, limits: { plotRatio: 2, height: null, coverage: null } });
  assert.deepEqual(r.checks.map((c) => c.label), ['Plot ratio']);
  assert.equal(runChecks(r, {}).length, 0);
});

test('a limit exactly met still passes', () => {
  const r = computeScheme({ ...EXAMPLE, limits: { plotRatio: 1.76, height: 9.6, coverage: 58.667 } });
  assert.ok(r.checks.every((c) => c.pass));
  assert.ok(r.checks.every((c) => c.headroom === 0));
});

test('maxStoreysWithin finds the tallest compliant scheme', () => {
  // 12 m height cap at 3.2 m per floor allows 3 storeys (9.6 m); 4 would be 12.8 m.
  assert.equal(maxStoreysWithin(EXAMPLE), 3);
});

test('maxStoreysWithin is bound by plot ratio when that is the binding limit', () => {
  // Plot ratio 1.2 on 600 m2 allows 720 m2 GFA; at 352 m2 a floor that is 2 storeys.
  assert.equal(maxStoreysWithin({ ...EXAMPLE, limits: { plotRatio: 1.2 } }), 2);
});

test('maxStoreysWithin returns zero when even one storey breaches a limit', () => {
  assert.equal(maxStoreysWithin({ ...EXAMPLE, limits: { coverage: 20 } }), 0);
});

test('maxStoreysWithin respects the search ceiling when nothing constrains it', () => {
  assert.equal(maxStoreysWithin({ ...EXAMPLE, limits: {} }, 8), 8);
});
