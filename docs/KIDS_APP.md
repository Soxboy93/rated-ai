# The students' app: what it does and how it works

The product is deliberately small: lessons from the teacher, a safe place to ask questions, and three practice games. What was cut, and why, is in `docs/SCOPE.md`.

## Who is playing
A teacher (or parent) signs in once. Students pick their own profile on a "Who's playing?" screen (their guide's picture and their name; school students pick their class first). The age group comes from the profile and sets difficulty and the AI's tone. A student never has an account or password; the teacher/parent PIN protects the grown-ups' area.

## Five places, one bottom bar
| Place | What is in it |
|---|---|
| **Home** | Greeting, level and progress, **Up next** (the lesson to do, or to practise again), the student's lessons, a jump to Ask and Play |
| **Lessons** | Every lesson the teacher shared. Each opens as **learn cards**, a **practice game** (instant feedback, not marked, replayable), word cards and a matching game when the lesson has key words, and the **graded quiz** (answers shown only after submitting; first attempt counts). "Ask the guide about this lesson" explains it again, or lets the student teach it back |
| **Ask** | Three tabs: **Chat** with a guide (Sage, Phoenix, Nova, Echo), **Look up** (Safe Search), **Homework** (photo of a problem, steps shown one at a time after the student tries first) |
| **Play** | Number Ninjas (maths), Spelling Bee, Quiz Time; three levels each, generated on the device from the age group |
| **Me** | Level, streak, badges, how I feel (mood check-in), comfort settings, switch player |

In **focus mode** (a teacher setting per class) Ask and Play are hidden and blocked; only Home, Lessons and Me remain. On a tablet the bar becomes a left rail; on a phone it sits at the bottom. A language toggle (العربية / English) is always in the top bar.

## Games (no AI involved)
| Game | What happens | Notes |
|---|---|---|
| Number Ninjas | Arithmetic: adding/taking away (4-8), times tables and big numbers (9-12), percentages, negative numbers and simple algebra (13-17) | Answers are computed, so always correct (unit-tested over thousands of seeds) |
| Spelling Bee | The word is read aloud; pick the correct spelling | Needs browser text-to-speech; if the device has no voice (common for Arabic) a written clue is shown instead |
| Quiz Time | Facts about science, space, geography, animals, history, art | **12 hand-written questions per age group**: a small bank, not a curriculum, not reviewed by an educator |

Every question shows a short explanation after answering.

## XP, levels, streaks and badges
- A finished round earns 10 XP per right answer, +20 for a perfect round, +5 for finishing (capped per round). Level *n* starts at 40·(n−1)² XP.
- A streak counts consecutive days with at least one finished game, using the student's own calendar day.
- 15 badges (first game, perfect rounds, streaks, game counts, trying all three games, levels, mood check-ins).
- Results are **reported by the browser and only sanity-checked by the server** (right counts must be possible, rounds cannot be faster than 0.4 s per question, rate limits, a plausible-date window). This stops casual forgery but is not cheat-proof. XP and badges are for motivation, not assessment.
- Progress is stored per student; it is deleted with the student or the account and included in the data export.

## Safe Search and chat
**Safe Search** is not the open web. The student asks, the AI writes a short answer for their age (key facts, a "did you know", things to explore next, a "ask a grown-up" note on sensitive topics), with no links. The question goes through the same safety layers as chat (unsafe questions never reach the model), the answer is screened, and every search is saved so the teacher can read it. Chat is screened the same way. Teachers can switch either off per class.

## Mood check-in
Seven moods. Older students can add a short note, screened like chat. Worrying notes get a kind reply and appear in the teacher's safety inbox. Worried/angry/sad/tired moods offer a breathing exercise.

## Comfort and accessibility
Large text, easy-read letters (Lexend), high contrast, calm mode (no animation, confetti or sound), night mode, sounds on/off. Saved to the account so they follow the student across devices. Real, labelled buttons, keyboard operable (answers also on keys 1-4), motion follows the system "reduce motion" setting. Not yet audited against WCAG by a specialist.

## What grown-ups see
See `docs/JORDAN_SCHOOLS.md` (teacher area) and `docs/ADMIN.md` (platform owner). Families get **Progress** (level, XP, streak, accuracy per game, badges, recent moods), **Conversations** (flagged first) and **Settings** (children, privacy, data export, display).

## How it was checked
- 212 unit/API tests (`pnpm test`): game generators, XP/streak/badge rules, the progress API (consent, ownership, forged results, rate limits, mood screening), lessons and grading, class controls, the admin console, safety, i18n coverage.
- The SQL (transaction with row lock, aggregates, cascades) was run against MariaDB, including concurrent submissions with no lost XP.
- Scripted browser runs (Playwright) against the in-browser preview backend (students' and teachers' flows, admin console, uploads) and against the **real server and MariaDB** (school flow in Arabic, lesson flow, admin flow).
- The AI in those runs was a local stand-in, so AI-written content was not evaluated against a real model there; see `docs/AI_PROVIDER.md` for the one real-model evaluation.

## Not done / limits
- Arabic text, spelling/quiz banks and safety word lists have had no native-speaker educator review. No claim of curriculum alignment.
- No offline mode or native app (the page can be added to the iPad home screen). No leaderboards or friend features by design (child privacy).
- Daily time limits are not implemented.
- Voice input and read-aloud depend on the browser and the voices installed on the device.

## The Claude preview
`node scripts/build-demo.mjs <out.html>` builds the **real client** into one self-contained HTML file wired to an in-browser demo backend (`client/src/demo/mockServer.ts`, `vite.demo.config.ts`). It reuses the real game, XP, streak, badge and safety-screening code. Not real in the preview: accounts and the database (memory only, resets on reload) and the AI, which uses the viewer's own Claude account through the artifact `sample` capability and falls back to canned replies when that is unavailable.
