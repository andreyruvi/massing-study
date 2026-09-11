/**
 * Scene assembly.
 *
 * Turns a computed scheme into a flat, depth-sorted list of drawable faces and
 * lines. Kept free of any canvas call so the ordering — which is the part that
 * actually goes wrong — can be tested without a browser.
 *
 * World axes: x east, y north, z up. The plot's near-left corner is the origin.
 */

import { rectCorners } from '../engine/geometry.js';
import { shadowPolygon } from '../engine/sun.js';
import { viewBasis, project, fitToViewport, projectFace } from './projection.js';

/** Face roles, so the renderer picks a fill without knowing the geometry. */
export const ROLE = Object.freeze({
  GROUND: 'ground',
  SETBACK: 'setback',
  SHADOW: 'shadow',
  ROOF: 'roof',
  WALL: 'wall',
});

/** The four side normals of a box, in the order rectCorners walks its edges. */
const SIDE_NORMALS = [
  { x: 0, y: -1, z: 0 }, // front, facing south
  { x: 1, y: 0, z: 0 }, // east
  { x: 0, y: 1, z: 0 }, // rear, facing north
  { x: -1, y: 0, z: 0 }, // west
];

const SIDE_LABELS = ['front', 'east', 'rear', 'west'];

/**
 * Build the scene.
 * @param {object} result  a computeScheme result
 * @param {object} opts    { width, height, padding, view, sun, showShadow }
 */
export function buildScene(result, opts = {}) {
  const {
    width = 800, height = 600, padding = 36,
    view, sun = null, showShadow = true,
  } = opts;

  const basis = viewBasis(view);
  const site = result.scheme.site;
  const sitePlan = rectCorners({ width: site.width, depth: site.depth, offsetX: 0, offsetY: 0 });
  const envelopePlan = rectCorners(result.envelope);

  const footprint = result.storeys[0]?.rect;
  const shadow = showShadow && sun && sun.up && footprint && footprint.width > 0
    ? shadowPolygon(rectCorners(footprint), result.height, sun)
    : null;

  // Everything that must be inside the frame, projected once to size the view.
  const extent = [
    ...sitePlan.map((p) => ({ ...p, z: 0 })),
    ...(shadow || []).map((p) => ({ ...p, z: 0 })),
    ...boxTopCorners(result),
  ].map((p) => project(p, basis));
  const fit = fitToViewport(extent, { width, height, padding });

  const faces = [];
  const lines = [];

  // The plot, then the setback line on top of it: both flat on the ground, so
  // they are drawn first and excluded from the depth sort.
  faces.push({
    role: ROLE.GROUND,
    label: 'Site',
    ...projectFace(sitePlan.map((p) => ({ ...p, z: 0 })), { x: 0, y: 0, z: 1 }, basis, fit),
    flat: true,
  });

  if (shadow) {
    faces.push({
      role: ROLE.SHADOW,
      label: 'Shadow',
      ...projectFace(shadow.map((p) => ({ ...p, z: 0 })), { x: 0, y: 0, z: 1 }, basis, fit),
      flat: true,
    });
  }

  if (result.envelope.buildable) {
    lines.push({
      role: ROLE.SETBACK,
      label: 'Buildable envelope',
      dashed: true,
      closed: true,
      ring: projectFace(envelopePlan.map((p) => ({ ...p, z: 0 })), null, basis, fit).ring,
    });
  }

  // The masses. Each storey is a box; its faces go through the depth sort.
  const f2f = result.scheme.floorToFloor;
  for (const storey of result.storeys) {
    const { rect, level, levelHeight } = storey;
    if (!(rect.width > 0 && rect.depth > 0)) continue;
    const zLow = levelHeight;
    const zHigh = levelHeight + f2f;
    const plan = rectCorners(rect);

    for (let i = 0; i < 4; i += 1) {
      const a = plan[i];
      const b = plan[(i + 1) % 4];
      faces.push({
        role: ROLE.WALL,
        label: `Storey ${level} ${SIDE_LABELS[i]}`,
        level,
        ...projectFace(
          [
            { ...a, z: zLow }, { ...b, z: zLow },
            { ...b, z: zHigh }, { ...a, z: zHigh },
          ],
          SIDE_NORMALS[i],
          basis,
          fit,
        ),
      });
    }

    faces.push({
      role: ROLE.ROOF,
      label: `Storey ${level} roof`,
      level,
      ...projectFace(plan.map((p) => ({ ...p, z: zHigh })), { x: 0, y: 0, z: 1 }, basis, fit),
    });
  }

  return {
    fit,
    basis,
    // Flat ground faces stay at the back; the rest are painted far to near.
    faces: sortFaces(faces),
    lines,
    north: northPoint(basis, { width, height, padding }),
    hasShadow: Boolean(shadow),
  };
}

/**
 * The north point, in screen space at a fixed corner like the one on a drawing
 * sheet. Anchoring it to the sheet rather than to the site keeps it out of the
 * viewport fit, where it would otherwise push the building off-centre or get
 * clipped as the camera turns.
 */
export function northPoint(basis, { width, height, padding = 36, radius = 22 }) {
  const projected = project({ x: 0, y: 1, z: 0 }, basis);
  const length = Math.hypot(projected.x, projected.y) || 1;
  const dir = { x: projected.x / length, y: projected.y / length };
  const centre = { x: padding + radius + 4, y: height - padding - radius - 4 };
  return {
    centre,
    radius,
    tip: { x: centre.x + dir.x * radius, y: centre.y + dir.y * radius },
    tail: { x: centre.x - dir.x * radius, y: centre.y - dir.y * radius },
    // True when the camera looks from anywhere north, which flips the arrow
    // towards the viewer and makes the label overlap the arrowhead.
    labelAbove: dir.y > 0,
    viewportWidth: width,
  };
}

/**
 * Painter's ordering: ground plane first in its own fixed order, then the
 * visible masses from the back of the scene forwards. Back faces are dropped
 * rather than sorted, which is what keeps the boxes reading as solid.
 */
export function sortFaces(faces) {
  const flat = faces.filter((f) => f.flat);
  const solid = faces
    .filter((f) => !f.flat && f.facing > 1e-9)
    .sort((a, b) => a.depth - b.depth);
  return [...flat, ...solid];
}

/** Top corners of every storey, used only to size the viewport. */
function boxTopCorners(result) {
  const f2f = result.scheme.floorToFloor;
  const points = [];
  for (const storey of result.storeys) {
    if (!(storey.rect.width > 0 && storey.rect.depth > 0)) continue;
    const z = storey.levelHeight + f2f;
    for (const p of rectCorners(storey.rect)) points.push({ ...p, z });
  }
  return points;
}
