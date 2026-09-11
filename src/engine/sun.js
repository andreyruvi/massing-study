/**
 * Solar position and shadow projection.
 *
 * A feasibility study needs to know where the sun is, not a pretty render of
 * it: the overshadowing a proposal casts onto its neighbours is usually the
 * planning argument. Positions follow the NOAA solar-position equations; the
 * shadow is the building's outline translated along the ground plane.
 *
 * Angles are degrees at the boundary and radians internally. Azimuth is
 * measured clockwise from true north, so 90 is east and 180 is south.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((now - start) / 86400000) + 1;
}

/** Fractional year in radians, the shared term of the NOAA equations. */
function fractionalYear(day, hour = 12) {
  return ((2 * Math.PI) / 365) * (day - 1 + (hour - 12) / 24);
}

/** Solar declination in degrees: +23.44 at the June solstice, -23.44 in December. */
export function solarDeclination(day, hour = 12) {
  const g = fractionalYear(day, hour);
  const d = 0.006918
    - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
    - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  return d * DEG;
}

/** Equation of time in minutes: how far true solar time runs from clock mean time. */
export function equationOfTime(day, hour = 12) {
  const g = fractionalYear(day, hour);
  return 229.18 * (0.000075
    + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
}

/**
 * Sun position from local *solar* time, where 12 is solar noon.
 * Keeping solar time at the boundary makes the geometry independent of
 * timezone and longitude, which is what the tests pin down.
 */
export function solarPosition({ day, solarHour, latitude }) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RangeError(`latitude must be between -90 and 90, got ${latitude}`);
  }
  const dec = solarDeclination(day, solarHour) * RAD;
  const lat = latitude * RAD;
  const hourAngle = (solarHour - 12) * 15 * RAD;

  const sinAlt = Math.sin(lat) * Math.sin(dec)
    + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle);
  const altitude = Math.asin(clamp(sinAlt, -1, 1)) * DEG;

  // Azimuth measured from south, then rotated to a from-north bearing.
  const fromSouth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat),
  ) * DEG;

  return {
    altitude: roundAngle(altitude),
    azimuth: roundAngle((fromSouth + 180 + 360) % 360),
    up: altitude > 0,
  };
}

/** Sun position from wall-clock time, correcting for longitude and the equation of time. */
export function solarPositionFromClock({ date, latitude, longitude, utcOffsetHours }) {
  const day = dayOfYear(date);
  const clockHour = date.getUTCHours() + date.getUTCMinutes() / 60 + utcOffsetHours;
  const offsetMinutes = equationOfTime(day, clockHour) + 4 * longitude - 60 * utcOffsetHours;
  const solarHour = clockHour + offsetMinutes / 60;
  return { ...solarPosition({ day, solarHour, latitude }), solarHour: roundAngle(solarHour), day };
}

/** Ground shadow length for a given height. Infinity when the sun is at or below the horizon. */
export function shadowLength(height, altitudeDeg) {
  if (altitudeDeg <= 0) return Infinity;
  if (altitudeDeg >= 90) return 0;
  return round3(height / Math.tan(altitudeDeg * RAD));
}

/**
 * The ground-plane shadow of a rectangular mass: its plan outline translated
 * away from the sun by the shadow length. Plan axes are x east, y north.
 */
export function shadowOffset(height, sun) {
  if (!sun.up) return null;
  const length = shadowLength(height, sun.altitude);
  if (!Number.isFinite(length)) return null;
  // Shadows fall opposite the sun's bearing.
  const bearing = (sun.azimuth + 180) % 360;
  return {
    length,
    dx: round3(length * Math.sin(bearing * RAD)),
    dy: round3(length * Math.cos(bearing * RAD)),
    bearing: roundAngle(bearing),
  };
}

/** The shadow outline: the footprint corners plus the same corners translated. */
export function shadowPolygon(corners, height, sun) {
  const offset = shadowOffset(height, sun);
  if (!offset) return null;
  return corners.map((p) => ({ x: round3(p.x + offset.dx), y: round3(p.y + offset.dy) }));
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// Both rounders normalise negative zero; a shadow offset of "-0" metres is
// only confusing, and it survives into the OBJ and CSV exports.
function roundAngle(v) { const r = Math.round(v * 100) / 100; return r === 0 ? 0 : r; }
function round3(v) { const r = Math.round(v * 1000) / 1000; return r === 0 ? 0 : r; }
