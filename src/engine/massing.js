import { buildableEnvelope, stepBack, rectArea, round } from './geometry.js';

/**
 * The massing model.
 *
 * Produces the figures an early feasibility study turns on: buildable
 * footprint, a per-storey area schedule, gross and net floor area, plot ratio,
 * site coverage and overall height — then checks them against the planning
 * limits for the plot.
 *
 * Everything is metric internally. Areas in m², lengths in m.
 */

export const DEFAULT_SCHEME = Object.freeze({
  site: { width: 20, depth: 30, surveyedArea: null },
  setbacks: { front: 5, rear: 3, left: 2, right: 2 },
  storeys: 3,
  floorToFloor: 3.2,
  stepback: { fromStorey: 0, distance: 0 },
  efficiency: 0.82,
  limits: { plotRatio: null, height: null, coverage: null },
});

/**
 * Site area. A surveyed figure wins over width × depth, because an irregular
 * plot has a real area that the rectangle only approximates.
 */
export function siteArea(site) {
  if (Number.isFinite(site.surveyedArea) && site.surveyedArea > 0) {
    return round(site.surveyedArea);
  }
  return round(site.width * site.depth);
}

/**
 * Compute the scheme.
 * @returns {{
 *   siteArea:number, envelope:object, footprint:number, storeys:Array,
 *   gfa:number, nfa:number, plotRatio:number, coverage:number, height:number,
 *   checks:Array, buildable:boolean
 * }}
 */
export function computeScheme(input = {}) {
  const scheme = mergeScheme(input);
  validate(scheme);

  const area = siteArea(scheme.site);
  const envelope = buildableEnvelope(scheme.site, scheme.setbacks);
  const stepped = scheme.stepback.distance > 0
    ? stepBack(envelope, scheme.stepback.distance)
    : envelope;

  const storeys = [];
  for (let level = 1; level <= scheme.storeys; level += 1) {
    const stepsBack = scheme.stepback.distance > 0
      && scheme.stepback.fromStorey > 0
      && level >= scheme.stepback.fromStorey;
    const rect = stepsBack ? stepped : envelope;
    storeys.push({
      level,
      rect,
      area: rectArea(rect),
      steppedBack: stepsBack,
      levelHeight: round((level - 1) * scheme.floorToFloor),
    });
  }

  const gfa = round(storeys.reduce((sum, s) => sum + s.area, 0));
  const footprint = storeys.length ? storeys[0].area : 0;
  const height = round(scheme.storeys * scheme.floorToFloor);

  const result = {
    siteArea: area,
    envelope,
    footprint,
    storeys,
    gfa,
    nfa: round(gfa * scheme.efficiency),
    plotRatio: area > 0 ? round(gfa / area) : 0,
    coverage: area > 0 ? round((footprint / area) * 100) : 0,
    height,
    buildable: envelope.buildable && scheme.storeys > 0,
    scheme,
  };
  result.checks = runChecks(result, scheme.limits);
  return result;
}

/** Compare the scheme against the plot's planning limits. */
export function runChecks(result, limits = {}) {
  const checks = [];
  const add = (label, value, limit, unit, compare = (v, l) => v <= l) => {
    if (!Number.isFinite(limit) || limit <= 0) return;
    checks.push({
      label,
      value,
      limit,
      unit,
      pass: compare(value, limit),
      headroom: round(limit - value),
    });
  };
  add('Plot ratio', result.plotRatio, limits.plotRatio, '');
  add('Building height', result.height, limits.height, 'm');
  add('Site coverage', result.coverage, limits.coverage, '%');
  return checks;
}

/** The largest storey count that still satisfies every limit, or 0 if none does. */
export function maxStoreysWithin(input = {}, ceiling = 60) {
  const scheme = mergeScheme(input);
  let best = 0;
  for (let n = 1; n <= ceiling; n += 1) {
    const trial = computeScheme({ ...scheme, storeys: n });
    if (!trial.buildable) break;
    if (trial.checks.length === 0) { best = n; continue; }
    if (trial.checks.every((c) => c.pass)) best = n;
    else break;
  }
  return best;
}

function mergeScheme(input) {
  return {
    ...DEFAULT_SCHEME,
    ...input,
    site: { ...DEFAULT_SCHEME.site, ...(input.site || {}) },
    setbacks: { ...DEFAULT_SCHEME.setbacks, ...(input.setbacks || {}) },
    stepback: { ...DEFAULT_SCHEME.stepback, ...(input.stepback || {}) },
    limits: { ...DEFAULT_SCHEME.limits, ...(input.limits || {}) },
  };
}

function validate(s) {
  const positive = (v, name) => {
    if (!Number.isFinite(v) || v <= 0) throw new RangeError(`${name} must be a positive number, got ${v}`);
  };
  const nonNegative = (v, name) => {
    if (!Number.isFinite(v) || v < 0) throw new RangeError(`${name} must be zero or more, got ${v}`);
  };
  positive(s.site.width, 'site.width');
  positive(s.site.depth, 'site.depth');
  positive(s.floorToFloor, 'floorToFloor');
  for (const edge of ['front', 'rear', 'left', 'right']) nonNegative(s.setbacks[edge], `setbacks.${edge}`);
  nonNegative(s.stepback.distance, 'stepback.distance');
  if (!Number.isInteger(s.storeys) || s.storeys < 1) {
    throw new RangeError(`storeys must be a whole number of at least 1, got ${s.storeys}`);
  }
  if (!Number.isFinite(s.efficiency) || s.efficiency <= 0 || s.efficiency > 1) {
    throw new RangeError(`efficiency must be between 0 and 1, got ${s.efficiency}`);
  }
}
