import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScheme } from '../src/engine/massing.js';
import { toOBJ, toCSV, toPreset, fromPreset } from '../src/engine/exporters.js';

const EXAMPLE = {
  site: { width: 20, depth: 30, surveyedArea: null },
  setbacks: { front: 5, rear: 3, left: 2, right: 2 },
  storeys: 3,
  floorToFloor: 3.2,
  efficiency: 0.82,
  limits: { plotRatio: 2, height: 12, coverage: 60 },
};

const result = computeScheme(EXAMPLE);

test('the OBJ carries one group and eight vertices per storey', () => {
  const obj = toOBJ(result);
  const lines = obj.split('\n');
  assert.equal(lines.filter((l) => l.startsWith('g ')).length, 3);
  assert.equal(lines.filter((l) => l.startsWith('v ')).length, 24);
  assert.equal(lines.filter((l) => l.startsWith('f ')).length, 18); // 6 faces x 3
  assert.deepEqual(
    lines.filter((l) => l.startsWith('g ')),
    ['g storey_1', 'g storey_2', 'g storey_3'],
  );
});

test('the OBJ places the ground floor on the envelope with north as negative Z', () => {
  const obj = toOBJ(result);
  const vertices = obj.split('\n').filter((l) => l.startsWith('v '));
  // Envelope 16 x 22 offset 2 east, 5 north of the front boundary.
  assert.equal(vertices[0], 'v 2.0 0.0 -5.0');
  assert.equal(vertices[1], 'v 18.0 0.0 -5.0');
  assert.equal(vertices[2], 'v 18.0 0.0 -27.0');
  assert.equal(vertices[3], 'v 2.0 0.0 -27.0');
  // The ceiling of the ground floor sits at the floor-to-floor height.
  assert.equal(vertices[4], 'v 2.0 3.2 -5.0');
});

test('OBJ face indices are one-based and never reused across storeys', () => {
  const obj = toOBJ(result);
  const faces = obj.split('\n').filter((l) => l.startsWith('f '))
    .map((l) => l.slice(2).split(' ').map(Number));
  const all = faces.flat();
  assert.equal(Math.min(...all), 1);
  assert.equal(Math.max(...all), 24);
  // The first storey uses 1-8, the second 9-16, the third 17-24.
  assert.deepEqual(faces[0], [1, 4, 3, 2]);
  assert.deepEqual(faces[6], [9, 12, 11, 10]);
  assert.deepEqual(faces[12], [17, 20, 19, 18]);
});

test('every OBJ vertex appears in at least three faces, so the mass is closed', () => {
  const obj = toOBJ(result);
  const counts = new Map();
  for (const line of obj.split('\n').filter((l) => l.startsWith('f '))) {
    for (const index of line.slice(2).split(' ').map(Number)) {
      counts.set(index, (counts.get(index) || 0) + 1);
    }
  }
  assert.equal(counts.size, 24);
  for (const [index, count] of counts) {
    assert.equal(count, 3, `vertex ${index} used ${count} times`);
  }
});

test('the OBJ header records the scheme it came from', () => {
  const obj = toOBJ(result, { name: 'plot-12' });
  assert.ok(obj.startsWith('# plot-12\n'));
  assert.match(obj, /Site area 600 m2, GFA 1056 m2, height 9\.6 m/);
  assert.match(obj, /Units: metres\. Y up, X east, Z south\./);
});

test('the OBJ reflects a stepback in the upper storeys', () => {
  const stepped = computeScheme({ ...EXAMPLE, storeys: 3, stepback: { fromStorey: 3, distance: 2 } });
  const vertices = toOBJ(stepped).split('\n').filter((l) => l.startsWith('v '));
  // Third storey starts at vertex 17 (index 16): 12 x 18 offset 4 / 7.
  assert.equal(vertices[16], 'v 4.0 6.4 -7.0');
  assert.equal(vertices[17], 'v 16.0 6.4 -7.0');
  assert.equal(vertices[18], 'v 16.0 6.4 -25.0');
});

