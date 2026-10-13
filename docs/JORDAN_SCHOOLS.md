# Rated AI in Jordanian schools

Status: **pilot-ready software, not a pilot-ready product.** The software for Arabic/RTL and school accounts exists and is tested. Nothing here has been reviewed by a Jordanian lawyer, a native-speaking educator, or the Ministry of Education. Read "What must happen before a school uses this" first.

Decisions made with the owner: **private schools first**; first Arabic content band **Grades 1–6 (ages 6–12)**.

## What is implemented

| Area | What exists | Where |
|---|---|---|
| Arabic interface | Every screen in the kids' area, sign-in, consent, and the parent/teacher area is translated. Right-to-left layout, Arabic fonts (Baloo Bhaijaan 2 + Cairo, loaded from Google Fonts), language switch (saved on the account, defaults to the browser language). Western digits (0–9) throughout. | `client/src/i18n/`, `client/src/kid/kid.css` |
| Arabic games | Maths (equations stay left-to-right inside Arabic text), spelling (hand-written wrong spellings and a written clue), quiz (12 questions per age band), patterns. | `shared/games.ts` |
| Arabic AI and safety | The AI replies in the chat's language (cultural-respect rule in the system prompt). Arabic safety rules (self-harm, sexual, violence, drugs, personal info) with Arabic canned replies; Arabic text is normalised before matching. | `server/safety.ts`, `server/prompts.ts`, `shared/arabic.ts` |
| Read-aloud and voice input | Uses the browser's own Arabic voice (`ar-JO`) when installed. Many devices have none, so Spelling Bee then shows a written clue instead of speaking. | `client/src/kid/speech.ts` |
| School accounts | A second account type with its own consent wording (English and Arabic). Teachers create classes (Grades 1–12), add students one by one or by pasting/uploading a list of first names, and move or delete them. Students have no passwords or emails: they pick their name on the start screen, filtered by class. | `server/routers.ts`, `client/src/parent/` |
| Teacher view | Class progress table with real numbers (level, streak, games, % right, last played, activities done, last mood), per-game accuracy for the class, and "needs a check-in" prompts (no play for 7 days, <50% right after 20+ answers, flagged message or mood note). CSV download (UTF-8 with BOM so Excel shows Arabic; spreadsheet-formula characters neutralised). | `shared/classroom.ts`, `client/src/parent/ClassTab.tsx` |
| Activities | A teacher assigns a game and level to a class (optional note and due date). Students see it on their home screen; it counts as done when they finish that game at that level or higher after it was set. | `client/src/parent/AssignmentsTab.tsx` |
| Teacher PIN | Same server-side PIN lock as the parent area, so students on a shared device cannot open the teacher area. | `server/_core/trpc.ts` |

### For the school (safety, control, reporting)

| Area | What exists | Where |
|---|---|---|
| Safety inbox | Every flagged chat message or search, ranked (self-harm and "someone is hurting me" first), with student, class, a suggested next step and a "reviewed" mark; unread badge on the tab. The reason is re-derived from the local safety rules; the stored flag does not say why, so a message flagged only by the AI classifier shows as "flagged by the safety check". | `shared/safetyInbox.ts`, `server/routers.ts` (`safety`), `client/src/parent/SafetyTab.tsx` |
| Class controls | Per class: free chat on/off, Safe Search on/off, focus mode (students see only lessons, set activities and the mood check-in). Enforced on the server for chat and search (help with a shared lesson stays available); the other hidden screens are hidden by the app, not blocked by the server. | `school_classes` columns, `controlsFor` in `server/routers.ts` |
| Re-teach insights | Per shared lesson: hardest questions, the wrong answer most picked, who may need support or a challenge (computed locally), and an AI-written re-teach plan. The AI gets question text and counts only, never names. Needs 3 results. | `shared/insights.ts`, `lessons.insights` |
| Notes to parents | AI-drafted weekly class update or a note about one student, Arabic or English; facts only, no names or moods sent to the AI (name filled in afterwards), teacher edits, copy or print. Printable per-student progress report for parent meetings. | `letters.draft`, `classes.studentReport` |
| School overview | Students, weekly activity (8 weeks), lessons shared, quiz averages, check-ins needed, safety flags, by-class table, one-page printable report with "what these numbers mean". Covers the classes of the signed-in account only. | `shared/schoolReport.ts`, `school.overview` |
| Getting started | A four-step checklist ticked from real data; disappears when done. | `client/src/parent/GettingStarted.tsx` |
| iPad install | Web app manifest and home-screen meta tags, so the page can be added to the iPad home screen and opens full screen. No offline mode. | `client/public/manifest.webmanifest` |

