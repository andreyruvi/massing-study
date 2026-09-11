import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VIEW, viewBasis, project, fitToViewport, applyFit, projectFace, dot,
} from '../src/ui/projection.js';

const near = (actual, expected, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test('the basis vectors are unit length and mutually perpendicular', () => {
  for (const azimuth of [0, 45, 135, 200, 315]) {
    for (const elevation of [10, 30, 60]) {
      const b = viewBasis({ azimuth, elevation });
      near(dot(b.right, b.right), 1, 1e-12);
      near(dot(b.up, b.up), 1, 1e-12);
      near(dot(b.toViewer, b.toViewer), 1, 1e-12);
      near(dot(b.right, b.up), 0, 1e-12);
      near(dot(b.right, b.toViewer), 0, 1e-12);
      near(dot(b.up, b.toViewer), 0, 1e-12);
    }
  }
});

test('a camera due north sees east on the left and up as up', () => {
  const b = viewBasis({ azimuth: 0, elevation: 30 });
  // Standing to the north looking south, your right hand points west.
  near(project({ x: 1, y: 0, z: 0 }, b).x, -1);
  // Height always projects towards the top of the screen.
  assert.ok(project({ x: 0, y: 0, z: 1 }, b).y < 0);
});

test('the default view puts both east and north towards the right', () => {
  const b = viewBasis(DEFAULT_VIEW);
  assert.ok(project({ x: 1, y: 0, z: 0 }, b).x > 0, 'east goes right');
  assert.ok(project({ x: 0, y: 1, z: 0 }, b).x > 0, 'north goes right');
});

test('the default view puts distant points higher up the screen', () => {
  const b = viewBasis(DEFAULT_VIEW);
  const near_ = project({ x: 0, y: 0, z: 0 }, b);
  const far = project({ x: 0, y: 20, z: 0 }, b);
  assert.ok(far.y < near_.y, 'the far edge of the site draws above the near edge');
  assert.ok(far.depth < near_.depth, 'and sorts behind it');
});

test('depth increases towards the camera', () => {
  const b = viewBasis({ azimuth: 180, elevation: 30 }); // camera due south
  const south = project({ x: 0, y: -10, z: 0 }, b);
  const north = project({ x: 0, y: 10, z: 0 }, b);
  assert.ok(south.depth > north.depth);
  assert.ok(project({ x: 0, y: 0, z: 10 }, b).depth > project({ x: 0, y: 0, z: 0 }, b).depth);
});

test('the projection is parallel: equal world lengths stay equal on screen', () => {
  const b = viewBasis(DEFAULT_VIEW);
  const length = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
  const a = length(project({ x: 0, y: 0, z: 0 }, b), project({ x: 0, y: 0, z: 5 }, b));
  const c = length(project({ x: 40, y: 60, z: 12 }, b), project({ x: 40, y: 60, z: 17 }, b));
  near(a, c, 1e-9);
});

test('a vertical line stays vertical on screen', () => {
  const b = viewBasis(DEFAULT_VIEW);
  const base = project({ x: 7, y: 3, z: 0 }, b);
  const top = project({ x: 7, y: 3, z: 9.6 }, b);
  near(top.x, base.x);
});

test('an elevation of 90 degrees gives a plan view with no height on screen', () => {
  const b = viewBasis({ azimuth: 0, elevation: 90 });
  const ground = project({ x: 4, y: 6, z: 0 }, b);
  const roof = project({ x: 4, y: 6, z: 30 }, b);
  near(roof.x, ground.x);
  near(roof.y, ground.y);
});

test('fitToViewport centres the drawing', () => {
  const fit = fitToViewport(
    [{ x: -10, y: -10 }, { x: 10, y: 10 }],
    { width: 400, height: 400, padding: 0 },
  );
  assert.equal(fit.scale, 20);
  const middle = applyFit({ x: 0, y: 0 }, fit);
  assert.equal(middle.x, 200);
  assert.equal(middle.y, 200);
});

test('fitToViewport keeps the aspect ratio by using the tighter axis', () => {
  const fit = fitToViewport(
    [{ x: 0, y: 0 }, { x: 100, y: 10 }],
    { width: 400, height: 400, padding: 0 },
  );
  assert.equal(fit.scale, 4, 'the wide axis is the binding one');
  const corner = applyFit({ x: 100, y: 10 }, fit);
  assert.equal(corner.x, 400);
  assert.equal(corner.y, 220);
});

test('fitToViewport honours the padding', () => {
  const fit = fitToViewport(
    [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    { width: 300, height: 300, padding: 50 },
  );
  assert.equal(fit.scale, 2);
  const origin = applyFit({ x: 0, y: 0 }, fit);
  assert.equal(origin.x, 50);
  assert.equal(origin.y, 50);
});

test('fitToViewport survives degenerate input', () => {
  const empty = fitToViewport([], { width: 200, height: 100 });
  assert.equal(empty.scale, 1);
  assert.equal(empty.offsetX, 100);
  const single = fitToViewport([{ x: 5, y: 5 }], { width: 200, height: 100, padding: 0 });
  assert.equal(single.scale, 1);
  const centred = applyFit({ x: 5, y: 5 }, single);
  assert.equal(centred.x, 100);
  assert.equal(centred.y, 50);
});

test('projectFace culls a face that turns away from the camera', () => {
  const basis = viewBasis({ azimuth: 180, elevation: 30 }); // camera due south
  const fit = { scale: 1, offsetX: 0, offsetY: 0 };
  const south = projectFace(
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }],
    { x: 0, y: -1, z: 0 },
    basis,
    fit,
  );
  const north = projectFace(
    [{ x: 0, y: 5, z: 0 }, { x: 1, y: 5, z: 0 }, { x: 1, y: 5, z: 1 }, { x: 0, y: 5, z: 1 }],
    { x: 0, y: 1, z: 0 },
    basis,
    fit,
  );
  assert.ok(south.facing > 0, 'the south face is visible to a southern camera');
  assert.ok(north.facing < 0, 'the north face is hidden');
  assert.equal(south.ring.length, 4);
});

test('projectFace reports the mean depth of its ring', () => {
  const basis = viewBasis(DEFAULT_VIEW);
  const fit = { scale: 1, offsetX: 0, offsetY: 0 };
  const face = projectFace(
    [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 2, y: 2, z: 0 }, { x: 0, y: 2, z: 0 }],
    { x: 0, y: 0, z: 1 },
    basis,
    fit,
  );
  const mean = face.ring.reduce((s, p) => s + p.depth, 0) / 4;
  near(face.depth, mean);
});

test('projectFace treats a face with no normal as visible', () => {
  const basis = viewBasis(DEFAULT_VIEW);
  const face = projectFace(
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }],
    null,
    basis,
    { scale: 1, offsetX: 0, offsetY: 0 },
  );
  assert.equal(face.facing, 1);
});
