/**
 * Wiring.
 *
 * Reads the form, computes the scheme, draws it, fills the schedule, and
 * handles the exports. Everything it calls is testable on its own; this file
 * is deliberately the only part that is not.
 */

import { computeScheme, maxStoreysWithin } from './engine/massing.js';
import { solarPosition } from './engine/sun.js';
import { toOBJ, toCSV, toPreset, fromPreset } from './engine/exporters.js';
import { createRenderer } from './ui/renderer.js';
import { createSchedule } from './ui/schedule.js';
import { createControls, DEFAULT_SUN } from './ui/controls.js';
import { downloadText, downloadCanvas, pickTextFile, saveLocal, loadLocal } from './ui/download.js';
import { slug } from './ui/format.js';

const form = document.querySelector('[data-form]');
const canvas = document.querySelector('[data-canvas]');
const status = document.querySelector('[data-status]');
const renderer = createRenderer(canvas);
const schedule = createSchedule({
  schedule: document.querySelector('[data-readouts]'),
  drawing: document.querySelector('[data-drawing]'),
});

let state = null;
let result = null;
let frame = 0;

function announce(message) {
  status.textContent = message;
}

/** Recompute and redraw. Called on every input, so it is kept cheap. */
function update(next) {
  state = next;
  try {
    result = computeScheme(state.scheme);
  } catch (error) {
    announce(`Cannot compute this scheme: ${error.message}`);
    return;
  }

  const sun = state.sun.enabled
    ? solarPosition({
      day: state.sun.day,
      solarHour: state.sun.solarHour,
      latitude: state.sun.latitude,
    })
    : null;

  renderer.draw(result, { view: state.view, sun, showShadow: state.sun.enabled });
  schedule.render(result, {
    sun,
    sunInput: state.sun.enabled ? state.sun : null,
    maxStoreys: maxStoreysWithin(state.scheme),
  });

  document.body.dataset.buildable = String(result.buildable);
  saveLocal(state);
}

/** Coalesce a burst of input events into one frame of work. */
function schedulePaint(next) {
  state = next;
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    update(state);
  });
}

const controls = createControls(form, { onChange: schedulePaint });

function filename(extension) {
  return `${slug(state?.name, 'massing-study')}.${extension}`;
}

const actions = {
  'export-obj'() {
    downloadText(filename('obj'), toOBJ(result, { name: state.name || 'massing-study' }), 'model/obj');
    announce(`Exported ${filename('obj')} — ${result.storeys.length} storeys, metres, Y up.`);
  },
  'export-csv'() {
    downloadText(filename('csv'), toCSV(result), 'text/csv;charset=utf-8');
    announce(`Exported the area schedule as ${filename('csv')}.`);
  },
  'export-png'() {
    downloadCanvas(canvas, filename('png')).then((ok) => {
      announce(ok ? `Exported the drawing as ${filename('png')}.` : 'This browser cannot export a PNG.');
    });
  },
  'save-preset'() {
    const text = toPreset(result, { name: state.name || 'Untitled study', saved: new Date().toISOString() });
    downloadText(filename('json'), text, 'application/json');
    announce(`Saved the scheme as ${filename('json')}.`);
  },
  async 'load-preset'() {
    const text = await pickTextFile();
    if (text === null) { announce('No file chosen.'); return; }
    try {
      const preset = fromPreset(text);
      controls.writeState({ ...state, name: preset.name, scheme: preset.scheme });
      update(controls.readState());
      announce(`Loaded “${preset.name}”.`);
    } catch (error) {
      announce(`That file is not a massing-study preset: ${error.message}`);
    }
  },
  print() {
    window.print();
  },
  reset() {
    controls.writeState({ name: '', scheme: {}, view: {}, sun: DEFAULT_SUN });
    update(controls.readState());
    announce('Reset to the default scheme.');
  },
};

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = actions[button.dataset.action];
  if (!action) return;
  event.preventDefault();
  action();
});

// Redraw on resize, but only when the canvas box actually changed.
if (typeof ResizeObserver === 'function') {
  new ResizeObserver(() => { if (result) schedulePaint(state); }).observe(canvas);
} else {
  window.addEventListener('resize', () => { if (result) schedulePaint(state); });
}

// A theme change swaps the palette the renderer reads out of the stylesheet.
window.matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => { if (result) update(state); });

// The canvas is a bitmap, so the print stylesheet cannot recolour it. Repaint
// it with the print palette before the dialog opens, and put it back after.
window.addEventListener('beforeprint', () => {
  document.body.classList.add('printing');
  if (result) update(state);
});
window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing');
  if (result) update(state);
});

const saved = loadLocal();
if (saved) {
  controls.writeState(saved);
  announce('Restored your last scheme.');
}
update(controls.readState());
