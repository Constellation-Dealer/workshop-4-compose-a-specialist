#!/usr/bin/env node
/**
 * Exercise the page's real state transitions against a hand-written DOM.
 *
 * The literal-id checker is static and cannot see these: whether the Ask
 * control is enabled is a function of config completeness AND whether a
 * request is in flight, and whether the console link honours a .env override
 * depends on the ORDER in which two unawaited things happen. Both shipped
 * broken and both looked fine in a browser.
 *
 * No dependencies, like the contrast check. The DOM is only as big as the
 * scripts actually touch, so a template that stops rendering an element stops
 * answering for it too.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);

function el(id) {
  return {
    id, disabled: false, textContent: '', innerHTML: '', href: '', className: '',
    title: '', type: '', value: '', classList: { add() {}, remove() {}, contains: () => false },
    children: [], handlers: {},
    addEventListener(ev, fn) { this.handlers[ev] = fn; },
    appendChild(c) { this.children.push(c); return c; },
    prepend(c) { this.children.unshift(c); return c; },
    remove() {}, querySelector: () => null, querySelectorAll: () => [],
    requestSubmit() { if (this.handlers.submit) this.handlers.submit({ preventDefault() {} }); }
  };
}

const nodes = Object.fromEntries(ids.map(i => [i, el(i)]));
let chips = [];

const document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, getAttribute: () => null },
  getElementById: id => nodes[id] || null,
  querySelectorAll: sel => (sel.includes('preset-btn') ? chips : []),
  createElement: tag => el('<' + tag + '>')
};

let envText = '';
const sandbox = {
  document, console,
  window: { __APP_VERSION__: 'test', addEventListener() {} },
  matchMedia: () => ({ matches: false }),
  fetch: async (url) => {
    if (String(url).startsWith('.env')) return { ok: true, text: async () => envText };
    throw new Error('unexpected fetch: ' + url);
  },
  setTimeout, clearTimeout
};
sandbox.window.document = document;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of ['helpers.js', 'solution.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
}

const fail = [];
const check = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}${cond ? '' : '  — ' + detail}`);
  if (!cond) fail.push(name);
};

const FULL = [
  'IDMS_URL=https://idms.example', 'GATEWAY_URL=https://gw.example',
  'DEALER_GUID=g', 'USERNAME=u', 'PASSWORD=p', 'CLIENT_SECRET=s'
].join('\n');

(async () => {
  console.log('########## page state');

  // ── incomplete config: the chip path must not re-enable asking ────────────
  envText = FULL.replace('CLIENT_SECRET=s', 'CLIENT_SECRET=');
  chips = [el('chip')];
  await sandbox.loadEnv();
  check('incomplete config disables Ask', nodes.askBtn.disabled === true, 'Ask was enabled');
  check('incomplete config disables the chips', chips[0].disabled === true, 'a chip stayed clickable');

  // The regression: a failed ask must leave the gate closed.
  sandbox.setAsking(true);
  sandbox.setAsking(false);
  check('Ask stays disabled after a failed ask',
    nodes.askBtn.disabled === true,
    'setAsking(false) re-enabled Ask while the config was still incomplete');

  // ── complete config ───────────────────────────────────────────────────────
  envText = FULL;
  await sandbox.loadEnv();
  check('complete config enables Ask', nodes.askBtn.disabled === false, 'Ask stayed disabled');
  check('in-flight disables Ask', (sandbox.setAsking(true), nodes.askBtn.disabled === true), 'Ask stayed enabled mid-request');
  sandbox.setAsking(false);

  // ── the documented CONSOLE_URL override ───────────────────────────────────
  check('default console link', nodes.skillLink.href === 'https://dev-dealeriq.csidealer.com/skills', nodes.skillLink.href);

  envText = FULL + '\nCONSOLE_URL=https://console.example/';
  await sandbox.loadEnv();
  check('CONSOLE_URL override is honoured', nodes.skillLink.href === 'https://console.example/skills', nodes.skillLink.href);
  check('trailing slash is normalised', !nodes.skillLink.href.includes('//skills'), nodes.skillLink.href);

  if (fail.length) { console.log(`\n${fail.length} check(s) failed.`); process.exit(1); }
  console.log('  all page-state checks pass');
})();
