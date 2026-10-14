# What Rated AI is (and what it is not)

One sentence: **a teacher turns a textbook page into a lesson; students learn it on a tablet; the app keeps them safe and tells the teacher what to do next.**

Anything that did not serve that sentence was removed in the "simplify" pass. This page records what stays, what went, and why, so nobody adds it back by accident.

## For students (five places, always in the same spot)

| Place | What it holds |
|---|---|
| **Home** | Greeting, level, **Up next** (the one thing to do), your lessons, two big buttons |
| **Lessons** | Every lesson the teacher shared: learn cards, word cards and a matching game, a practice game, the graded quiz, and "ask the guide about this lesson" (including *teach it back*) |
| **Ask** | One page, three modes: **Chat** with the guide, **Look up** (safe, AI-written, no links), **Homework** (photo, one step at a time, "have a go first") |
| **Play** | Three practice games: Number Ninjas, Spelling Bee, Quiz Time. XP and streaks |
| **Me** | Level, streak, badges, a mood check-in, display and accessibility settings, switch player |

## For teachers (six places)

**Overview** (class progress, who needs a check-in, getting started, whole-school numbers on request) · **Lessons** (create from a topic or a photo/PDF, edit, teach on the board, share, results, "what should I re-teach?") · **Classes** (students, controls: chat, search, focus mode) · **Parent notes** (AI-drafted letters, printable progress report) · **Safety** (inbox, then every conversation) · **Settings** (privacy and data, display).

## For parents (three places)

**Progress** · **Conversations** · **Settings** (children, privacy, display).

## For the platform owner

The **administrator console** (`docs/ADMIN.md`): every school, family and student, support actions, an activity log, everything audited.

## Removed, and why

| Removed | Why |
|---|---|
| Story Maker, Doodle Pad, My Pet | Fun, but not learning, and Story needed a separate image service. Three more things to explain to a school |
| Memory Match, Pattern Pals | Two of five games with little curriculum value. Three games are enough to practise with |
| Daily Boost | A fourth way to practise next to games, practice and quiz |
| Separate Chat, Safe Search and Homework screens | Merged into one **Ask** page |
| Trophy Room as its own page | Folded into **Me** |
| Teacher "Activities" (assigning a game) | Lessons are the assignment now |
| Teacher "Companion" chat | The lesson editor and "make it simpler / shorter" already do this |
| Family AI "Reports" and weekly summaries | AI-written grades add risk and little value; the Progress tab shows the real numbers |
| Separate "Class progress" and "School overview" tabs, "Conversations" tab for teachers | One Overview; conversations now sit under Safety |
| 24 unused database tables, 40 unused UI components, a 1,400-line component showcase, the image-generation module | Dead code from the original template. The database is not hosted yet, so migration `0017` simply drops the tables |

## The rule for adding things

A new feature has to make the one-sentence goal faster, safer or clearer for a teacher or a student. If it is "also fun" or "also possible", it does not go in. Write the reason here first.

## Look and feel

Warm cream paper, white cards with a clear outline and a flat "ledge" shadow, buttons that press down like keys, one indigo brand colour, sunny yellow for streaks and "up next". One design system for students, teachers, parents and admins (`client/src/kid/kid.css` for the kids' area, brand tokens in `client/src/index.css` for everything else). Arabic and English are equal: the language toggle is always visible and the layout mirrors.
