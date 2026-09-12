/* ═══════════════════════════════════════════════════════════════
   WORKSHOP 04 — COMPOSE A SPECIALIST

   This file is the whole solution: it asks the DealerIQ assistant a
   question and shows you the answer, plus the tools it reached for.

   You write no code today. You write a skill. By the end you have an
   assistant that answers real questions by orchestrating four servers
   nobody in this room owns — a public-repo reader, a library-docs index,
   Microsoft Learn and the AWS documentation — and the only thing you
   changed is a short markdown file on the platform.

   The four suggested questions are four acts. Ask them in order. Each
   one is there to make one thing visible in the "tools used" line under
   the answer, and the README says what to look for.
   ═══════════════════════════════════════════════════════════════ */

/**
 * The four acts. `ask` is the question; `watch` is the one thing to look at
 * in the answer and in the tools line. Order matters — each act assumes the
 * one before it landed.
 */
const ACTS = [
  {
    id: 'act-1',
    act: 'Act 1',
    title: 'Read a repository',
    ask: 'What does the GitHub repo modelcontextprotocol/servers do, and how is it organised?',
    watch: 'One server, one tool: deepwiki › ask_question. The assistant read the repository instead of remembering it — the Source line says so.'
  },
  {
    id: 'act-2',
    act: 'Act 2',
    title: 'A chain that must not be skipped',
    ask: 'Using the Context7 library documentation, how do I add a retry policy with Polly v8 in .NET?',
    watch: 'Two calls on ONE server, in order: context7 › resolve-library-id, then context7 › query-docs. The first call\'s output is the second call\'s input. If it skips step one, that is the failure to notice.'
  },
  {
    id: 'act-3',
    act: 'Act 3',
    title: 'Four servers, one question — who wins?',
    ask: 'What is the recommended way to retry failed HTTP requests in .NET?',
    watch: 'Three servers could answer this. Which one did? Then edit the skill to prefer a different kind of source, ask again, and watch the tools line change. The assistant chose from tool descriptions alone.'
  },
  {
    id: 'act-4',
    act: 'Act 4',
    title: 'Data, not prose',
    ask: 'Is Amazon Bedrock available in the ca-central-1 region?',
    watch: 'awsknowledge › aws___get_regional_availability returns a structured yes/no — the other three acts returned paragraphs. A check can assert on this one without a judge; the others need one.'
  }
];

// ── the app ──────────────────────────────────────────────────────

let _busy = false;

async function askAndRender(question) {
  if (_busy) return;
  _busy = true;
  clearBanner();
  setAsking(true);

  const card = openAnswerCard(question);
  try {
    if (!getToken()) await authenticate();
    // askSystem resolves to the answer TEXT; the tools it used are read back
    // with lastTools(). Destructuring the text as an object yields undefined
    // and renders a blank card rather than an error — the silent shape.
    const text = await askSystem(question);
    closeAnswerCard(card, text, lastTurnId(), lastTools());
  } catch (err) {
    // Surfaced, never swallowed. A specialist that fails quietly is worse
    // than one that says "I could not reach that".
    failAnswerCard(card, err.message);
    showBanner(err.message);
  } finally {
    setAsking(false);
    _busy = false;
  }
}

function __initSolutionApp() {
  initShell();
  renderQuestionChips(ACTS, askAndRender);

  const form = document.getElementById('askForm');
  const input = document.getElementById('askInput');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    input.value = '';
    askAndRender(question);
  });

  // Enter sends, Shift+Enter makes a new line.
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
}

window.__initSolutionApp = __initSolutionApp;
