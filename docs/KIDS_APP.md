# The kids' app: what it does and how it works

Everything below is implemented and was exercised in a real browser against MariaDB (see "How it was checked"). Nothing here is mocked.

## Who is playing
A parent signs in once. Children pick their own profile on a "Who's playing?" screen (their guide's picture, their name). The age group comes from the parent-managed profile and decides question difficulty and the AI's tone. A child never needs an account or password; the parent PIN protects the parent area.

## Brain games (no AI involved)
Five games, each with three levels, generated on the device from the child's age group:

| Game | What happens | Notes |
|---|---|---|
| Number Ninjas | Arithmetic: adding/taking away (4-8), times tables and big numbers (9-12), percentages, negative numbers and simple algebra (13-17) | Answers are computed, so they are always correct (unit-tested over thousands of seeds) |
| Spelling Bee | The word is read aloud; pick the correct spelling from believable misspellings | Needs browser text-to-speech. If a device cannot talk, the game says so instead of showing the answer |
| Quiz Time | Facts about science, space, geography, animals, history, art | **12 hand-written questions per age group.** This is a small bank, not a curriculum, and has not been reviewed by an educator |
| Memory Match | Flip cards to find pairs; 3 to 10 pairs depending on age and level | Score is based on moves versus par |
| Pattern Pals | What comes next: colour/shape patterns, number sequences, squares, Fibonacci-style | |

Every question shows a short explanation after answering. Wrong answers are never punished beyond not scoring; a guide reacts kindly.

## XP, levels, streaks and badges
- A finished round earns 10 XP per right answer, +20 for a perfect round, +5 for finishing (capped per round). Level *n* starts at 40·(n−1)² XP.
- A streak counts consecutive days with at least one finished game, using the child's own calendar day.
- 17 badges (first game, perfect rounds, streaks, game counts, trying every game, levels, mood check-ins).
- Results are **reported by the browser and only sanity-checked by the server** (right counts must be possible, rounds cannot be faster than 0.4 s per question, rate limits, a plausible-date window). This stops casual forgery but is not cheat-proof. XP and badges are for motivation, not assessment.
- Progress is stored per child; all of it is deleted with the child or the account, and included in the data export.

## Other activities
- **Chat with a guide** (Sage, Phoenix, Nova, Echo): the AI chat with safety screening, plus read-aloud and (where the browser supports it) voice input.
- **Story Maker:** AI-written stories, read aloud on request. Picture generation needs an image-capable AI provider.
- **Doodle Pad:** drawing with brushes, rainbow, stamps, eraser, undo, paper colours and Save as PNG. **Drawings never leave the device.**
- **Homework Buddy:** photo of a problem; the AI returns steps, shown **one at a time** so the child can try first; the answer comes last. Photos are shrunk on the device before upload.
- **How I Feel:** mood check-in (7 moods). Older children can add a short note, which is screened like chat. Worrying notes get a kind reply and are flagged for the parent. Worried/angry/sad/tired moods offer an interactive breathing exercise.
- **My Pet:** feed and play to grow a pet. *The pet is per family account, not per child.*
- **Trophy Room:** level, badges (earned and locked), accuracy per game.

## Comfort and accessibility
Large text, easy-read letters (Lexend font with extra spacing), high contrast, calm mode (no animation, confetti or sound), night mode, sounds on/off. The first four are saved to the account so they follow the child across devices. Controls are real buttons with labels, keyboard operable (answers also on keys 1-4), and motion respects the system "reduce motion" setting. Not yet audited against WCAG by a specialist.

## What parents see (PIN-protected)
- **Progress:** per child: level, XP, streak, games played, accuracy per game (from real results), badges, and the last 14 mood check-ins with flagged notes.
- **Conversations:** flagged messages first, then every chat.
- **Children and privacy:** add/edit/delete children, download a child's data, consent, activity log, delete account.
- **Reports:** AI-written weekly summary and chat-topics report, clearly labelled as rough estimates, not grades.
- **Display:** the same comfort options.

## How it was checked
- 77 unit/API tests (`pnpm test`): game generators, XP/streak/badge rules, the progress API (consent, ownership, forged results, rate limits, mood screening), and all earlier safety/consent/PIN tests.
- The SQL (transaction with row lock, aggregates, cascades) was run against MariaDB, including four concurrent submissions with no lost XP.
- A scripted browser run (Playwright, 34 checks) registered a parent, added two children and used every screen: all five games, chat, story, doodle (real ink + PNG), mood (including a flagged note), pet, homework, trophies, accessibility settings persisting across reload, the parent area, data export, deleting a child with cascade checks, and phone-width layouts with no sideways scrolling. It found and fixed two real bugs (confetti freezing on screen after a popup was closed, and a collapsed XP bar on phones).
- The AI in those runs was a local stand-in, so AI-written content (stories, homework steps, chat replies, reports) was not evaluated for quality or safety against a real model.

## Not done / limits
- No educator review of content; the quiz bank is small. No claim of curriculum alignment.
- No offline mode, installable app, or native mobile app. No leaderboards or friend features by design (child privacy).
- Pet is per account. Homework history, report cards and weekly summaries are still per account, not per child.
- Daily time limits are stored nowhere yet; not enforced.
- Voice input and read-aloud depend on the browser and the voices installed on the device.
