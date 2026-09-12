# Compose a Specialist

Workshop 04. You are going to build an assistant that answers real questions
by reaching into four servers nobody in this room owns — and you will not
write a line of code to do it.

## What you will do

Ask four questions, in order. Under every answer the page shows **which
tools the assistant reached for, in what order, and how long each took.**
That line is the workshop. Each question — each *act* — is there to make one
thing visible in it.

Then you change one short file and watch the line change.

## Getting started

1. Clone this repo
2. Copy `.env.example` to `.env` and fill in your credentials (Champion Portal → Workshop Details)
3. Node.js LTS installed
4. `npx --yes http-server . -a localhost -p 3000 -c-1`
5. Open <http://localhost:3000>

The page is the whole solution: `index.html`, `helpers.js`, `solution.js`.
Nothing to install beyond a static server, nothing to build.

## The four servers

None of them is ours. They are public MCP servers the platform has been
pointed at for this event:

| Server | What it reaches | Why it is here |
| --- | --- | --- |
| `deepwiki` | any **public** GitHub repository | reading code you did not write |
| `context7` | library documentation, by library | two tools that **must be chained** |
| `mslearn` | Microsoft Learn | an authoritative first-party source |
| `awsknowledge` | AWS documentation | some answers come back as **data**, not prose |

The assistant chooses among them from their tool descriptions — written by
strangers — and from one file you can edit.

## The four acts

Click the chips in order, or paste the questions.

### Act 1 — Read a repository

> *What does the GitHub repo modelcontextprotocol/servers do, and how is it organised?*

**Watch for:** one server, one tool — `deepwiki › ask_question`. The
assistant *read the repository* rather than remembering it, and the `Source:`
line says so. Try a repo of your own if it is public; DeepWiki has to have
seen it before.

### Act 2 — A chain that must not be skipped

> *Using the Context7 library documentation, how do I add a retry policy with Polly v8 in .NET?*

**Watch for:** two calls on the **same** server, in order —
`context7 › resolve-library-id`, then `context7 › query-docs`. The first
call's output is the second call's input; there is no way to skip step one
and still get a right answer. This is what "agentic" means when it is not a
slogan: the model decided it needed two steps and did them in order.

### Act 3 — Four servers, one question. Who wins?

> *What is the recommended way to retry failed HTTP requests in .NET?*

Three of the four servers could answer this. **Watch for:** which one did.
Then open the skill (below), add one line — for example
*"For library questions, prefer the library's own documentation over vendor
guidance."* — publish, ask again, and watch the tools line move to a different
server. You changed which expert the assistant consults with a sentence.

### Act 4 — Data, not prose

> *Is Amazon Bedrock available in the ca-central-1 region?*

**Watch for:** `awsknowledge › aws___get_regional_availability`. Unlike the
first three acts, this tool returns a structured yes/no, not a paragraph. That
difference is the answer to a question workshop 3 left open — *when does a
check need a judge?* A structured field can be asserted on exactly; a paragraph
can only be judged.

## The skill, which is your lever

Every answer passes through **`workshop-4-answer-style`** — a short markdown
file stored on the platform and prepended to the model's instructions. It
reaches this page through an agent that binds it *by name*, which is why you
get this workshop's style and not another's. It is also why every answer ends
with a `Source:` line: the page separates that line out so you can see it is
the skill's doing.

To read or change it: <https://dev-dealeriq.csidealer.com> → sign in with the
email and password you were sent → **Studio** → **Skills** →
`workshop-4-answer-style`. Direct link: <https://dev-dealeriq.csidealer.com/skills>.
Edit, save, then **publish** — an unpublished edit changes nothing.

> 🔴 **One copy, shared by everyone in this workshop — and it cuts both ways.**
> Your edit changes the answers every other participant gets, immediately, and
> theirs changes yours. Whoever published last is the version in force. If the
> tools line suddenly looks different mid-exercise, this is usually why.

> 🔴 **Do not remove the `tools:` list at the top of the skill.** It is what
> makes the four servers reachable at all. Delete a line and that server
> disappears — for the whole room — until someone puts it back. Version history
> is kept, so it is recoverable; the recovery is shared too.

## What to take away

- An assistant's reach is **configuration**, not code: four servers arrived
  without a deploy, and your skill decides how they are used.
- **Tool descriptions are the interface.** Most of the ones you exercised were
  written by strangers, and the model chose among them anyway. Workshop 2 was
  about writing one well; this is what happens at scale.
- **Order is behaviour.** Act 2 is right or wrong depending on whether two
  calls happened in sequence — something you can only see in the tools line.
- **Data versus prose decides how you test.** Act 4 can be checked without a
  judge; Acts 1–3 cannot. That is the whole "do I need an eval judge?"
  question, answered by looking at one tool's output.

## Configuration

`.env` — see `.env.example` for every field. All values come from the
Champion Portal → Workshop Details. The console link defaults to the DEV
console and needs no entry.

## Troubleshooting

- **"No tools used — answered from memory."** The skill's `tools:` list is
  missing or the servers were not resolved for your credential. Check the skill
  first (someone may have published without the list), then ask again.
- **A tool shows ✗.** The third-party server refused or timed out. Ask again;
  if it persists, that server is down — the other three still work.
- **Act 1 says "Repository not found".** DeepWiki has not indexed that repo.
  Use `modelcontextprotocol/servers`, or visit `deepwiki.com/<owner>/<repo>`
  once and try again in a few minutes.
- **Authentication failed.** Re-copy `USERNAME`, `PASSWORD` and `CLIENT_SECRET`
  from the portal; a trailing space is enough to break it.
