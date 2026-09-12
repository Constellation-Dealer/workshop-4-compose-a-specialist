// ═══════════════════════════════════════════════════════════════
//  helpers.js — INFRASTRUCTURE. Do NOT modify.
//
//  CONTRACT
//  - helpers.js owns config loading, auth, the one Gateway call this
//    page makes, and every DOM primitive.
//  - solution.js owns the questions and decides when to ask one.
//  - askSystem() is the ONLY model call on this page. It also records
//    which tools the assistant reached for (lastTools()), because in this
//    workshop the tools line IS the lesson.
//
//  TODO: Copy .env.example to .env and fill in ALL values:
//    - IDMS_URL      → Token endpoint base URL (for authentication)
//    - GATEWAY_URL   → TargetMCP Gateway (the system under test)
//    - DEALER_GUID   → Dealer identifier carried on the token
//    - USERNAME      → IDMS username
//    - PASSWORD      → IDMS password
//    - CLIENT_SECRET → IDMS client secret
//    - CONSOLE_URL   → optional; defaults to the DEV console
//
// ═══════════════════════════════════════════════════════════════

let IDMS_URL = '';
let GATEWAY_URL = '';
let DEALER_GUID = '';
const APP_VERSION = window.__APP_VERSION__ || 'dev';

let _authToken = null;
let _config = { username: '', password: '', clientSecret: '' };

// Every run is kept so the current one can be diffed against the last.

function getToken() { return _authToken; }
// The turn the last assistant answer belongs to, so a thumb attaches to it.
function lastTurnId() { return _lastSutTurnId; }
function getDealerGuid() { return DEALER_GUID; }

function showBanner(message) {
  const banner = document.getElementById('errorBanner');
  banner.textContent = message;
  banner.classList.add('visible');
}

function clearBanner() {
  document.getElementById('errorBanner').classList.remove('visible');
}



// Where the second half of this workshop happens. Not secret and not
// per-participant, so it carries a default rather than being another line
// everybody has to paste correctly before anything works.
let CONSOLE_URL = 'https://dev-dealeriq.csidealer.com';

// ═══════════════════════════════════════════════════════════════
//  .env LOADER
// ═══════════════════════════════════════════════════════════════

