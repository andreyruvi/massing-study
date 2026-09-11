/**
 * The readouts: metric tiles, the storey schedule, the planning checks and the
 * solar line.
 *
 * All of it is real text in the document rather than labels painted on the
 * canvas, so it can be read by a screen reader, selected, copied into a report
 * and printed. The drawing is the illustration; this is the deliverable.
 */

import { area, length, percent, ratio, headroom, clock, dayLabel, bearing, num } from './format.js';

/**
 * @param {object} regions
 *   `schedule` is the panel holding the metrics and tables; `drawing` is the
 *   panel under the canvas, where the sun line and the unbuildable warning
 *   belong because they describe the picture. Two roots rather than one,
 *   because a single root silently returned null for half the hooks.
 */
export function createSchedule({ schedule: scheduleRoot, drawing: drawingRoot }) {
  // A missing hook is a markup/script mismatch, and it must fail at startup
  // with a name rather than on every render with "textContent of null".
  const need = (root, selector, where) => {
    const node = root && root.querySelector(selector);
    if (!node) throw new Error(`Schedule hook ${selector} not found in the ${where} panel`);
    return node;
  };
  const inSchedule = (selector) => need(scheduleRoot, selector, 'schedule');
  const inDrawing = (selector) => need(drawingRoot, selector, 'drawing');

  const nodes = {
    siteArea: inSchedule('[data-metric="site-area"]'),
    envelope: inSchedule('[data-metric="envelope"]'),
    footprint: inSchedule('[data-metric="footprint"]'),
    gfa: inSchedule('[data-metric="gfa"]'),
    nfa: inSchedule('[data-metric="nfa"]'),
    plotRatio: inSchedule('[data-metric="plot-ratio"]'),
    coverage: inSchedule('[data-metric="coverage"]'),
    height: inSchedule('[data-metric="height"]'),
    storeyBody: inSchedule('[data-schedule-body]'),
    storeyTotal: inSchedule('[data-schedule-total]'),
    checks: inSchedule('[data-checks]'),
    checksTable: inSchedule('[data-checks-table]'),
    verdict: inSchedule('[data-verdict]'),
    sun: inDrawing('[data-sun]'),
    warning: inDrawing('[data-warning]'),
  };

  function render(result, context = {}) {
    nodes.siteArea.textContent = area(result.siteArea);
    nodes.envelope.textContent = result.envelope.buildable
      ? `${num(result.envelope.width)} × ${num(result.envelope.depth)} m`
      : 'none';
    nodes.footprint.textContent = area(result.footprint);
    nodes.gfa.textContent = area(result.gfa);
    nodes.nfa.textContent = area(result.nfa);
    nodes.plotRatio.textContent = ratio(result.plotRatio);
    nodes.coverage.textContent = percent(result.coverage);
    nodes.height.textContent = length(result.height);

    renderStoreys(result);
    renderChecks(result, context);
    renderSun(context.sun, context.sunInput, result);

    nodes.warning.textContent = result.buildable
      ? ''
      : 'The setbacks leave no buildable envelope on this plot.';
    nodes.warning.hidden = result.buildable;
  }

  function renderStoreys(result) {
    nodes.storeyBody.replaceChildren(...result.storeys.map((s) => {
      const row = document.createElement('tr');
      row.append(
        cell('th', `${s.level}`, { scope: 'row' }),
        cell('td', `${num(s.rect.width)} × ${num(s.rect.depth)}`, { class: 'dimension' }),
        cell('td', area(s.area), { class: 'numeric' }),
        cell('td', length(s.levelHeight), { class: 'numeric' }),
        cell('td', s.steppedBack ? 'stepped back' : '—'),
      );
      return row;
    }));
    nodes.storeyTotal.textContent = area(result.gfa);
  }

  function renderChecks(result, context) {
    const { checks } = result;
    // The whole table is hidden, not just its body, so the column headings do
    // not sit above nothing. The verdict line above it says why.
    nodes.checksTable.hidden = checks.length === 0;

    nodes.checks.replaceChildren(...checks.map((c) => {
      const row = document.createElement('tr');
      row.dataset.result = c.pass ? 'pass' : 'fail';
      // A percentage closes up against its sign; a unit of measure does not.
      const withUnit = (value) => (c.unit === '%'
        ? `${num(value)}%`
        : `${num(value)}${c.unit ? ` ${c.unit}` : ''}`);
      row.append(
        cell('th', c.label, { scope: 'row' }),
        cell('td', withUnit(c.value), { class: 'numeric' }),
        cell('td', withUnit(c.limit), { class: 'numeric' }),
        cell('td', c.unit === '%' ? `${headroom(c.headroom)}%` : headroom(c.headroom, c.unit), { class: 'numeric' }),
        cell('td', c.pass ? 'Pass' : 'Fail', { class: 'verdict-cell' }),
      );
      return row;
    }));

    nodes.verdict.textContent = verdictText(result, context);
    nodes.verdict.dataset.state = verdictState(result);
  }

  function renderSun(sun, sunInput, result) {
    if (!sun || !sunInput) {
      nodes.sun.textContent = 'Sun study off.';
      return;
    }
    const when = `${dayLabel(sunInput.day)}, ${clock(sunInput.solarHour)} solar time`;
    if (!sun.up) {
      nodes.sun.textContent = `${when}: the sun is below the horizon, so no shadow is cast.`;
      return;
    }
    const shadow = result.height > 0 && sun.altitude > 0
      ? ` Shadow reaches ${length(result.height / Math.tan(sun.altitude * Math.PI / 180))} from the wall.`
      : '';
    nodes.sun.textContent = `${when}: altitude ${num(sun.altitude, 1)}°, `
      + `azimuth ${bearing(sun.azimuth)}.${shadow}`;
  }

  return { render };
}

function verdictState(result) {
  if (!result.buildable) return 'fail';
  if (!result.checks.length) return 'none';
  return result.checks.every((c) => c.pass) ? 'pass' : 'fail';
}

function verdictText(result, context) {
  if (!result.buildable) return 'No buildable envelope.';
  if (!result.checks.length) return 'No planning limits entered, so nothing is checked.';
  const failed = result.checks.filter((c) => !c.pass);
  if (!failed.length) {
    const most = Number.isFinite(context.maxStoreys) && context.maxStoreys > result.storeys.length
      ? ` Up to ${context.maxStoreys} storeys would still comply.`
      : '';
    return `Within all ${result.checks.length} limits.${most}`;
  }
  return `Over the limit on ${failed.map((c) => c.label.toLowerCase()).join(' and ')}.`;
}

function cell(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}
