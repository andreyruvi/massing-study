import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScheme } from '../src/engine/massing.js';
import { solarPosition } from '../src/engine/sun.js';
import { buildScene, sortFaces, ROLE } from '../src/ui/scene.js';

const EXAMPLE = {
  site: { width: 20, depth: 30, surveyedArea: null },
  setbacks: { front: 5, rear: 3, left: 2, right: 2 },
  storeys: 3,
  floorToFloor: 3.2,
  efficiency: 0.82,
  limits: { plotRatio: 2, height: 12, coverage: 60 },
};

const VIEWPORT = { width: 800, height: 600, padding: 36 };
const result = computeScheme(EXAMPLE);

test('the scene draws the site and the setback line', () => {
  const scene = buildScene(result, VIEWPORT);
  assert.equal(scene.faces.filter((f) => f.role === ROLE.GROUND).length, 1);
  assert.equal(scene.lines.filter((l) => l.role === ROLE.SETBACK).length, 1);
});

test('the north point sits in the sheet corner and follows the camera', () => {
  const front = buildScene(result, VIEWPORT).north;
  assert.ok(front.centre.x < VIEWPORT.width / 2, 'anchored bottom-left');
  assert.ok(front.centre.y > VIEWPORT.height / 2);
  assert.ok(front.tip.y < front.centre.y, 'north points away from a southern camera');

  const behind = buildScene(result, { ...VIEWPORT, view: { azimuth: 0, elevation: 30 } }).north;
  assert.ok(behind.tip.y > behind.centre.y, 'and towards a northern one');
  assert.deepEqual(behind.centre, front.centre, 'the anchor does not move');
});

test('the north point is the same length whichever way it turns', () => {
  for (const azimuth of [0, 45, 135, 210, 315]) {
    const n = buildScene(result, { ...VIEWPORT, view: { azimuth, elevation: 30 } }).north;
    const length = Math.hypot(n.tip.x - n.tail.x, n.tip.y - n.tail.y);
    assert.ok(Math.abs(length - n.radius * 2) < 1e-9, `azimuth ${azimuth}: ${length}`);
  }
});

test('exactly three of a box\'s six faces survive back-face culling', () => {
  const one = computeScheme({ ...EXAMPLE, storeys: 1 });
  const scene = buildScene(one, VIEWPORT);
  const solid = scene.faces.filter((f) => !f.flat);
  assert.equal(solid.length, 3, 'two walls and a roof are visible from an axonometric view');
  assert.equal(solid.filter((f) => f.role === ROLE.ROOF).length, 1);
  assert.equal(solid.filter((f) => f.role === ROLE.WALL).length, 2);
});

test('the default view shows the front and east walls', () => {
  const one = computeScheme({ ...EXAMPLE, storeys: 1 });
  const labels = buildScene(one, VIEWPORT).faces
    .filter((f) => f.role === ROLE.WALL)
    .map((f) => f.label);
  assert.deepEqual(labels.sort(), ['Storey 1 east', 'Storey 1 front']);
});

test('turning the camera changes which walls are visible', () => {
  const one = computeScheme({ ...EXAMPLE, storeys: 1 });
  const scene = buildScene(one, { ...VIEWPORT, view: { azimuth: 315, elevation: 30 } });
  const labels = scene.faces.filter((f) => f.role === ROLE.WALL).map((f) => f.label);
  assert.deepEqual(labels.sort(), ['Storey 1 rear', 'Storey 1 west']);
});

test('the ground plane is painted before any mass', () => {
  const scene = buildScene(result, VIEWPORT);
  assert.equal(scene.faces[0].role, ROLE.GROUND);
  const firstSolid = scene.faces.findIndex((f) => !f.flat);
  assert.ok(scene.faces.slice(0, firstSolid).every((f) => f.flat));
});

test('visible faces are painted from the back of the scene forwards', () => {
  const scene = buildScene(result, VIEWPORT);
  const depths = scene.faces.filter((f) => !f.flat).map((f) => f.depth);
  for (let i = 1; i < depths.length; i += 1) {
    assert.ok(depths[i] >= depths[i - 1], `face ${i} sorts out of order`);
  }
});

test('an upper storey paints after the one below it', () => {
  const scene = buildScene(result, VIEWPORT);
  const roofs = scene.faces.filter((f) => f.role === ROLE.ROOF);
  assert.deepEqual(roofs.map((f) => f.level), [1, 2, 3]);
});

test('the whole scene fits inside the viewport', () => {
  const scene = buildScene(result, VIEWPORT);
  const points = [
    ...scene.faces.flatMap((f) => f.ring),
    ...scene.lines.flatMap((l) => l.ring),
  ];
  for (const p of points) {
    assert.ok(p.x >= -1 && p.x <= VIEWPORT.width + 1, `x out of frame: ${p.x}`);
    assert.ok(p.y >= -1 && p.y <= VIEWPORT.height + 1, `y out of frame: ${p.y}`);
  }
});

test('the shadow is included when the sun is up and sized into the frame', () => {
  const sun = solarPosition({ day: 355, solarHour: 9, latitude: 21.03 });
  assert.equal(sun.up, true);
  const scene = buildScene(result, { ...VIEWPORT, sun });
  assert.equal(scene.hasShadow, true);
  const shadow = scene.faces.find((f) => f.role === ROLE.SHADOW);
  assert.equal(shadow.ring.length, 4);
  assert.equal(shadow.flat, true);
  for (const p of shadow.ring) {
    assert.ok(p.x >= -1 && p.x <= VIEWPORT.width + 1, 'the shadow stays in frame');
  }
});

test('the shadow is dropped when the sun is down', () => {
  const night = solarPosition({ day: 355, solarHour: 2, latitude: 21.03 });
  assert.equal(night.up, false);
  const scene = buildScene(result, { ...VIEWPORT, sun: night });
  assert.equal(scene.hasShadow, false);
  assert.equal(scene.faces.some((f) => f.role === ROLE.SHADOW), false);
});

test('the shadow can be switched off with the sun still up', () => {
  const sun = solarPosition({ day: 355, solarHour: 9, latitude: 21.03 });
  const scene = buildScene(result, { ...VIEWPORT, sun, showShadow: false });
  assert.equal(scene.hasShadow, false);
});

test('an unbuildable plot still draws the site but no mass or setback line', () => {
  const empty = computeScheme({
    ...EXAMPLE,
    site: { width: 8, depth: 30, surveyedArea: null },
    setbacks: { front: 5, rear: 3, left: 4, right: 4 },
  });
  const scene = buildScene(empty, VIEWPORT);
  assert.equal(scene.faces.filter((f) => f.role === ROLE.GROUND).length, 1);
  assert.equal(scene.faces.filter((f) => !f.flat).length, 0);
  assert.equal(scene.lines.filter((l) => l.role === ROLE.SETBACK).length, 0);
});

test('sortFaces drops back faces instead of ordering them', () => {
  const sorted = sortFaces([
    { flat: true, depth: 99, role: 'ground' },
    { facing: -0.5, depth: 1, role: 'wall' },
    { facing: 0.5, depth: 8, role: 'wall' },
    { facing: 0.5, depth: 3, role: 'wall' },
    { facing: 0, depth: 2, role: 'wall' },
  ]);
  assert.deepEqual(sorted.map((f) => f.depth), [99, 3, 8]);
});