async function loadEnv() {
  try {
    const res = await fetch(`.env?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const text = await res.text();
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key === 'IDMS_URL') IDMS_URL = value;
      if (key === 'GATEWAY_URL') GATEWAY_URL = value;
      if (key === 'DEALER_GUID') DEALER_GUID = value;
      if (key === 'USERNAME') _config.username = value;
      if (key === 'PASSWORD') _config.password = value;
      if (key === 'CLIENT_SECRET') _config.clientSecret = value;
      // Optional, defaulted above: a .env written before this existed still works.
      if (key === 'CONSOLE_URL' && value) CONSOLE_URL = value.replace(/\/+$/, '');
    }
  } catch {
    // Keep the "not loaded" state visible when .env is missing.
  }

  renderConnection();
}

function configIsComplete() {
  return Boolean(IDMS_URL && GATEWAY_URL && DEALER_GUID &&
    _config.username && _config.password && _config.clientSecret);
}

function renderConnection() {
  const state = document.getElementById('connState');
  const list = document.getElementById('connList');
  const complete = configIsComplete();

  state.textContent = complete ? 'loaded' : 'not loaded';
  state.className = `conn-state ${complete ? 'ok' : 'missing'}`;

  const mask = (v) => (v ? '•'.repeat(7) + ' loaded' : 'missing');
  const rows = [
    ['IDMS', IDMS_URL || 'missing'],
    ['GATEWAY', GATEWAY_URL || 'missing'],
    ['DEALER', DEALER_GUID || 'missing'],
    ['USERNAME', _config.username || 'missing'],
    ['PASSWORD', mask(_config.password)],
    ['SECRET', mask(_config.clientSecret)],
  ];

  list.innerHTML = rows
    .map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`)
    .join('');

  // The ask button is the gate now. This used to reach for `runBtn` and
  // `runNote`, which the redesign deleted — and because loadEnv() is async and
  // nobody awaits it, the resulting TypeError surfaced as an unhandled
  // rejection rather than as a broken page: every visible element had already
  // rendered before the throw. A page that fails without saying so is the exact
  // thing this workshop is about, so the smoke test in tools/ now asserts every
  // queried id exists in index.html.
  syncAskEnabled();

  // Applied HERE, not in initShell(). initShell sets up the page and then
  // starts loadEnv() without awaiting it, so anything reading CONSOLE_URL at
  // that moment gets the default — a .env override was documented and silently
  // ignored. renderConnection() runs after the file is parsed, so this is the
  // first point at which the value is real.
  const link = document.getElementById('skillLink');
  if (link) link.href = `${CONSOLE_URL}/skills`;

  const note = document.getElementById('headNote');
  if (note && !complete) {
    note.textContent = 'Fill in .env before asking — see Connection below.';
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ═══════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS — Do NOT modify.
// ═══════════════════════════════════════════════════════════════

/**
 * Authenticate with IDMS to get a bearer token for the Gateway.
 * Returns the JWT token string.
 */
async function authenticate() {
  if (!configIsComplete()) {
    throw new Error('Missing config. Copy .env.example to .env and fill in every value from the Champion Portal.');
  }

  const res = await fetch(`${IDMS_URL}/api/v1/Account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ClientId: 'ChampionWorkshop',
      ClientSecret: _config.clientSecret.trim(),
      UserName: _config.username.trim(),
      Password: _config.password.trim(),
      ProductId: 'B3AD4A3C-71B1-43C4-3EF5-08DE4D806118',
      DmsDealerId: 199111001,
      LoginResolutionPolicy: 'DealerId'
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Authentication failed while getting an IDMS token. Check USERNAME, PASSWORD and CLIENT_SECRET in .env.${text ? ' Details: ' + text : ''}`);
  }

  const data = await res.json();
  _authToken = data.access_token || data.token;

  if (!_authToken) {
    throw new Error('Authentication succeeded, but IDMS returned no access token. The suite cannot run without a bearer token.');
  }

  return _authToken;
}

/**
 * Send one message to the system under test and return its final answer.
 *
 * This is the Gateway's streaming chat endpoint. The events arrive as SSE
 * (started / thinking / complete); the final text lives at
 * complete.response.message. That plumbing is handled here.
 *
 * @param {string} message - the full message to send
 * @returns {Promise<string>} the assistant's final answer text
 */
/**
 * The agent this page asks as. It binds workshop-4-answer-style by NAME, so the
 * style is chosen deterministically rather than competing with the other
 * workshops' skills — a call with no agent picks up whichever style wins a
 * tiebreak. It leaves tools unrestricted, which is what lets the four
 * workshop-connectors servers be reached at all.
 */
const WORKSHOP_AGENT_ID = 'workshop-4-agent';

// The assistant turn the LAST answer belongs to, so a thumb attaches to it.
let _lastSutTurnId = null;
// The tools the LAST answer reached for, in call order — the point of this page.
let _lastTools = [];
function lastTools() { return _lastTools; }

async function askSystem(message, agentId = WORKSHOP_AGENT_ID) {
  const res = await fetch(`${GATEWAY_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify(agentId ? { message, agentId } : { message })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`The Gateway refused the request, so this case has no answer to grade.${text ? ' Details: ' + text : ` (${res.status} ${res.statusText})`}`);
  }

  const { text, turnId, tools } = await _parseSseStream(res.body);
  if (agentId) _lastSutTurnId = turnId;
  _lastTools = tools;
  return text;
}

/**
 * Parse the Gateway's SSE stream down to the one thing a case needs:
 * the assistant's final answer text.
 *
 * Events arrive as `event: <name>` then `data: <json>`. The final text is
 * at complete.response.message; some responses also stream it in `message`
 * events, so both shapes are handled.
 */
// Built-in Gateway tools (get_artifact fetches the full text of a large tool
// result) arrive with no server or "unknown". They are the platform's own
// plumbing, not one of the four servers, and the strip says so.
const BUILT_IN_TOOLS = new Set(['get_artifact', 'get_skill_instructions']);
function _serverLabel(data) {
  const s = data?.serverName;
  if (BUILT_IN_TOOLS.has(data?.toolName) || !s || s === 'unknown' || s === 'gateway') return 'gateway (built-in)';
  return s;
}

async function _parseSseStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamed = '';
  let final = '';
  let turnId = null;
  let eventType = null;
  // tool_start / tool_complete arrive as the assistant works. Kept in call
  // order: Act 2 is ENTIRELY about whether two calls happened and which came
  // first, so order is not decoration here.
  const tools = [];

  function textOf(data) {
    if (typeof data === 'string') return data;
    if (!data || typeof data !== 'object') return '';
    return data.response?.message || data.response?.content || data.message || data.content || '';
  }

  function processLine(line) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
      return;
    }
    if (!line.startsWith('data: ') || !eventType) return;

    const dataStr = line.slice(6);
    let data;
    try { data = JSON.parse(dataStr); } catch { data = dataStr; }

    if (eventType === 'message') streamed += textOf(data);
    if (eventType === 'tool_start' && data?.toolName) {
      tools.push({ server: _serverLabel(data), tool: data.toolName, ok: null, ms: null });
    }
    if (eventType === 'tool_complete' && data?.toolName) {
      // Match the most recent open call for this tool; fall back to appending.
      const open = [...tools].reverse().find((t) => t.tool === data.toolName && t.ok === null);
      if (open) { open.ok = data.success !== false; open.ms = data.durationMs ?? null; }
      else tools.push({ server: _serverLabel(data), tool: data.toolName, ok: data.success !== false, ms: data.durationMs ?? null });
    }
    if (eventType === 'complete') {
      final = textOf(data) || final;
      turnId = data?.response?.assistantTurnId ?? turnId;
    }

    eventType = null;
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) processLine(line.replace(/\r$/, ''));
  }

  // Some responses end immediately after the final data line.
  if (buffer.trim()) processLine(buffer.trim());

  return { text: final || streamed, turnId, tools };
}

// ═══════════════════════════════════════════════════════════════
//  THE PAGE
//
//  Everything below renders the solution: the answer, the Source line the
//  skill asks for, and the tools the assistant reached for to get there.
// ═══════════════════════════════════════════════════════════════

// Whether a request is in flight. Held here rather than in solution.js so that
// exactly one place decides whether asking is possible.
let _asking = false;

/**
 * Enable asking only when we are idle AND the config is complete.
 *
 * Both conditions, always, from one function. The bug this replaces: the
 * incomplete-config gate disabled the button, but a suggested-question CHIP
 * bypasses the button entirely — it calls askAndRender() directly, auth fails
 * on the missing config, and the `finally` re-enabled the button
 * unconditionally. The page then looked ready while still being unusable.
 */
function syncAskEnabled() {
  const ok = configIsComplete() && !_asking;
  const btn = document.getElementById('askBtn');
  if (btn) {
    btn.disabled = !ok;
    btn.textContent = _asking ? 'Asking…' : 'Ask';
  }
  // The chips are the other way in, so they gate on the same condition.
  for (const chip of document.querySelectorAll('#questionChips .preset-btn')) {
    chip.disabled = !ok;
  }
}

function setAsking(on) {
  _asking = on;
  syncAskEnabled();
}

/**
 * The four acts as chips. The label is the act and its title; the question
 * itself is the tooltip, and the README says what to watch for in each.
 */
function renderQuestionChips(acts, onAsk) {
  const row = document.getElementById('questionChips');
  row.innerHTML = '';
  for (const a of acts) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'preset-btn is-act';
    chip.textContent = `${a.act} — ${a.title}`;
    chip.title = a.ask;
    chip.addEventListener('click', () => onAsk(a.ask));
    row.appendChild(chip);
  }
}

function openAnswerCard(question) {
  const list = document.getElementById('answerList');
  const empty = list.querySelector('.empty-note');
  if (empty) empty.remove();

  const card = document.createElement('article');
  card.className = 'answer-card is-pending';
  card.innerHTML =
    '<p class="answer-q"></p><div class="answer-body">Asking…</div>';
  card.querySelector('.answer-q').textContent = question;
  list.prepend(card);
  return card;
}

function closeAnswerCard(card, text, turnId, tools) {
  card.classList.remove('is-pending');
  const body = card.querySelector('.answer-body');
  body.textContent = '';

  // The skill asks for a trailing `Source:` line. Splitting it out is not
  // decoration: it is the most visible evidence that an instruction file you
  // can edit is shaping the output — the one lever you hold today.
  const lines = String(text || '').split('\n');
  const idx = lines.findIndex((l) => /^\s*source\s*:/i.test(l));
  const main = (idx === -1 ? lines : lines.slice(0, idx)).join('\n').trim();
  const source = idx === -1 ? '' : lines.slice(idx).join(' ').trim();

  const p = document.createElement('p');
  p.className = 'answer-text';
  p.textContent = main;
  body.appendChild(p);

  if (source) {
    const c = document.createElement('p');
    c.className = 'answer-conf';
    c.textContent = source;
    body.appendChild(c);
  }

  _renderToolStrip(card, tools || []);
  _renderAnswerFeedback(card, turnId);
}

/**
 * The tools line: every server › tool the assistant called, in order, with a
 * tick or a cross and the time it took. This is the thing each act exists to
 * make visible. No tools means the model answered from memory — for a
 * specialist that is worth noticing, not hiding.
 */
function _renderToolStrip(card, tools) {
  const strip = document.createElement('div');
  strip.className = 'tool-strip';
  const label = document.createElement('span');
  label.className = 'tool-label';
  label.textContent = tools.length ? 'Tools used, in order:' : 'No tools used — answered from memory.';
  strip.appendChild(label);
  tools.forEach((t, i) => {
    const chip = document.createElement('span');
    const builtIn = t.server === 'gateway (built-in)';
    chip.className = `tool-chip ${t.ok === false ? 'is-fail' : ''} ${builtIn ? 'is-builtin' : ''}`;
    if (builtIn) chip.title = 'The platform fetching the full text of a large tool result. Not one of the four servers.';
    const ms = t.ms != null ? ` · ${(t.ms / 1000).toFixed(1)}s` : '';
    chip.textContent = `${i + 1}. ${t.server} › ${t.tool} ${t.ok === false ? '✗' : '✓'}${ms}`;
    strip.appendChild(chip);
  });
  card.appendChild(strip);
}

function failAnswerCard(card, message) {
  card.classList.remove('is-pending');
  card.classList.add('is-error');
  card.querySelector('.answer-body').textContent = message;
}

/**
 * The thumb under an answer.
 *
 * Not scored here. It posts to the platform's feedback API and the row lands
 * in a review queue — which is where real eval cases come from, because nobody
 * invents two hundred by hand. Rating an answer you disliked is how a scenario
 * gets born, and it is the only way a participant's own judgement reaches the
 * dataset, since their door cannot write one directly.
 */
function _renderAnswerFeedback(card, turnId) {
  if (!turnId) {
    const note = document.createElement('div');
    note.className = 'case-feedback';
    note.innerHTML = '<span class="fb-note">No thumb — this answer was not saved as a turn, so there is nothing to rate.</span>';
    card.appendChild(note);
    return;
  }

  const row = document.createElement('div');
  row.className = 'case-feedback';
  row.innerHTML =
    '<span class="fb-label">Was this answer good?</span>' +
    '<button type="button" class="fb-btn" data-score="1">\u{1F44D} Yes</button>' +
    '<button type="button" class="fb-btn" data-score="0">\u{1F44E} No</button>' +
    '<span class="fb-status" role="status"></span>';

  const status = row.querySelector('.fb-status');
  const buttons = [...row.querySelectorAll('.fb-btn')];

  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      buttons.forEach((b) => { b.disabled = true; });
      status.textContent = 'Sending…';
      try {
        const res = await fetch(`${GATEWAY_URL}/api/v1/${getDealerGuid()}/feedback`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationTurnId: turnId, score: Number(btn.dataset.score), comment: null })
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`${res.status} ${res.statusText}${detail ? ' — ' + detail.slice(0, 200) : ''}`);
        }
        buttons.forEach((b) => b.remove());
        row.querySelector('.fb-label').textContent = 'Thanks — that is now a row somebody reviews.';
        status.innerHTML =
          'Recorded as turn <span class="fb-turn"></span> · ' +
          `<a class="fb-link" href="${CONSOLE_URL}/eval-review" target="_blank" rel="noopener">` +
          'Open it in the DealerIQ console \u2197</a>';
        status.querySelector('.fb-turn').textContent = turnId;
      } catch (err) {
        // Surfaced, never swallowed: a thumb that fails silently makes the
        // review queue under-report and nobody finds out.
        buttons.forEach((b) => { b.disabled = false; });
        status.textContent = `Not recorded: ${err.message}`;
      }
    });
  });

  card.appendChild(row);
}

function _applyTheme(mode) {
  if (mode) document.documentElement.setAttribute('data-theme', mode);
  else document.documentElement.removeAttribute('data-theme');
}

/** Wiring that belongs to the shell rather than to the solution. */
function initShell() {
  const themeBtn = document.getElementById('themeBtn');
  themeBtn.addEventListener('click', () => {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const now = document.documentElement.getAttribute('data-theme');
    const next = now ? (now === 'dark' ? 'light' : 'dark') : (dark ? 'light' : 'dark');
    _applyTheme(next);
  });

  // The skill link is set by renderConnection(), which loadEnv() calls once the
  // .env override is actually known. Setting it here would freeze the default.
  loadEnv();
}
