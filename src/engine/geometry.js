/**
 * Plot geometry.
 *
 * The model is a rectangular site with per-edge setbacks, because that is how
 * planning rules are actually written: a front, rear and two side setbacks off
 * a plot boundary. Irregular plots are handled by entering the surveyed site
 * area directly — general polygon offsetting is deliberately out of scope
 * rather than approximated badly.
 */

/** Signed area of a closed polygon by the shoelace formula, in the input units. */
export function polygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return round(Math.abs(sum) / 2);
}

/**
 * The buildable envelope left after setbacks.
 * Returns zero dimensions when the setbacks consume the plot, which is a real
 * planning outcome and not an error.
 */
export function buildableEnvelope(site, setbacks) {
  const width = site.width - (setbacks.left + setbacks.right);
  const depth = site.depth - (setbacks.front + setbacks.rear);
  return {
    width: Math.max(0, round(width)),
    depth: Math.max(0, round(depth)),
    // Offset of the envelope's near-left corner from the plot's near-left corner.
    offsetX: setbacks.left,
    offsetY: setbacks.front,
    buildable: width > 0 && depth > 0,
  };
}

/** A rectangle shrunk equally on all sides, used for an upper-storey stepback. */
export function stepBack(rect, distance) {
  const width = rect.width - distance * 2;
  const depth = rect.depth - distance * 2;
  return {
    width: Math.max(0, round(width)),
    depth: Math.max(0, round(depth)),
    offsetX: rect.offsetX + distance,
    offsetY: rect.offsetY + distance,
    buildable: width > 0 && depth > 0,
  };
}

export function rectArea(rect) {
  return round(rect.width * rect.depth);
}

/** The four corners of a rectangle in plan, anticlockwise from the near-left. */
export function rectCorners(rect) {
  const { offsetX: x, offsetY: y, width: w, depth: d } = rect;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + d },
    { x, y: y + d },
  ];
}

/**
 * Round to millimetre precision; drawing sets do not carry more than that.
 * Negative zero is normalised, because it is otherwise printed as "-0" in
 * readouts and export files.
 */
export function round(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return rounded === 0 ? 0 : rounded;
}