Teacher area navigation is grouped: **Teach** (Lessons, Companion, Activities), **My classes** (Class progress, Classes and students, Parent notes), **Whole school** (School overview, Safety, Conversations), **Settings** (Privacy, Display).

How to pitch and pilot this: `docs/SCHOOL_PILOT_KIT.md`.

### Teacher companion (lessons)

The teacher area also works as a companion for teaching, not only for tracking.

| Feature | What it does |
|---|---|
| Lesson drafts | The teacher gives subject, grade, topic, length, language (Arabic or English) and optional notes; the AI drafts goals, warm-up, teaching steps with board points, worked examples, pair/group activities, a 4-option quiz, support/extension ideas, common misconceptions, homework and a student summary. |
| Textbook-grounded mode | The teacher can paste the textbook passage they teach from (up to 6,000 characters). The model is told to use only that passage. For **Islamic education a passage is required**: the app will not generate that subject from general knowledge. |
| Review and edit | Every part can be edited by hand; a malformed quiz question (not four distinct options and one correct answer) is dropped on save. "Improve it with the companion" rewrites the lesson from an instruction ("make it simpler", "add two quiz questions"). The screen says clearly that the draft is AI-written and must be checked. |
| Teach mode | A full-screen presenter for a projector or smart board: one idea per slide in large type, quiz answers and worked solutions revealed on demand, teacher notes hidden unless toggled, timer against the planned minutes, text size, full screen, keyboard control, optional read-aloud. Lesson text keeps its own direction (Arabic lessons are right-to-left; maths stays left-to-right). |
| Print | A printable lesson plan and a printable student quiz (no answers). |
| Share with a class | The student sees the summary and worked examples on their home screen and takes the quiz. The **server marks it**: students never receive the answers before submitting, only the first attempt counts, and XP is awarded once. The teacher sees the share of students who got each question right (what to re-teach) and who has not taken it. |
| Ask the companion | A chat for the teacher (explain a concept simply, examples, worksheets, activity ideas, notes to parents), optionally with a lesson as context. Nothing is stored. |

What it is not: it does not know the Ministry curriculum or textbooks (only what the teacher pastes), it has not been evaluated against real lessons by Jordanian teachers, and the AI can be wrong. Generated student-facing text is screened with the safety rules before it is saved, but that is a keyword filter, not a review. The teacher is responsible for what is taught and shared. Limits: 100 lessons per teacher, 12 AI drafts or rewrites per hour, 30 companion messages per 10 minutes, 10 shared lessons per class.

Limits (enforced server-side): 20 classes per teacher, 60 students per class, 400 students per school account, 10 open activities per class.

## What the numbers mean (and don't)

Class progress comes from game results the **app itself counts** (the browser reports how many answers were right; the server checks them for plausibility but cannot verify them). They show practice and accuracy in these games. They are **not** school grades, assessments or evidence of curriculum mastery, and the screens say so. The weekly summary / topic report in the family area is AI-written and labelled as a rough estimate; the teacher area deliberately does not use AI for any number.

## How it was checked

- 228 automated tests, including: Arabic generator correctness over hundreds of seeds, Arabic safety rules, an i18n coverage test (every string passed to `t()`/`T()`, shared data, and server error messages must have an Arabic entry with matching `{placeholders}`), class overview maths, roster parsing, and school API permission tests.
- Scripted browser runs (Playwright) in Arabic at phone and desktop width: no horizontal overflow on any page checked, equations isolated left-to-right, spelling clue mode, Arabic safety reply, language switch at runtime.
- A school flow run against a **real MariaDB database and the real server**: register as a school, school consent row (version, language, text hash), class creation, roster import (duplicate, phone number and email skipped), assignment stored, student plays an Arabic maths round and it is saved against that student, teacher sees it, CSV has a BOM and Arabic headers, a second school account cannot see or read any of it (HTTP 403), deleting a class keeps the students, deleting the account leaves zero rows.
- The lesson flow against the real database and server, driven in a browser: Arabic lesson draft, Islamic-education refusal without a passage, passage stored and sent to the model, teach mode across all slides with keyboard control and reveal, hand edit that drops an incomplete question, AI rewrite, share with a class, a student reading it (no answers or teacher notes visible), server-side grading (3 of 4), first-attempt-only XP, teacher results (per question and per student), companion chat not stored, another account blocked (HTTP 403), delete cascade.
- Not tested: a real AI model answering in Arabic (a local stand-in was used), real Arabic speech voices, real tablets or school networks, any load.

