/**
 * The form.
 *
 * Reads a scheme out of the inputs and writes one back into them. Kept apart
 * from the model so the numbers are validated in one place — a blank field
 * means "not set", which is different from zero for a planning limit and the
 * same as zero for a setback.
 */

import { DEFAULT_SCHEME } from '../engine/massing.js';
import { DEFAULT_VIEW } from './projection.js';

export const DEFAULT_SUN = Object.freeze({
  enabled: true,
  day: 355, // the December solstice: the worst case for overshadowing in the north
  solarHour: 10,
  latitude: 21.03,
});

/** A blank or unparseable field reads as null, not as zero. */
export function readNumber(input) {
  if (!input) return null;
  const text = input.value.trim();
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** A setback or other field where blank sensibly means zero. */
function readOrZero(input) {
  const value = readNumber(input);
  return value === null ? 0 : value;
}

function readOr(input, fallback) {
  const value = readNumber(input);
  return value === null ? fallback : value;
}

export function createControls(form, { onChange }) {
  const field = (name) => form.elements.namedItem(name);

  function readState() {
    return {
      name: (field('name')?.value || '').trim(),
      scheme: {
        site: {
          width: readOr(field('siteWidth'), DEFAULT_SCHEME.site.width),
          depth: readOr(field('siteDepth'), DEFAULT_SCHEME.site.depth),
          surveyedArea: readNumber(field('surveyedArea')),
        },
        setbacks: {
          front: readOrZero(field('setbackFront')),
          rear: readOrZero(field('setbackRear')),
          left: readOrZero(field('setbackLeft')),
          right: readOrZero(field('setbackRight')),
        },
        storeys: Math.max(1, Math.round(readOr(field('storeys'), DEFAULT_SCHEME.storeys))),
        floorToFloor: readOr(field('floorToFloor'), DEFAULT_SCHEME.floorToFloor),
        stepback: {
          fromStorey: Math.max(0, Math.round(readOrZero(field('stepbackFrom')))),
          distance: readOrZero(field('stepbackDistance')),
        },
        // Entered as a percentage, held as a fraction.
        efficiency: clamp(readOr(field('efficiency'), 82) / 100, 0.01, 1),
        limits: {
          plotRatio: readNumber(field('limitPlotRatio')),
          height: readNumber(field('limitHeight')),
          coverage: readNumber(field('limitCoverage')),
        },
      },
      view: {
        azimuth: readOr(field('viewAzimuth'), DEFAULT_VIEW.azimuth),
        elevation: clamp(readOr(field('viewElevation'), DEFAULT_VIEW.elevation), 5, 90),
      },
      sun: {
        enabled: Boolean(field('sunEnabled')?.checked),
        day: Math.round(readOr(field('sunDay'), DEFAULT_SUN.day)),
        solarHour: readOr(field('sunHour'), DEFAULT_SUN.solarHour),
        latitude: clamp(readOr(field('latitude'), DEFAULT_SUN.latitude), -66, 66),
      },
    };
  }

  /** Push a state object back into the form, for presets and for reset. */
  function writeState(state) {
    const set = (name, value) => {
      const node = field(name);
      if (!node) return;
      node.value = value === null || value === undefined ? '' : String(value);
    };
    const { scheme = {}, view = {}, sun = {} } = state;
    const site = scheme.site || {};
    const setbacks = scheme.setbacks || {};
    const stepback = scheme.stepback || {};
    const limits = scheme.limits || {};

    set('name', state.name ?? '');
    set('siteWidth', site.width ?? DEFAULT_SCHEME.site.width);
    set('siteDepth', site.depth ?? DEFAULT_SCHEME.site.depth);
    set('surveyedArea', site.surveyedArea ?? null);
    set('setbackFront', setbacks.front ?? DEFAULT_SCHEME.setbacks.front);
    set('setbackRear', setbacks.rear ?? DEFAULT_SCHEME.setbacks.rear);
    set('setbackLeft', setbacks.left ?? DEFAULT_SCHEME.setbacks.left);
    set('setbackRight', setbacks.right ?? DEFAULT_SCHEME.setbacks.right);
    set('storeys', scheme.storeys ?? DEFAULT_SCHEME.storeys);
    set('floorToFloor', scheme.floorToFloor ?? DEFAULT_SCHEME.floorToFloor);
    set('stepbackFrom', stepback.fromStorey ?? 0);
    set('stepbackDistance', stepback.distance ?? 0);
    set('efficiency', Math.round((scheme.efficiency ?? DEFAULT_SCHEME.efficiency) * 100));
    set('limitPlotRatio', limits.plotRatio ?? null);
    set('limitHeight', limits.height ?? null);
    set('limitCoverage', limits.coverage ?? null);
    set('viewAzimuth', view.azimuth ?? DEFAULT_VIEW.azimuth);
    set('viewElevation', view.elevation ?? DEFAULT_VIEW.elevation);
    set('sunDay', sun.day ?? DEFAULT_SUN.day);
    set('sunHour', sun.solarHour ?? DEFAULT_SUN.solarHour);
    set('latitude', sun.latitude ?? DEFAULT_SUN.latitude);
    const sunToggle = field('sunEnabled');
    if (sunToggle) sunToggle.checked = sun.enabled ?? DEFAULT_SUN.enabled;
  }

  // `input` covers typing, dragging a range and stepping a number in one event.
  form.addEventListener('input', () => onChange(readState()));
  form.addEventListener('change', () => onChange(readState()));
  form.addEventListener('submit', (event) => event.preventDefault());

  return { readState, writeState };
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}
