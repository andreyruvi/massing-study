import test from 'node:test';
import assert from 'node:assert/strict';
import {
  num, area, length, percent, ratio, headroom, clock, dayLabel, bearing, slug,
} from '../src/ui/format.js';

test('num drops trailing zeros and float noise', () => {
  assert.equal(num(352), '352');
  assert.equal(num(352.0001), '352');
  assert.equal(num(58.667, 1), '58.7');
  assert.equal(num(1.005, 2), '1.01');
});

test('num never prints negative zero', () => {
  assert.equal(num(-0.0001), '0');
  assert.equal(num(-0), '0');
});

test('num marks a missing figure rather than printing NaN', () => {
  assert.equal(num(NaN), '—');
  assert.equal(num(Infinity), '—');
  assert.equal(num(null), '—');
  assert.equal(num(undefined), '—');
});

test('the unit formatters carry their units', () => {
  assert.equal(area(352), '352 m²');
  assert.equal(area(865.92), '865.9 m²');
  assert.equal(length(9.6), '9.6 m');
  assert.equal(percent(58.667), '58.7%');
  assert.equal(ratio(1.76), '1.76');
});

test('headroom shows the sign so a breach reads as one', () => {
  assert.equal(headroom(0.24), '+0.24');
  assert.equal(headroom(-4, 'm'), '-4 m');
  assert.equal(headroom(0, 'm'), '0 m');
  assert.equal(headroom(NaN), '—');
});

test('clock formats a fractional hour', () => {
  assert.equal(clock(13.5), '13:30');
  assert.equal(clock(9), '09:00');
  assert.equal(clock(0), '00:00');
  assert.equal(clock(6.25), '06:15');
});

test('clock wraps around midnight in both directions', () => {
  assert.equal(clock(24), '00:00');
  assert.equal(clock(25.5), '01:30');
  assert.equal(clock(-1), '23:00');
});

test('dayLabel names the solstices and equinoxes correctly', () => {
  assert.equal(dayLabel(1), '1 Jan');
  assert.equal(dayLabel(79), '20 Mar');
  assert.equal(dayLabel(172), '21 Jun');
  assert.equal(dayLabel(266), '23 Sep');
  assert.equal(dayLabel(355), '21 Dec');
  assert.equal(dayLabel(365), '31 Dec');
});

test('dayLabel gets each month boundary right', () => {
  assert.equal(dayLabel(31), '31 Jan');
  assert.equal(dayLabel(32), '1 Feb');
  assert.equal(dayLabel(59), '28 Feb');
  assert.equal(dayLabel(60), '1 Mar');
  assert.equal(dayLabel(334), '30 Nov');
  assert.equal(dayLabel(335), '1 Dec');
});

test('dayLabel clamps out-of-range days', () => {
  assert.equal(dayLabel(0), '1 Jan');
  assert.equal(dayLabel(400), '31 Dec');
  assert.equal(dayLabel(NaN), '—');
});

test('bearing names the compass point', () => {
  assert.equal(bearing(0), 'N 0°');
  assert.equal(bearing(90), 'E 90°');
  assert.equal(bearing(135), 'SE 135°');
  assert.equal(bearing(180), 'S 180°');
  assert.equal(bearing(247.5), 'WSW 247.5°');
});

test('bearing wraps a full turn back to north', () => {
  assert.equal(bearing(360), 'N 0°');
  assert.equal(bearing(359), 'N 359°');
  assert.equal(bearing(-90), 'W 270°');
});

test('slug makes a safe filename stem', () => {
  assert.equal(slug('Plot 12, Nguyen Trai'), 'plot-12-nguyen-trai');
  assert.equal(slug('  ---  '), 'massing-study');
  assert.equal(slug(''), 'massing-study');
  assert.equal(slug(null), 'massing-study');
  assert.equal(slug('a'.repeat(90)).length, 60);
});
