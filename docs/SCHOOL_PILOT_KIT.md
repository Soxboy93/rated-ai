# School pilot kit

For the owner: what to say to a school, what to show, how to run a first pilot, and what is **not** ready yet. Written to be honest, because a school that finds a gap you hid will not pilot with you twice.

## The pitch in one paragraph

Rated AI is a learning companion for primary students (Grades 1–6 first) in Arabic and English. A teacher turns a textbook page or a topic into a lesson in minutes; students learn it on a tablet as short cards, a practice game and a quiz, with a friendly guide who can explain it again and a safe search for curiosity. The teacher sees which questions the class missed and gets a re-teach plan, writes parents a note in a minute, and keeps control: chat and search can be switched off, focus mode shows students only what was set, and a safety inbox shows anything concerning. Students have no passwords, emails or photos in the app.

## What a school gets

| For | What |
|---|---|
| Teachers | AI-drafted lessons from a topic or a photo/PDF of the textbook page (you review and edit); teach mode for the board; printable plan and worksheet; share to a class; per-question results; **"what should I re-teach?"** with a plan; **parent notes** (class update or one student) in Arabic or English; printable progress report for parent meetings; a companion chat for ideas |
| Students | Home screen that says what is next; each lesson as **learn cards**, a **practice game** (instant feedback, not marked) and a **graded quiz**; ask the guide about the lesson; **Safe Search** answers written for their age; games, stories, drawing, mood check-in; read-aloud; accessibility options |
| Head teacher | **School overview**: students, weekly activity, lessons shared, quiz averages, who needs a check-in, safety flags; a one-page printable **report**; class-by-class table |
| Safety lead | **Safety inbox**: every flagged message or search, urgent first (self-harm or someone hurting the child), with the student, class, what to do and a "reviewed" mark; per-class **controls**; audit log |

## How safety works (say this plainly)

- Every message a child types is checked **before** it reaches the AI, by keyword rules in English and Arabic and, when Claude is the provider, by a second AI classifier. Flagged messages never reach the chat model; the child gets a kind, fixed reply and the teacher sees it in the inbox.
- Everything the AI writes for children is checked again. Lessons are screened before they are stored.
- A child saying someone is hurting them, or that they want to hurt themselves, is treated as a disclosure, not a rule violation: warm reply, "tell a grown-up you trust", teacher notified in the inbox as urgent.
- The AI never sees a child's name: parent notes and re-teach plans are written from counts and placeholders, and the name is filled in afterwards on the server.
- Safe Search is **not the open web**: it returns a short, AI-written answer with no links. Every search is saved and readable by the teacher.
- Teachers can switch chat and search off per class, or put the class in focus mode.
- **No safety system is perfect.** Say so. The checks can miss things and can flag harmless words. They support a teacher's care; they do not replace it. A school's child-protection procedure stays in charge.

## What is stored, and what leaves the building

Full table: `docs/PRIVACY.md`. Short version:

- Stored: teacher account (email), class lists with **first names or nicknames only**, scores and progress, chats and searches (so the teacher can read them), lessons, audit events. No student emails, passwords, photos, locations or contact details; names are screened for phone numbers and emails.
- Sent to the AI provider (Anthropic's Claude by default): the child's safe messages and searches, lesson requests and pasted/uploaded textbook text, quiz question texts and answer counts (no names), and homework photos. Flagged messages are not sent to the chat model (the Claude safety classifier does see them, to classify them).
- That means **student text leaves Jordan**. Under the Personal Data Protection Law (2023) a school may need to approve this and tell parents. This is a question for a Jordanian lawyer before a pilot (see `docs/JORDAN_SCHOOLS.md`). Offer the school a data-processing agreement and a one-page parent notice.

## A 15-minute demo

Use the preview (`https://claude.ai/artifact/68rMvmdLmTAiouLmTztxiV` while it exists). On the sign-in screen press **See the school demo**. Everything you see is example data in the browser; the AI answers are live Claude when the viewer allows it.

1. **Teacher area → Lessons → New lesson.** Upload a photo of a textbook page (or paste text), pick Grade 4 maths, Arabic. Show the draft, edit a quiz question, press **Teach this lesson**.
2. **Share it with 4A.** Open the student side, pick a student: *learn cards*, *practice game*, ask the guide "explain it another way", then the quiz.
3. **Results → What should I re-teach?** Show the hard question, the wrong answer most picked, the plan. Point out no names go to the AI.
4. **Parent notes → Write a draft.** Class update, then one student. Print.
5. **Safety.** Show the urgent item first. Say what a teacher would do. Show **Classes and students → Controls** (turn Safe Search off, turn Focus mode on, show the student home).
6. **School overview → Print the report.** "This is what you would show your owner or the Ministry visit."
7. Switch the language toggle to Arabic at any point.

## A pilot that can succeed (4–6 weeks)

- **Scope:** 1–2 classes, one grade (3–5), 1–2 subjects, a teacher who wants it, shared tablets or a few devices per class.
- **Week 0:** agree goals and the data/privacy paperwork; teacher gets 45 minutes of onboarding; tablets get the app added to the home screen (Safari → Share → Add to Home Screen; it opens full screen).
- **Weeks 1–2:** teacher shares one lesson a week; students use cards/game/quiz; you check the Safety inbox together every few days.
- **Weeks 3–4:** parent note home; one re-teach from the insights; one parent meeting report.
- **Week 5:** review.

**Measure from the overview report, not impressions:** share of students active each week, quizzes taken vs expected, quiz average on first attempts, number of re-teaches the teacher did, teacher time saved (ask: minutes to prepare a lesson before vs now), safety flags and how each was handled. Ask the teacher and a few parents five questions at the end.

**Decide up front what "worked" means** (for example: 70% of students active weekly, teacher says it saved at least 30 minutes a week, zero unhandled urgent flags). Do not claim learning gains from a 5-week pilot with no control group.

## Questions a school will ask

- **Does it replace the teacher?** No. The teacher decides what is taught; the AI drafts, the teacher edits. Students never get AI output the teacher has not set, except chat and search, which the teacher can switch off.
- **Is it aligned to the Jordanian curriculum?** Not certified. Lessons follow the textbook text the teacher pastes or uploads; for Islamic education the app refuses to write without a passage. A curriculum specialist must review the Arabic and the content before wide use.
- **Is the Arabic good?** It is a draft written by AI and not yet reviewed by a native educator. A Jordanian teacher should mark it before a pilot (`pnpm ai:eval` writes a report for that).
- **What happens if the AI is wrong?** Lessons are drafts the teacher checks; the quiz answers are the teacher's to confirm. Safe Search tells children to check big facts with a grown-up. Do not oversell accuracy.
- **Do children need accounts?** No. Students pick their name on the teacher's device; no passwords or emails.
- **Does it need internet?** Yes. There is no offline mode yet.
- **What does it cost?** Not decided. The AI cost is real and measurable (one evaluation run of four lessons plus chat cost about $0.46 in testing). Measure a pilot class's real usage before quoting a price.
- **Who is responsible for the data?** Decide who is the controller (usually the school) and processor (you) and write it down before the pilot.

## Not built yet (be upfront)

These are real gaps. The first three block a larger school.

1. **One account per teacher.** There is no school-level administrator who sees every teacher's classes. The School overview covers the classes of the account you are signed in to. A multi-teacher school needs school accounts with teacher invitations and roles.
2. **No roster or single sign-on integration** (names are typed or pasted in).
3. **Not hosted.** The app has run only in a test sandbox and a Claude preview. A school needs a hosted, backed-up service on a domain (rated-ai.com is intended) with monitoring.
4. Arabic text, safety word lists and lesson quality have **not been reviewed** by a Jordanian educator.
5. Legal review (privacy law, data leaving Jordan, parental consent wording, any Ministry approval for private schools) has **not** been done.
6. No live whole-class game, no parent login or portal (notes are printed or copied), no time-of-day limits, no offline mode.
7. Story pictures and avatars need a separate image service key; web search is not offered (safe search is AI-written).
8. Accessibility has been checked by scripts and by eye, not by an audit with users with disabilities. No load testing on real tablets or school networks.

## Before you meet a school

- [ ] Revoke the API keys that were pasted into chat during development, create a new one with a spend limit, and set it only in the server's environment.
- [ ] Have a Jordanian teacher mark the evaluation report and the Arabic interface.
- [ ] Ask a lawyer the data-leaving-Jordan and parental-consent questions.
- [ ] Host it (or run the preview as a supervised demo only) and say which one it is.
- [ ] Write the one-page parent notice and a data-processing agreement.