test('an unbuildable scheme exports a header but no geometry', () => {
  const empty = computeScheme({
    ...EXAMPLE,
    site: { width: 8, depth: 30, surveyedArea: null },
    setbacks: { front: 5, rear: 3, left: 4, right: 4 },
  });
  const obj = toOBJ(empty);
  assert.equal(obj.split('\n').filter((l) => l.startsWith('v ')).length, 0);
  assert.match(obj, /Site area 240 m2/);
});

test('the CSV opens with the storey schedule', () => {
  const rows = toCSV(result).trim().split('\n');
  assert.equal(rows[0], 'Level,Width (m),Depth (m),Floor area (m2),Stepped back,Level height (m)');
  assert.equal(rows[1], '1,16,22,352,no,0');
  assert.equal(rows[2], '2,16,22,352,no,3.2');
  assert.equal(rows[3], '3,16,22,352,no,6.4');
});

test('the CSV totals match the computed scheme', () => {
  const csv = toCSV(result);
  assert.match(csv, /^Site area,600,m2$/m);
  assert.match(csv, /^Footprint,352,m2$/m);
  assert.match(csv, /^Gross floor area,1056,m2$/m);
  assert.match(csv, /^Net floor area,865\.92,m2$/m);
  assert.match(csv, /^Plot ratio,1\.76,$/m);
  assert.match(csv, /^Site coverage,58\.667,%$/m);
  assert.match(csv, /^Building height,9\.6,m$/m);
});

test('the CSV quotes a cell that contains a comma', () => {
  const csv = toCSV(result);
  assert.match(csv, /^Buildable envelope,16 x 22,m$/m);
  const quoted = toCSV({
    ...result,
    checks: [{ label: 'Height, absolute', value: 9.6, limit: 12, headroom: 2.4, pass: true }],
  });
  assert.match(quoted, /^"Height, absolute",9\.6,12,2\.4,PASS$/m);
});

test('the CSV records each planning check and its verdict', () => {
  const csv = toCSV(result);
  assert.match(csv, /^Check,Value,Limit,Headroom,Result$/m);
  assert.match(csv, /^Plot ratio,1\.76,2,0\.24,PASS$/m);
  const failing = toCSV(computeScheme({ ...EXAMPLE, storeys: 5 }));
  assert.match(failing, /^Building height,16,12,-4,FAIL$/m);
});

test('the CSV omits the checks block when no limits are set', () => {
  const csv = toCSV(computeScheme({ ...EXAMPLE, limits: {} }));
  assert.ok(!csv.includes('Check,Value,Limit'));
});

test('a preset round-trips back into the same scheme', () => {
  const text = toPreset(result, { name: 'Plot 12', saved: '2026-09-11' });
  const { name, scheme } = fromPreset(text);
  assert.equal(name, 'Plot 12');
  const again = computeScheme(scheme);
  assert.equal(again.gfa, result.gfa);
  assert.equal(again.plotRatio, result.plotRatio);
  assert.deepEqual(again.storeys.map((s) => s.area), result.storeys.map((s) => s.area));
});

test('a preset stores inputs only, not computed outputs', () => {
  const data = JSON.parse(toPreset(result));
  assert.equal(data.format, 'massing-study/preset');
  assert.equal(data.version, 1);
  assert.deepEqual(Object.keys(data.scheme).sort(), [
    'efficiency', 'floorToFloor', 'limits', 'setbacks', 'site', 'stepback', 'storeys',
  ]);
  assert.ok(!('gfa' in data.scheme));
});

test('a preset defaults its name when none is given', () => {
  assert.equal(fromPreset(toPreset(result)).name, 'Untitled study');
});

test('fromPreset refuses anything that is not a preset', () => {
  assert.throws(() => fromPreset('{"format":"something-else","version":1}'), TypeError);
  assert.throws(() => fromPreset('{"format":"massing-study/preset","version":9}'), TypeError);
  assert.throws(() => fromPreset('{"format":"massing-study/preset","version":1}'), TypeError);
  assert.throws(() => fromPreset('not json'), SyntaxError);
});
