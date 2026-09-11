import test from 'node:test';
import assert from 'node:assert/strict';
import {
  polygonArea, buildableEnvelope, stepBack, rectArea, rectCorners, round,
} from '../src/engine/geometry.js';

test('polygonArea measures a unit square', () => {
  assert.equal(polygonArea([
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
  ]), 1);
});

test('polygonArea ignores winding direction', () => {
  const points = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
  assert.equal(polygonArea(points), 12);
  assert.equal(polygonArea([...points].reverse()), 12);
});

test('polygonArea measures an L-shaped plot', () => {
  // A 10x10 square with a 4x4 bite out of one corner: 100 - 16 = 84.
  assert.equal(polygonArea([
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 },
    { x: 6, y: 6 }, { x: 6, y: 10 }, { x: 0, y: 10 },
  ]), 84);
});

test('polygonArea returns zero for degenerate input', () => {
  assert.equal(polygonArea([]), 0);
  assert.equal(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 1 }]), 0);
  assert.equal(polygonArea(null), 0);
});

test('buildableEnvelope subtracts each setback from its own edge', () => {
  const envelope = buildableEnvelope(
    { width: 20, depth: 30 },
    { front: 5, rear: 3, left: 2, right: 2 },
  );
  assert.deepEqual(envelope, {
    width: 16, depth: 22, offsetX: 2, offsetY: 5, buildable: true,
  });
  assert.equal(rectArea(envelope), 352);
});

test('buildableEnvelope reports an unbuildable plot rather than a negative one', () => {
  const envelope = buildableEnvelope(
    { width: 8, depth: 30 },
    { front: 5, rear: 3, left: 5, right: 5 },
  );
  assert.equal(envelope.width, 0);
  assert.equal(envelope.buildable, false);
  assert.equal(rectArea(envelope), 0);
});

test('buildableEnvelope treats a plot exactly consumed by setbacks as unbuildable', () => {
  const envelope = buildableEnvelope(
    { width: 10, depth: 10 },
    { front: 5, rear: 5, left: 0, right: 0 },
  );
  assert.equal(envelope.depth, 0);
  assert.equal(envelope.buildable, false);
});

test('stepBack shrinks on all four sides and moves the corner inwards', () => {
  const base = { width: 16, depth: 22, offsetX: 2, offsetY: 5 };
  assert.deepEqual(stepBack(base, 1.5), {
    width: 13, depth: 19, offsetX: 3.5, offsetY: 6.5, buildable: true,
  });
});

test('stepBack cannot produce a negative rectangle', () => {
  const stepped = stepBack({ width: 4, depth: 20, offsetX: 0, offsetY: 0 }, 3);
  assert.equal(stepped.width, 0);
  assert.equal(stepped.buildable, false);
});

test('rectCorners walks the rectangle from the near-left corner', () => {
  assert.deepEqual(rectCorners({ width: 16, depth: 22, offsetX: 2, offsetY: 5 }), [
    { x: 2, y: 5 }, { x: 18, y: 5 }, { x: 18, y: 27 }, { x: 2, y: 27 },
  ]);
});

test('rectCorners and polygonArea agree with rectArea', () => {
  const rect = { width: 12.5, depth: 8.4, offsetX: 3, offsetY: 1 };
  assert.equal(polygonArea(rectCorners(rect)), rectArea(rect));
});

test('round keeps millimetre precision', () => {
  assert.equal(round(1.23456), 1.235);
  assert.equal(round(12), 12);
});

test('round never returns negative zero', () => {
  assert.equal(round(-0.0004), 0);
  assert.ok(!Object.is(round(-0.0004), -0), 'a "-0" readout is a bug, not a value');
  assert.equal(round(-0), 0);
});
