/**
 * Exporters.
 *
 * A feasibility study is a step in a drawing set, not the end of one, so the
 * scheme has to leave this tool in shapes the next tool reads: a Wavefront OBJ
 * mass to pull into Revit, SketchUp or 3ds Max, a CSV area schedule to paste
 * into a report, and a JSON preset to reload the study later.
 *
 * Coordinate convention for OBJ: metres, Y up, X east, Z south — that is, plan
 * north (+y) becomes -Z. This is the convention SketchUp and 3ds Max import
 * with no axis flipping, and it keeps the model the right way up in Revit's
 * "Import CAD" as well.
 */

const NL = '\n';

/**
 * One extruded box per storey, welded into a single OBJ file with a group per
 * level so the storeys stay selectable after import.
 */
export function toOBJ(result, options = {}) {
  const name = options.name || 'massing-study';
  const lines = [
    `# ${name}`,
    '# Massing study export. Units: metres. Y up, X east, Z south.',
    `# Site area ${result.siteArea} m2, GFA ${result.gfa} m2, height ${result.height} m`,
    `# Storeys: ${result.storeys.length}`,
  ];

  const f2f = result.scheme.floorToFloor;
  let vertexBase = 0;

  for (const storey of result.storeys) {
    const { rect, level, levelHeight } = storey;
    if (!(rect.width > 0 && rect.depth > 0)) continue;

    const x0 = rect.offsetX;
    const x1 = rect.offsetX + rect.width;
    const y0 = rect.offsetY;
    const y1 = rect.offsetY + rect.depth;
    const zBottom = levelHeight;
    const zTop = round3(levelHeight + f2f);

    // Eight corners: 1-4 the floor slab anticlockwise, 5-8 the same at ceiling.
    const corners = [
      [x0, zBottom, -y0], [x1, zBottom, -y0], [x1, zBottom, -y1], [x0, zBottom, -y1],
      [x0, zTop, -y0], [x1, zTop, -y0], [x1, zTop, -y1], [x0, zTop, -y1],
    ];

    lines.push(`g storey_${level}`);
    for (const [x, y, z] of corners) {
      lines.push(`v ${fmt(x)} ${fmt(y)} ${fmt(z)}`);
    }

    const v = (i) => vertexBase + i;
    // Faces wound so their normals point outwards.
    lines.push(
      `f ${v(1)} ${v(4)} ${v(3)} ${v(2)}`, // floor
      `f ${v(5)} ${v(6)} ${v(7)} ${v(8)}`, // roof
      `f ${v(1)} ${v(2)} ${v(6)} ${v(5)}`, // front (south, -y)
      `f ${v(2)} ${v(3)} ${v(7)} ${v(6)}`, // east
      `f ${v(3)} ${v(4)} ${v(8)} ${v(7)}`, // rear (north, +y)
      `f ${v(4)} ${v(1)} ${v(5)} ${v(8)}`, // west
    );
    vertexBase += 8;
  }

  return `${lines.join(NL)}${NL}`;
}

/**
 * The area schedule as CSV: a row per storey, then the scheme totals. Written
 * for a spreadsheet rather than for a parser, which is why the totals are in
 * the same file — that is the sheet people actually paste into a report.
 */
export function toCSV(result) {
  const rows = [
    ['Level', 'Width (m)', 'Depth (m)', 'Floor area (m2)', 'Stepped back', 'Level height (m)'],
  ];
  for (const s of result.storeys) {
    rows.push([
      s.level,
      s.rect.width,
      s.rect.depth,
      s.area,
      s.steppedBack ? 'yes' : 'no',
      s.levelHeight,
    ]);
  }
  rows.push([]);
  rows.push(['Metric', 'Value', 'Unit']);
  rows.push(['Site area', result.siteArea, 'm2']);
  rows.push(['Buildable envelope', `${result.envelope.width} x ${result.envelope.depth}`, 'm']);
  rows.push(['Footprint', result.footprint, 'm2']);
  rows.push(['Gross floor area', result.gfa, 'm2']);
  rows.push(['Net floor area', result.nfa, 'm2']);
  rows.push(['Plot ratio', result.plotRatio, '']);
  rows.push(['Site coverage', result.coverage, '%']);
  rows.push(['Building height', result.height, 'm']);

  if (result.checks.length) {
    rows.push([]);
    rows.push(['Check', 'Value', 'Limit', 'Headroom', 'Result']);
    for (const c of result.checks) {
      rows.push([c.label, c.value, c.limit, c.headroom, c.pass ? 'PASS' : 'FAIL']);
    }
  }

  return rows.map((r) => r.map(csvCell).join(',')).join(NL) + NL;
}

/** The scheme inputs as a reloadable preset. Outputs are not stored — they recompute. */
export function toPreset(result, meta = {}) {
  const { site, setbacks, storeys, floorToFloor, stepback, efficiency, limits } = result.scheme;
  return JSON.stringify({
    format: 'massing-study/preset',
    version: 1,
    name: meta.name || 'Untitled study',
    saved: meta.saved || null,
    scheme: { site, setbacks, storeys, floorToFloor, stepback, efficiency, limits },
  }, null, 2) + NL;
}

/**
 * Read a preset back. Returns the scheme only, so the caller passes it straight
 * to computeScheme and gets the same validation as any other input.
 */
export function fromPreset(text) {
  const data = JSON.parse(text);
  if (!data || data.format !== 'massing-study/preset') {
    throw new TypeError('Not a massing-study preset');
  }
  if (data.version !== 1) {
    throw new TypeError(`Unsupported preset version ${data.version}`);
  }
  if (!data.scheme || typeof data.scheme !== 'object') {
    throw new TypeError('Preset has no scheme');
  }
  return { name: data.name || 'Untitled study', scheme: data.scheme };
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** OBJ vertices are trimmed to millimetres; trailing zeros only make files bigger. */
function fmt(v) {
  const n = round3(v);
  return Number.isInteger(n) ? `${n}.0` : String(n);
}

function round3(v) {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r;
}