## What must happen before a school uses this

1. **Native-speaker educator review (required).** The Arabic interface text, the spelling and quiz banks, the consent wording and the safety word lists were written by an AI assistant. They need review by Jordanian teachers for correctness, tone, curriculum terminology (Ministry textbooks), gender (second-person verbs default to the masculine form), and age suitability. The Arabic safety lists have never been tested against real children's messages (dialects such as Jordanian/Levantine, transliterated Arabic, and typos will slip through). Digit style (Western vs Arabic-Indic) also needs a teacher's decision; the code uses Western digits.
2. **Legal review in Jordan (required).** See below. Consent text is a draft and the school consent assumes the school collects any parental consent the law requires: Rated AI does not verify it.
3. **A real-model evaluation in Arabic**: run a set of child-style questions (including Jordanian dialect and unsafe ones) through the chosen provider and the safety layer, and read the results.
4. **Hosting decision.** Where the data is stored and processed matters (see data transfers). The AI provider is configurable (any OpenAI-compatible API), which allows a provider hosted in a chosen region, but nothing is deployed yet; the owner chose to finish the product before hosting on `rated-ai.com`.
5. **Operational basics that do not exist yet**: password reset, email verification, a data-retention policy, teacher-side bulk student export, SSO/Ministry login, an audit of accessibility by a specialist.

## Legal and regulatory context (secondary sources; verify with a Jordanian lawyer)

These are summaries from compliance-vendor and law-firm articles found by web search, not the official Arabic text. Treat them as leads.

- **Personal Data Protection Law No. 24 of 2023.** Published in the Official Gazette on 17 September 2023 and in force six months later (about 17 March 2024), with a transition period for organisations to comply. Sources disagree about the exact end of the transition period and about how far the national supervisory body is operating. Summaries say parental consent is needed for children's data; **no source I found states the age threshold** (a page mentioning 16 is about the earlier 2022 draft, so it is not relied on), and the final text must be read. Summaries also say cross-border transfers are restricted unless adequate protection exists; accounts differ on who approves transfers. Sources: [Law No. 24 of 2023 (Clym)](https://regulations.clym.io/law-no-24-of-2023-jordan), [Clyde & Co](https://www.clydeco.com/en/insights/2023/10/jordan-issues-first-personal-data-protection-law), [KSandK privacy map](https://ksandk.com/privacy-review/map/jordan/), [Consentstack](https://consentstack.io/regulations/jo-pdpl).
- **Ministry of Education.** Jordan's Education Management Information System (EMIS) is the Ministry's own platform, built on OpenEMIS, and covers public and private schools ([UNESCO/OpenEMIS project record](https://communitysystemsfoundation.org/projects/unesco-jordan-openemis-p2356)). **I found no published process for approving third-party classroom apps for private schools.** Whether a private school needs Ministry approval, and how it is obtained, is unknown and must be asked directly (Private Education Directorate), ideally through a school that wants to pilot.
- **School structure used in the product.** Basic education Grades 1–10 and secondary Grades 11–12 (Tawjihi). Grades 1–3 use the youngest content band (ages 4–8), Grades 4–7 the middle band (9–12), Grades 8–12 the oldest. Arabic content has only been written with Grades 1–6 in mind.

## Open questions for the owner / pilot school

- Which private school(s) will pilot, which grades and subjects, and which devices (shared tablets, Chromebooks, phones)?
- Does the school want student accounts tied to its own roster/ID system? (Not built; today it is names only.)
- Which language mix: Arabic-only, or Arabic with English for English-language subjects?
- Who is the school's contact for privacy requests, and where may data be stored?
- What would the school need to see (a report, a data-protection agreement, an on-site demo) before agreeing?
