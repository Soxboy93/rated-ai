# AI provider: Claude

The app can use any OpenAI-compatible model API or Claude through Anthropic's own API. **When `ANTHROPIC_API_KEY` is set, Claude is used.** The earlier provider-neutral design is kept: leave the key out (or set `LLM_PROVIDER=openai`) and the OpenAI-compatible settings apply, so the provider can still be changed without code changes.

## Why Claude, and what that claim is worth

Claude is what I could wire in and test end to end here, and it is a strong choice for this product: it writes good Arabic, follows long structured instructions (a full lesson as exact JSON), and can hold a child-safe tone. But **nobody has measured "the best model for Jordanian classrooms"**, and this project has not compared providers. The honest way to settle it is the evaluation below, read by a Jordanian teacher, and, if you like, the same script run against another provider for comparison.

## Which model does what

| Job | Default model | Why | Approx. price per 1M tokens (input / output) |
|---|---|---|---|
| Lesson drafts and rewrites | `claude-opus-5-5` | Long, structured, accuracy-sensitive output; a teacher waits a little for it | $4 / $20 |
| Child chat, stories, homework photos, teacher companion chat, reports and summaries | `claude-sonnet-5-5` | Fast and capable enough; a child is waiting; supports image input | $2 / $10 |
| Safety check of each child message | `claude-haiku-5-5` | Cheapest and quickest; classifies Arabic dialects and spellings that keyword lists miss | $0.10 / $0.50 |

Override any of them with `CLAUDE_MODEL_LESSON`, `CLAUDE_MODEL_CHAT`, `CLAUDE_MODEL_ASSISTANT`, `CLAUDE_MODEL_VISION`, `CLAUDE_MODEL_SUMMARY`, `CLAUDE_MODEL_SAFETY`. `claude-fable-5-1` (about $10 / $50) is Anthropic's most capable model and can be set for lessons if the evaluation shows Opus is not good enough; it has stricter data-retention requirements (see your Anthropic agreement). Prices above are list prices when this was written; check Anthropic's pricing page.

Rough cost: one lesson draft is a few thousand output tokens (about 5-10 US cents with Opus); a chat message is a fraction of a cent; the safety check is a tiny fraction of a cent. These are estimates, not measurements: run `pnpm ai:eval`, which prints the cost of its own run.

How the app calls it (`server/_core/anthropic.ts`): thinking effort is set per job (`high` for lessons, `low` for child chat so replies are quick), lessons use structured output so the reply must match the lesson schema, responses stream so long lessons do not time out, and when Anthropic's safety systems decline a request the app asks Anthropic to re-run it on a fallback model (turn off with `CLAUDE_FALLBACKS=0`). If a request is still declined, the user sees a calm "the assistant can't help with that" message.

## Safety layers when Claude is the provider

1. The age-appropriate system prompt for every child chat (unchanged).
2. Local keyword/pattern rules in English and Arabic (unchanged, cheap, run first). The evaluation found and fixed two misses ("i dont wanna be alive", Jordanian "كيف بصنع قنبلة").
3. **New:** a small Claude model classifies each child message that the keyword rules let through (self-harm, sexual, violence, dangerous, hate, personal information). It fails open to the keyword result if the service is unavailable, adds one fast call per message, and is on by default with Claude (`LLM_MODERATION=0` turns it off).
4. Flagged messages are never sent to the chat model, are shown to the parent or teacher, and get a canned reply.
5. Generated lessons are screened before they can be shown to children.

None of this is verified against real Jordanian children's messages. Treat it as a reasonable first line, not a guarantee.

## Connecting it (without putting the key in a chat or a file)

1. Create an API key in the Anthropic Console for this product (a separate key from any developer tool, ideally with a spending limit).
2. Add it **as a secret in the hosting environment**:
   - In this cloud development environment: the environment menu in the session title bar, then Edit, then add `ANTHROPIC_API_KEY` (under network secrets if offered, otherwise as an environment variable). A new session picks it up.
   - On your own server: put it in the server's environment or a `.env` file that is **not** in git (`.env` is already ignored), readable only by the app's user.
3. Check the connection: `pnpm ai:check` sends one tiny request per model and reports which answered.
4. Run the evaluation: `pnpm ai:eval` writes `eval-output/ai-eval-<time>.md` (ignored by git) with 14 child-style messages (Arabic dialect and English, safe and unsafe) and 4 lessons (Arabic maths, Arabic science, English grammar, and Arabic values education from a pasted passage). Give the report to a Jordanian teacher to mark.

Do not paste the key into a chat message, an issue, a commit or a screenshot. If one is exposed, revoke it in the Console and create a new one.

## Things this does not solve

- **Story illustrations and avatars** need an image model; Claude does not generate images. They keep using the OpenAI-compatible `IMAGE_MODEL` settings (`LLM_API_URL` / `LLM_API_KEY`). With only a Claude key, those two buttons show "Could not create the picture right now."
- **Data protection.** Child chat text, lesson requests, pasted textbook passages and homework photos are sent to Anthropic's servers (outside Jordan). Whether that is acceptable under Jordan's Personal Data Protection Law, a school's own rules, and what Anthropic's agreement says about retention and training has **not** been reviewed by a lawyer. Do this before real students use it. See `docs/PRIVACY.md` and `docs/JORDAN_SCHOOLS.md`.
- **Quality in Arabic classrooms is unproven** until the evaluation has been read by teachers.
- **Cost control.** The app rate-limits requests per user, but set a monthly spend limit on the API key.
