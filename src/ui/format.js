/**
 * Number and text formatting for the readouts.
 *
 * Separated from the DOM because the rounding rules are a real decision — an
 * area schedule that shows 352.0001 m² is wrong even though the arithmetic is
 * right — and they are easier to hold still under test than under inspection.
 */

/**
 * Areas and lengths: at most two decimals, and no trailing zeros.
 *
 * The epsilon nudge matters. A value like 1.005 is held as slightly less than
 * 1.005, so a plain Math.round takes it *down* to 1.00 and the schedule loses
 * a millimetre for no reason the reader can see. Scaling the correction by the
 * magnitude keeps it at the size of the representation error itself.
 */
export function num(value, decimals = 2) {
  if (!Number.isFinite(value)) return '—';
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const nudged = scaled + Math.sign(scaled) * Math.abs(scaled) * Number.EPSILON;
  const rounded = Math.round(nudged) / factor;
  return String(rounded === 0 ? 0 : rounded);
}

export function area(value) {
  return `${num(value, 1)} m²`;
}

export function length(value) {
  return `${num(value, 2)} m`;
}

export function percent(value) {
  return `${num(value, 1)}%`;
}

export function ratio(value) {
  return num(value, 2);
}

/** A signed headroom figure, so a breach reads as a breach. */
export function headroom(value, unit = '') {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${num(value, 2)}${unit ? ` ${unit}` : ''}`;
}

/** 13.5 → "13:30", the way a time-of-day slider should read. */
export function clock(hours) {
  if (!Number.isFinite(hours)) return '—';
  const total = Math.round(((hours % 24) + 24) % 24 * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Day 172 → "21 Jun". Non-leap year, matching the solar model. */
export function dayLabel(day) {
  if (!Number.isFinite(day)) return '—';
  const clamped = Math.min(365, Math.max(1, Math.round(day)));
  let month = 11;
  for (let i = 0; i < 12; i += 1) {
    if (clamped > MONTH_STARTS[i]) month = i;
  }
  return `${clamped - MONTH_STARTS[month]} ${MONTHS[month]}`;
}

/** A compass bearing as a point plus the figure, e.g. "SE 135°". */
export function bearing(degrees) {
  if (!Number.isFinite(degrees)) return '—';
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const normalised = ((degrees % 360) + 360) % 360;
  const point = points[Math.round(normalised / 22.5) % 16];
  return `${point} ${num(normalised, 1)}°`;
}

/** A filename stem that is safe on every platform. */
export function slug(text, fallback = 'massing-study') {
  const cleaned = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned || fallback;
}
