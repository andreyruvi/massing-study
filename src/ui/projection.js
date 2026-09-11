/**
 * Axonometric projection.
 *
 * Parallel projection rather than perspective, because that is what a massing
 * study is drawn in: equal lengths stay equal, so a reader can measure off the
 * drawing. The camera is described the way a site plan describes a view — an
 * azimuth clockwise from north and an elevation above the horizon.
 *
 * World axes: x east, y north, z up, all in metres.
 * Screen axes: x right, y down, matching the canvas.
 */

const RAD = Math.PI / 180;

export const DEFAULT_VIEW = Object.freeze({ azimuth: 135, elevation: 30 });

/**
 * Build the projection basis once, then reuse it for every point in a frame.
 * `toViewer` points from the scene towards the camera, so a larger `depth` is
 * nearer the viewer.
 */
export function viewBasis({ azimuth, elevation } = DEFAULT_VIEW) {
  const a = azimuth * RAD;
  const e = elevation * RAD;
  const sinA = Math.sin(a);
  const cosA = Math.cos(a);
  const sinE = Math.sin(e);
  const cosE = Math.cos(e);
  return {
    azimuth,
    elevation,
    right: { x: -cosA, y: sinA, z: 0 },
    up: { x: -sinE * sinA, y: -sinE * cosA, z: cosE },
    toViewer: { x: sinA * cosE, y: cosA * cosE, z: sinE },
  };
}

/** Project a world point to unscaled screen coordinates plus a depth key. */
export function project(point, basis) {
  const { x, y, z = 0 } = point;
  const { right: r, up: u, toViewer: v } = basis;
  return {
    x: x * r.x + y * r.y + z * r.z,
    y: -(x * u.x + y * u.y + z * u.z),
    depth: x * v.x + y * v.y + z * v.z,
  };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + (a.z || 0) * (b.z || 0);
}

/**
 * Scale and centre a projected drawing inside a viewport.
 * Returns a transform rather than mutating the points, so the same projection
 * can be reused for hit-testing and for export.
 */
export function fitToViewport(projected, { width, height, padding = 24 }) {
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  if (!projected.length) {
    return { scale: 1, offsetX: width / 2, offsetY: height / 2 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of projected) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min(
    spanX > 0 ? usableWidth / spanX : Infinity,
    spanY > 0 ? usableHeight / spanY : Infinity,
  );
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

  return {
    scale: safeScale,
    offsetX: width / 2 - ((minX + maxX) / 2) * safeScale,
    offsetY: height / 2 - ((minY + maxY) / 2) * safeScale,
    spanX,
    spanY,
  };
}

/** Apply a fit transform to one projected point. */
export function applyFit(point, fit) {
  return {
    x: point.x * fit.scale + fit.offsetX,
    y: point.y * fit.scale + fit.offsetY,
    depth: point.depth,
  };
}

/**
 * Project a whole polygon and report the data the painter needs: the screen
 * ring, the mean depth to sort on, and whether the face turns away from the
 * camera so it can be culled.
 */
export function projectFace(points, normal, basis, fit) {
  const ring = points.map((p) => applyFit(project(p, basis), fit));
  const depth = ring.reduce((sum, p) => sum + p.depth, 0) / (ring.length || 1);
  return {
    ring,
    depth,
    facing: normal ? dot(normal, basis.toViewer) : 1,
  };
}
