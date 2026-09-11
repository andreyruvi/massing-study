import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dayOfYear, solarDeclination, equationOfTime, solarPosition,
  solarPositionFromClock, shadowLength, shadowOffset, shadowPolygon,
} from '../src/engine/sun.js';

const near = (actual, expected, tolerance, message) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    message || `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test('dayOfYear counts from 1 January', () => {
  assert.equal(dayOfYear(new Date('2026-01-01T00:00:00Z')), 1);
  assert.equal(dayOfYear(new Date('2026-03-20T00:00:00Z')), 79);
  assert.equal(dayOfYear(new Date('2026-12-31T00:00:00Z')), 365);
});

test('dayOfYear accounts for a leap day', () => {
  assert.equal(dayOfYear(new Date('2024-03-01T00:00:00Z')), 61);
  assert.equal(dayOfYear(new Date('2024-12-31T00:00:00Z')), 366);
});

test('solar declination is near zero at the equinoxes', () => {
  near(solarDeclination(79), 0, 1, 'March equinox');
  near(solarDeclination(266), 0, 1, 'September equinox');
});

test('solar declination reaches the tropics at the solstices', () => {
  near(solarDeclination(172), 23.44, 0.2, 'June solstice');
  near(solarDeclination(355), -23.44, 0.2, 'December solstice');
});

test('the equation of time stays inside its known envelope', () => {
  for (let day = 1; day <= 365; day += 1) {
    const eot = equationOfTime(day);
    assert.ok(Math.abs(eot) < 17, `equation of time out of range on day ${day}: ${eot}`);
  }
  // Early November is the annual maximum, mid-February the minimum.
  assert.ok(equationOfTime(310) > 14);
  assert.ok(equationOfTime(42) < -13);
});

test('the sun is overhead at the equator at equinox solar noon', () => {
  const sun = solarPosition({ day: 79, solarHour: 12, latitude: 0 });
  near(sun.altitude, 90, 0.5);
  assert.equal(sun.up, true);
});

test('the sun is overhead on the Tropic of Cancer at the June solstice', () => {
  const sun = solarPosition({ day: 172, solarHour: 12, latitude: 23.44 });
  near(sun.altitude, 90, 0.1);
});

test('solar noon altitude follows the 90 - latitude + declination rule', () => {
  // Hanoi, 21.03 N, at the December solstice.
  const sun = solarPosition({ day: 355, solarHour: 12, latitude: 21.03 });
  near(sun.altitude, 90 - 21.03 + solarDeclination(355), 0.1);
  assert.equal(sun.azimuth, 180, 'the sun is due south at noon in the northern hemisphere');
});

test('the sun is due north at noon in the southern hemisphere', () => {
  const sun = solarPosition({ day: 355, solarHour: 12, latitude: -33.87 }); // Sydney
  assert.equal(sun.azimuth, 0);
  near(sun.altitude, 90 - Math.abs(-33.87 - solarDeclination(355)), 0.1);
});

test('the sun rises close to due east at the equinox', () => {
  const sun = solarPosition({ day: 79, solarHour: 6, latitude: 0 });
  near(sun.altitude, 0, 0.5);
  near(sun.azimuth, 90, 1.5);
});

test('the sun sets close to due west at the equinox', () => {
  const sun = solarPosition({ day: 79, solarHour: 18, latitude: 0 });
  near(sun.altitude, 0, 0.5);
  near(sun.azimuth, 270, 1.5);
});

test('the morning sun is east of south and the afternoon sun west of south', () => {
  const morning = solarPosition({ day: 172, solarHour: 9, latitude: 21.03 });
  const afternoon = solarPosition({ day: 172, solarHour: 15, latitude: 21.03 });
  assert.ok(morning.azimuth < 180, `morning azimuth ${morning.azimuth}`);
  assert.ok(afternoon.azimuth > 180, `afternoon azimuth ${afternoon.azimuth}`);
  near(morning.altitude, afternoon.altitude, 0.5, 'the day is symmetric about noon');
});

test('the sun is down at midnight', () => {
  const sun = solarPosition({ day: 172, solarHour: 0, latitude: 21.03 });
  assert.ok(sun.altitude < 0, `altitude ${sun.altitude}`);
  assert.equal(sun.up, false);
});

test('polar night keeps the sun below the horizon all day', () => {
  for (let h = 0; h <= 24; h += 2) {
    const sun = solarPosition({ day: 355, solarHour: h, latitude: 78 });
    assert.equal(sun.up, false, `sun up at hour ${h}`);
  }
});

test('solarPosition rejects an impossible latitude', () => {
  assert.throws(() => solarPosition({ day: 1, solarHour: 12, latitude: 120 }), RangeError);
  assert.throws(() => solarPosition({ day: 1, solarHour: 12, latitude: NaN }), RangeError);
});

test('solarPositionFromClock corrects clock time towards solar time', () => {
  // Hanoi: 105.85 E, UTC+7. Local noon runs a few minutes off solar noon.
  const sun = solarPositionFromClock({
    date: new Date('2026-06-21T05:00:00Z'), // 12:00 local
    latitude: 21.03,
    longitude: 105.85,
    utcOffsetHours: 7,
  });
  near(sun.solarHour, 12, 0.4);
  assert.equal(sun.day, 172);
  near(sun.altitude, 87.5, 1.5);
});

test('shadow length equals the height when the sun sits at 45 degrees', () => {
  assert.equal(shadowLength(10, 45), 10);
  assert.equal(shadowLength(9.6, 45), 9.6);
});

test('shadow length grows as the sun drops', () => {
  assert.ok(shadowLength(10, 20) > shadowLength(10, 45));
  near(shadowLength(10, 30), 17.321, 0.001);
});

test('a sun at the horizon or below casts no finite shadow', () => {
  assert.equal(shadowLength(10, 0), Infinity);
  assert.equal(shadowLength(10, -5), Infinity);
});

test('a sun directly overhead casts no shadow', () => {
  assert.equal(shadowLength(10, 90), 0);
});

test('shadowOffset throws the shadow away from the sun', () => {
  // Sun due south at 45 degrees: the shadow runs due north, +y in plan.
  const offset = shadowOffset(10, { altitude: 45, azimuth: 180, up: true });
  assert.equal(offset.length, 10);
  assert.equal(offset.bearing, 0);
  assert.equal(offset.dx, 0);
  assert.equal(offset.dy, 10);
});

test('shadowOffset runs west for an eastern sun', () => {
  const offset = shadowOffset(10, { altitude: 45, azimuth: 90, up: true });
  assert.equal(offset.bearing, 270);
  assert.equal(offset.dx, -10);
  assert.equal(offset.dy, 0);
});

test('shadowOffset returns nothing when the sun is down', () => {
  assert.equal(shadowOffset(10, { altitude: -3, azimuth: 90, up: false }), null);
});

test('shadowPolygon translates the footprint outline', () => {
  const corners = [{ x: 2, y: 5 }, { x: 18, y: 5 }, { x: 18, y: 27 }, { x: 2, y: 27 }];
  const shadow = shadowPolygon(corners, 10, { altitude: 45, azimuth: 180, up: true });
  assert.deepEqual(shadow, [
    { x: 2, y: 15 }, { x: 18, y: 15 }, { x: 18, y: 37 }, { x: 2, y: 37 },
  ]);
});

test('shadowPolygon returns nothing at night', () => {
  const corners = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  assert.equal(shadowPolygon(corners, 10, { altitude: -10, azimuth: 0, up: false }), null);
});
