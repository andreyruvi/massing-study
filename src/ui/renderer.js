/**
 * Canvas renderer.
 *
 * The only module that touches a drawing context. It reads its colours from
 * the stylesheet's custom properties so the dark theme and the print sheet do
 * not need a second palette in JavaScript.
 */

import { buildScene, ROLE } from './scene.js';

const FACE_TOKENS = {
  [ROLE.GROUND]: '--c-site',
  [ROLE.SHADOW]: '--c-shadow',
  [ROLE.ROOF]: '--c-roof',
  [ROLE.WALL]: '--c-wall',
};

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  let last = null;

  /** Size the backing store to the element and the device pixel ratio. */
  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height };
  }

  function palette() {
    const styles = getComputedStyle(canvas);
    const read = (token, fallback) => (styles.getPropertyValue(token).trim() || fallback);
    return {
      [ROLE.GROUND]: read('--c-site', '#e8e4dc'),
      [ROLE.SHADOW]: read('--c-shadow', 'rgba(40,44,52,0.22)'),
      [ROLE.ROOF]: read('--c-roof', '#f2efe9'),
      [ROLE.WALL]: read('--c-wall', '#cfc9be'),
      line: read('--c-line', '#3b3f46'),
      hint: read('--c-line-soft', '#8d8d8d'),
      text: read('--c-ink', '#22262c'),
    };
  }

  /**
   * Shade the two visible wall planes differently. A single fill makes the
   * corner between them disappear, which is the whole point of an axonometric.
   */
  function wallShade(face, base, towards) {
    // `facing` is the cosine between the wall normal and the view direction:
    // the more square-on the wall, the lighter it reads. It lifts towards the
    // roof tone rather than towards white, so the effect survives the dark
    // theme — where white would make a wall brighter than the sky-facing roof.
    const lift = 0.82 + 0.18 * Math.min(1, Math.max(0, face.facing));
    return mix(base, towards, 1 - lift);
  }

  function draw(result, options = {}) {
    const { width, height } = resize();
    const scene = buildScene(result, { ...options, width, height });
    const colours = palette();
    last = { scene, result };

    context.clearRect(0, 0, width, height);

    for (const face of scene.faces) {
      if (face.ring.length < 3) continue;
      path(face.ring, true);
      if (face.role === ROLE.WALL) {
        context.fillStyle = wallShade(face, colours[ROLE.WALL], colours[ROLE.ROOF]);
      } else {
        context.fillStyle = colours[FACE_TOKENS[face.role]] || colours[ROLE.WALL];
      }
      context.fill();

      if (face.role === ROLE.SHADOW) continue;
      context.strokeStyle = face.flat ? colours.hint : colours.line;
      context.lineWidth = face.flat ? 1 : 1.25;
      context.stroke();
    }

    for (const line of scene.lines) {
      if (line.ring.length < 2) continue;
      context.save();
      context.setLineDash(line.dashed ? [6, 4] : []);
      context.strokeStyle = colours.hint;
      context.lineWidth = 1.25;
      path(line.ring, Boolean(line.closed));
      context.stroke();
      context.restore();
    }

    drawNorth(scene.north, colours);
    return scene;
  }

  function drawNorth(north, colours) {
    if (!north) return;
    const { centre, radius, tip, tail } = north;
    context.save();
    context.strokeStyle = colours.line;
    context.fillStyle = colours.line;
    context.lineWidth = 1.25;

    context.beginPath();
    context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    context.strokeStyle = colours.hint;
    context.stroke();

    context.beginPath();
    context.moveTo(tail.x, tail.y);
    context.lineTo(tip.x, tip.y);
    context.strokeStyle = colours.line;
    context.stroke();

    // Arrowhead, built from the arrow's own direction so it turns with it.
    const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
    const head = 7;
    context.beginPath();
    context.moveTo(tip.x, tip.y);
    context.lineTo(
      tip.x - head * Math.cos(angle - 0.4),
      tip.y - head * Math.sin(angle - 0.4),
    );
    context.lineTo(
      tip.x - head * Math.cos(angle + 0.4),
      tip.y - head * Math.sin(angle + 0.4),
    );
    context.closePath();
    context.fill();

    context.fillStyle = colours.text;
    context.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('N', centre.x, centre.y + (north.labelAbove ? -radius - 9 : radius + 9));
    context.restore();
  }

  function path(ring, close) {
    context.beginPath();
    context.moveTo(ring[0].x, ring[0].y);
    for (let i = 1; i < ring.length; i += 1) context.lineTo(ring[i].x, ring[i].y);
    if (close) context.closePath();
  }

  /** The last drawn scene, for the PNG export and for debugging. */
  function lastScene() {
    return last;
  }

  return { draw, resize, lastScene };
}

/** Blend two CSS colours. Falls back to the base when either cannot be parsed. */
export function mix(base, towards, amount) {
  const a = parseColour(base);
  const b = parseColour(towards);
  if (!a || !b) return base;
  const channel = (i) => Math.round(a[i] + (b[i] - a[i]) * amount);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

export function parseColour(value) {
  const text = String(value).trim();
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const rgb = text.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) return parts.slice(0, 3);
  }
  return null;
}
