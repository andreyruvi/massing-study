import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The page and the scripts have a contract: every hook the JavaScript looks up
 * has to exist in the markup. Nothing enforces that at load time — a renamed
 * attribute just makes a panel silently stop updating — so the contract is
 * derived from the source here and checked against index.html.
 */

const html = readFileSync('index.html', 'utf8');

function sourceFiles(dir = 'src') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (entry.name.endsWith('.js')) out.push(path);
  }
  return out;
}

const sources = sourceFiles().map((path) => ({ path, text: readFileSync(path, 'utf8') }));
const allSource = sources.map((s) => s.text).join('\n');

/** Attribute hooks: `[data-foo]` and `[data-foo="bar"]` in any querySelector. */
function attributeHooks() {
  const hooks = new Set();
  for (const match of allSource.matchAll(/\[(data-[a-z-]+)(?:="([^"]+)")?\]/g)) {
    hooks.add(match[2] ? `${match[1]}="${match[2]}"` : match[1]);
  }
  return [...hooks].sort();
}

/** Form fields, read as `field('name')` in the controls module. */
function fieldNames() {
  const names = new Set();
  for (const match of allSource.matchAll(/\bfield\('([A-Za-z]+)'\)/g)) names.add(match[1]);
  for (const match of allSource.matchAll(/\bset\('([A-Za-z]+)',/g)) names.add(match[1]);
  return [...names].sort();
}

/** Action names, dispatched from `data-action` on a button. */
function actionNames() {
  const block = allSource.match(/const actions = \{([\s\S]*?)\n\};/);
  assert.ok(block, 'the actions table should be findable in main.js');
  const names = new Set();
  for (const match of block[1].matchAll(/^\s*(?:async\s+)?'?([a-z-]+)'?\s*(?:\(\)|:)/gm)) {
    names.add(match[1]);
  }
  return [...names].sort();
}

test('the source actually declares hooks to check', () => {
  assert.ok(sources.length >= 8, `expected the full module set, found ${sources.length}`);
  assert.ok(attributeHooks().length >= 15);
  assert.ok(fieldNames().length >= 18);
  assert.ok(actionNames().length >= 6);
});

test('every data attribute the scripts query exists in the page', () => {
  const missing = attributeHooks().filter((hook) => !html.includes(hook));
  assert.deepEqual(missing, [], `index.html is missing: ${missing.join(', ')}`);
});

test('every form field the controls read exists as a named input', () => {
  const missing = fieldNames().filter((name) => !new RegExp(`name="${name}"`).test(html));
  assert.deepEqual(missing, [], `index.html is missing inputs named: ${missing.join(', ')}`);
});

test('every named input is read by the controls', () => {
  // Scoped to input tags: <meta name="viewport"> is not a form field.
  const declared = [...html.matchAll(/<input[^>]*\bname="([A-Za-z]+)"/g)].map((m) => m[1]);
  const read = new Set(fieldNames());
  const orphans = [...new Set(declared)].filter((name) => !read.has(name));
  assert.deepEqual(orphans, [], `inputs nothing reads: ${orphans.join(', ')}`);
});

test('every button action has a handler and every handler has a button', () => {
  const inPage = [...new Set([...html.matchAll(/data-action="([a-z-]+)"/g)].map((m) => m[1]))].sort();
  assert.deepEqual(inPage, actionNames());
});

test('every input has a label bound to its id', () => {
  const ids = [...html.matchAll(/<input[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 18, `expected the full input set, found ${ids.length}`);
  const unlabelled = ids.filter((id) => !html.includes(`for="${id}"`));
  assert.deepEqual(unlabelled, [], `inputs with no label: ${unlabelled.join(', ')}`);
});

test('the stylesheets and the entry script are linked', () => {
  assert.match(html, /href="styles\/massing-study\.css"/);
  assert.match(html, /href="styles\/print\.css"[^>]*media="print"/);
  assert.match(html, /<script type="module" src="src\/main\.js">/);
});

test('the canvas carries a text alternative', () => {
  const canvas = html.match(/<canvas[^>]*>/)[0];
  assert.match(canvas, /role="img"/);
  assert.match(canvas, /aria-label="[^"]{40,}"/);
});

test('the status region is announced politely', () => {
  assert.match(html, /data-status[^>]*role="status"/);
  assert.match(html, /data-status[^>]*aria-live="polite"/);
});

test('the page declares a language, a title and a description', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>[^<]{10,}<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{40,}">/);
});

test('every drawing colour the renderer reads is defined in the stylesheet', () => {
  const css = readFileSync('styles/massing-study.css', 'utf8');
  const tokens = [...new Set(
    [...readFileSync('src/ui/renderer.js', 'utf8').matchAll(/read\('(--[a-z-]+)'/g)].map((m) => m[1]),
  )];
  assert.ok(tokens.length >= 6, `expected the palette tokens, found ${tokens.length}`);
  for (const token of tokens) {
    assert.ok(css.includes(`${token}:`), `${token} is read but never defined`);
  }
});

test('the print palette maps every screen token it replaces', () => {
  const css = readFileSync('styles/massing-study.css', 'utf8');
  const printBlock = css.match(/body\.printing \{([\s\S]*?)\n\}/);
  const mediaBlock = css.match(/@media print \{\s*:root \{([\s\S]*?)\n {2}\}/);
  assert.ok(printBlock && mediaBlock, 'both print mappings should be present');
  const names = (block) => [...block.matchAll(/(--c-[a-z-]+):/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    names(printBlock[1]),
    names(mediaBlock[1]),
    'the class and the media-query mapping must cover the same tokens',
  );
});
