# Rated AI — Codebase Audit & Feature Matrix

> **Historical record.** This audit describes the first version of the app. Most features named here were fixed, rebuilt or removed since; the current scope is in `docs/SCOPE.md`.

> **Update (same day, after the first remediation pass):** items marked **[FIXED]** in section 2 were addressed in the working tree after this audit was written; the feature matrix in section 3 and the build table describe the code **as audited (`08bcb9b`)**. See section 9 for what changed and what is still open. Nothing here has been run against a live database.

Audited commit: `08bcb9b` · Date: 2026-10-12 · Method: static read of `server/routers.ts`, `server/db.ts`, `drizzle/schema.ts`, `client/src/App.tsx` and the pages that call the API, plus running the checks.

Status key: **Implemented** (works end to end in code) · **Partial** (UI and/or schema exist but behavior is incomplete) · **Stub** (UI exists, server does nothing real) · **Planned** (not in the code) · **Unverified** (cannot be known from the code).

## 1. Build and test results

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `pnpm check` (`tsc --noEmit`) | **Passes** |
| `pnpm build` | **Passes** (client chunk 558 kB; Vite warns it is over 500 kB) |
| `pnpm test` | **Fails: no test files exist.** Vitest is configured for `server/**/*.test.ts`; there are none. |

## 2. Critical findings (fix before any public launch or buyer demo)

1. **[FIXED] Every user's children's data is readable by anyone, without logging in.**
   `chat.getAllSessionsPublic`, `chat.getAllMessagesPublic`, `homework.getHomeworkHistory`, `reports.generateReport`, `summaries.generate`, `challenges.getMyChallenges` and `teacher.getClassrooms` are `publicProcedure`s that query tables with no user filter (`server/routers.ts:102-109, 232-235, 310-313, 444-445`; `server/db.ts:142-152, 186`). Any visitor can download all chat transcripts and homework.
2. **[FIXED] There is effectively one shared user.** Almost every feature writes `userId: "anonymous"` (or `"user_default"` / `"teacher_default"`). No data is isolated per child, family, teacher or school. This also means the "multi-tenant" and "district" roadmap items have no foundation yet.
3. **[FIXED] The parent password gate is client-side only on the page that is routed.** `/parent` renders `SimpleParentDashboard`, which stores the password in browser `localStorage` and compares it locally (`client/src/pages/SimpleParentDashboard.tsx:16-39`), and then loads data from the public endpoints in (1). The bcrypt-backed server procedures (`parent.setupPassword` / `verifyPassword`) exist but are used only by `EnhancedParentDashboard.tsx`, which is not routed in `App.tsx`.
4. **[FIXED] "Kid-safe" is one sentence in a system prompt.** `chat.sendMessage` sends a single generic safety instruction (`server/routers.ts:63`). There is no input or output moderation, no self-harm/abuse escalation, and no age-based prompting. The `chatMessages.flagged` column (`safe/review/blocked`) is never written. Story and illustration endpoints pass the child's prompt through unfiltered.
5. **[FIXED] No rate limiting or length limits** on any public AI endpoint (`z.string()` with no `.max()`), so anyone can run up the LLM bill. `homework.analyzeHomework` accepts an arbitrarily large base64 string.
6. **Parental controls are not enforced.** `dailyLimit` and `allowedHours` are stored and editable but nothing reads them when a child chats.
7. **Child PII/COPPA exposure.** The app collects child names and free-text conversations from anonymous visitors with no consent flow, no age gate, no data-deletion path and no retention policy.

## 3. Feature matrix (what the code actually does)

| Feature | Route / component | Server procedures | Tables | Status | Evidence / gap |
|---|---|---|---|---|---|
| AI chat | `/` `EnhancedChat.tsx` | `chat.createSession`, `sendMessage`, `getMessages` | `chatSessions`, `chatMessages` | **Partial** | Works against the LLM and persists history, but sessions are `anonymous`, there is no ownership check on `sessionId`, and 4 characters (Sage, Phoenix, Nova, Echo) and 3 age-group prompts are defined in `shared/characters.ts`, but they are **never used**: the client sends only `{sessionId, message}` (`EnhancedChat.tsx:67`) and the server uses one generic system prompt. Character choice and age group therefore have no effect on AI behavior today. |
| Homework helper (photo → steps) | `/homework` | `homework.analyzeHomework`, `getHomeworkHistory` | `homeworkSubmissions` | **Partial** | Vision call returning structured JSON works in code; history is global (finding 1). `JSON.parse` is unguarded. |
| Story studio | `/story-studio` | `creative.generateStory`, `generateIllustration`, `generateAvatar` | `storyCreations` (unused) | **Partial** | Generation works; stories are never saved. |
| Virtual pet | `/pet` | `pet.*` | `virtualPets` | **Partial** | Feed/play logic is real but bound to `anonymous`, so all visitors share one pet. Pet is not tied to learning activity. |
| Report card | `/report-card` | `reports.generateReport`, `getLatestReport` | `reportCards` | **Partial** | Grades are LLM guesses from the first 50 user messages of **all users**. They are not assessments. On LLM failure it writes a fabricated "B+" in every subject (`routers.ts:407-411`) — this should be removed. |
| Weekly summary | `/weekly-summary` | `summaries.generate`, `getLatest`, `subscribe` | `weekly_summaries` | **Stub/Partial** | The LLM output is stored in `topicsCovered`, but strengths / areas to improve / recommendations are **hard-coded strings** (`routers.ts:490-492`). `subscribe` only `console.log`s the email; no email is ever sent. |
| Parent dashboard | `/parent` | `chat.get*Public`; `parent.*` (unrouted page) | `parentalSettings` | **Partial / insecure** | See findings 1, 3, 6. |
| Teacher dashboard | `/teacher` | `teacher.getClassrooms`, `createClassroom` | `classrooms` | **Stub** | Anyone can list/create classrooms; `teacherId` is constant; no students, rosters, assignments or analytics. |
| Curriculum alignment | none routed | none | `curriculum_standards` | **Planned** | Helpers `addCurriculumStandard` / `getStandardsByMessage` exist in `db.ts` but no router or UI uses them. |
| Peer challenges | `/challenges` | `challenges.create`, `getMyChallenges` | `peer_challenges` | **Stub** | Records can be created; there is no gameplay, matching, scoring or invite. |
| Accessibility modes | `/accessibility` | `accessibility.getSettings`, `updateSettings` | `accessibility_settings` | **Stub** | `getSettings` returns constants; `updateSettings` discards input (`routers.ts:604-617`). Settings are not saved or applied. |
| College prep (SAT/ACT) | `/college-prep` | `collegePrep.*` | `college_prep_progress`, `practice_questions` | **Stub** | Returns `[]` / `{success:true}`; no questions exist. |
| Achievements | `/achievements` | none | `achievements` | **Unverified/Stub** | No server procedure awards or lists achievements. |
| Voice chat | `VoiceChat.tsx` (component) | n/a | n/a | **Unverified** | Server `voiceTranscription.ts` exists; not wired to a router in this audit. |
| Authentication | `useAuth`, `ManusDialog` | `auth.me`, `auth.logout` | `users` | **Partial** | Login is **Manus OAuth** (`server/_core/oauth.ts`, `sdk.ts`). Needs replacing or re-hosting to run on `rated-ai.com` outside Manus. |
| RBAC | — | `protectedProcedure`, `adminProcedure` | `users.role` (user/admin) | **Partial** | Only user/admin exist; no parent/teacher/school-admin roles. |
| District / school hierarchy, bulk CSV, licenses, SSO/SAML, LMS (Classroom/Canvas/LTI), public API, white-label, audit logs, data deletion | — | none | `school_integrations` (schema only, stores tokens in plain text columns) | **Planned** | No code. The strategy document lists these as gaps and they remain gaps. |
| Compliance (COPPA/FERPA/GDPR/SOC 2) | — | none | none | **Not achieved** | No certification or documented controls exist. |

## 4. Infrastructure and claims that don't match the code

- **LLM provider:** the strategy document and `.env.example` say "GPT-4 / OpenAI". The code calls the **Manus Forge gateway** (`https://forge.manus.im/v1/chat/completions`, model `gemini-2.5-flash`, `BUILT_IN_FORGE_API_KEY`) in `server/_core/llm.ts`. `OPENAI_API_KEY` in `.env.example` is not read. Image generation, storage, notifications and the data API use the same Forge env vars.
- **`.env.example` is a generic template** ("Todo App", placeholder IDs) and omits the variables the server actually reads (`BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `OWNER_OPEN_ID`).
- **Database:** MySQL via Drizzle; 9 migrations are present. Not verified against a live database in this audit.
- **Deployment:** the Manus URLs in the handoff are unverified; `rated-ai.com` has no deployment config in the repo.
- **Branding:** `package.json` name is `kidsafe-ai-assistant`; UI/env still refer to "KidSafe"/"Todo App" in places.

## 5. Claims in earlier material that must not be repeated

`docs/traction.html` and `ENTERPRISE_UPGRADE_STRATEGY.md` contain statements that this audit does not support:

| Claim | Status |
|---|---|
| "100% Product Ready – fully functional platform deployed and tested" | **False** — see sections 2 and 3; there are no tests. |
| "15+ features built / more than Hello Wonder at acquisition" | **Misleading** — several of the features are stubs; the comparison is unsourced. |
| "$5M+ market validation — comparable startup acquired by Noggin (Oct 2025)" | **Unverified.** No source in the handoff. |
| Valuation estimates ($100K → $25M by tier; "+$13M–$25M" in commit messages) | **Unsupported hypotheses.** |
| The "Fake it till you make it" option (mock admin portals with fake data, claimed LMS integrations/certifications) | **Do not use.** Misrepresenting product capability to a buyer is misrepresentation and creates legal exposure for the owner; the handoff's own truthfulness rule forbids it. |

## 6. Recommended order of work

Estimates are rough single-engineer days and assume the hosting/LLM decisions in section 7 are made first.

| # | Work | Why first | Est. |
|---|---|---|---|
| 1 | Remove the public data endpoints; scope every query by authenticated user; verify session ownership; add `.max()` limits and rate limiting | Fixes findings 1, 2, 5. Required before any demo with real data. | 2–3 d |
| 2 | Family model: parent account → child profiles; server-side parent PIN (bcrypt) replacing the localStorage gate; route the `parent.*` procedures | Findings 3, 6; foundation for school hierarchy | 3–4 d |
| 3 | Safety layer: input/output moderation, `flagged` written, parent alert on flagged content, character + age-group persona actually sent to the LLM, remove the fabricated "B+" fallback | Finding 4; the core product promise | 3–4 d |
| 4 | Consent, age gate, data export + deletion, retention policy, audit log | COPPA-style foundations (compliance still requires legal review) | 4–5 d |
| 5 | Tests (Vitest) for routers' auth/ownership and moderation; CI | Currently zero | 2 d, ongoing |
| 6 | Tenancy + RBAC: `organizations → schools → classes → members`, roles, org-scoped queries | Enterprise prerequisite | 5–7 d |
| 7 | One LMS integration (Google Classroom OAuth + roster sync, or LTI 1.3) | After 6 | 7–10 d |
| 8 | Replace Manus OAuth/Forge dependencies with provider-neutral auth and LLM config; deployment docs for `rated-ai.com` | Needed to host independently | 3–5 d |
| 9 | Finish or remove the stubs (accessibility persistence, college prep, challenges, achievements) | Avoid claiming what doesn't work | 5+ d |

## 7. Decisions needed from the owner

1. **Hosting/provider:** stay on Manus (Forge LLM + Manus OAuth), or migrate to a provider-neutral stack (e.g., your own OpenAI/Anthropic key and a standard auth provider)?
2. **Primary target:** consumer families first, or schools first? This sets whether step 2 or step 6 comes next.
3. **Anonymous use:** should a child be able to chat without a parent account? (Recommended: no.)
4. **Legal:** who will review COPPA/FERPA/GDPR obligations? The code can implement controls but cannot make the product compliant by itself.
5. **Provenance for market claims:** any comparable-acquisition or market figure needs a cited source before it appears in buyer material.

## 8. Due-diligence questions a buyer will ask

- Who owns the IP (any contractors, any generated assets' licenses)? The AI-generated characters/logo license terms need checking.
- Which third parties receive child data (LLM gateway, storage, analytics), and under what agreements?
- Is any production data already stored from the existing deployment, and does it include real children's data exposed by finding 1?
- Evidence of users, revenue, or pilots — none is present in the repository.

## 9. Remediation pass (working tree, uncommitted)

**Changed**
- Authentication is now first-party email + password (bcrypt, 30-day signed `httpOnly`/`SameSite=Lax` cookie). Manus OAuth, the Forge LLM/image/storage/notification/data/voice modules, the Manus Vite plugin and unused AWS/axios dependencies were removed. The LLM client talks to any OpenAI-compatible API (`LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`).
- The whole client now requires a parent account. All routers use the signed-in user's id; the public all-users endpoints were deleted; chat sessions are ownership-checked.
- Parent PIN is verified on the server (bcrypt) and unlocks a 15-minute signed cookie that `parentProcedure` requires. The PIN hash is never returned.
- Character and age-group prompts are now actually sent to the model. Input is screened before the model (self-harm → supportive reply + flagged for parents; sexual/violent/dangerous → refused; phone/email/address → asked not to share). Model output is screened for blocked categories. Flags are stored in `chatMessages.flagged` and shown to parents.
- Input length limits, per-user rate limits (chat, creative, homework, reports, PIN attempts, login/register), 8 MB body limit, basic security headers.
- Removed fabricated output: the "B+ in everything" report-card fallback and the hard-coded weekly-summary strengths/recommendations. Failures now return an error. The fake "email subscribed" flow and the always-green "Safe" badge were removed.
- Accessibility settings are now persisted per user.
- 34 Vitest tests added (`pnpm test`): auth required, tenant isolation, PIN gate, persona prompts, safety screening, rate limiting, no fabricated reports. A mutation check confirmed the ownership test fails when the check is removed.

**Still open (not done, not claimed)**
- Child profiles under a family account (one chat identity per child), consent/age-gate, data export and deletion, retention policy, audit log.
- Daily limit / allowed-hours enforcement; email delivery; password reset; email verification.
- Multi-tenant org → school → class model, RBAC beyond user/admin, LMS integration, SSO, public API.
- Stubs: college prep, peer challenges (no gameplay), achievements (no awarding), curriculum alignment (no UI), teacher dashboard (no students).
- Moderation quality has not been evaluated against a test set; false negatives are expected.
- A real MySQL run, the drizzle migration against existing data, and browser E2E testing have not been done in this environment.
- Compliance (COPPA/FERPA/GDPR/SOC 2): no certification or legal review.

## 10. Per-child profiles and consent (second pass)

Added: parental consent gate (versioned, hashed wording, enforced server-side on chat and all AI tools), child profiles (max 6, first name/nickname + age group + favourite guide), chats linked to a profile with the age group taken from the profile, PIN-gated add/edit/delete/export, withdraw consent, delete account (password + PIN), and a privacy audit log. Migration `0011`. 52 automated tests; the full flow was also driven in a real browser against MariaDB with database assertions (consent row, profile link, export content, cascade deletes, zero rows left after account deletion, no orphaned messages).

Not done: see `docs/PRIVACY.md` ("What this is not", "Still to do"). Notably the consent here is **not** COPPA-style verifiable parental consent, there is no retention policy, and homework history, report cards, weekly summaries and the pet are still per account rather than per child.

## 11. Redesign and kid-facing features (third pass)

The whole client was rebuilt around a kid-friendly "sticker book" design (see `docs/KIDS_APP.md`): a player picker, a home hub with daily missions, five real mini-games with XP/levels/streaks/badges stored per child, a chat redesign with read-aloud and voice input, story maker, doodle pad, mood check-in with a breathing exercise, trophy room, pet, homework buddy that reveals steps one at a time, accessibility settings that really apply, and a tabbed parent area with real per-child progress. Migration `0012`.

Removed because they did nothing real: peer challenges, college prep, the teacher dashboard and the old achievements page, plus their server routes. They were listed as stubs in section 3. The unused hero banner moved to `design-assets/`; character art was cut out to transparent and shrunk from ~1.8 MB to ~50 KB each.

Verification: 77 unit/API tests; real SQL run against MariaDB; a 34-check scripted browser run. See `docs/KIDS_APP.md` ("How it was checked", "Not done / limits"). Not done: educator review of content, a specialist accessibility audit, real-model evaluation of AI output, per-child scoping of homework/report/summary/pet data.

## 12. Jordan schools: Arabic and school accounts (fourth pass)

Added: Arabic/RTL for the whole client with a coverage-tested dictionary; Arabic game content and safety rules; school account type with its own consent wording, classes, roster import, teacher class-progress view with CSV export, and class activities shown on students' home screens. Migration `0013`. 137 unit/API tests; scripted Arabic browser runs; a school flow run against real MariaDB with database assertions (see `docs/JORDAN_SCHOOLS.md`).

Not done and must not be claimed: no native-speaker educator review of any Arabic text, no legal review, no real-model evaluation in Arabic, no Ministry approval pathway known, nothing deployed. Legacy `teachers`/`classrooms`/`school_integrations` tables from the original code still exist in the schema and are unused.

## 13. Teacher companion (fifth pass)

Added: AI-drafted lesson plans (with an optional pasted textbook passage; required for Islamic education), editing and AI rewrite, a full-screen teach mode, printable plan and quiz, sharing a lesson with a class with a server-graded quiz (first attempt only, XP once), per-question class results, and a stateless teacher chat. Migration `0014`. 160 unit/API tests; a browser run of the whole flow against real MariaDB with database assertions (see `docs/JORDAN_SCHOOLS.md`).

Not done and must not be claimed: no Jordanian teacher has reviewed generated lessons; no curriculum or textbook alignment (the app only knows what a teacher pastes); a real model was not used in testing (a stand-in returned fixed lessons); photos of textbook pages, whiteboard capture, live classroom (real-time) quizzes, and lesson sharing between teachers are not built.

## 14. Claude connected (sixth pass)

Added: Claude through Anthropic's API as a selectable provider (`server/_core/anthropic.ts`), per-job models and thinking effort, structured lesson output, refusal handling with server-side fallbacks, a Claude safety classifier for child messages, `pnpm ai:check` and `pnpm ai:eval`, and `docs/AI_PROVIDER.md`. The OpenAI-compatible path is unchanged and still the default without a key. The key is read from `ANTHROPIC_API_KEY` or `RATEDAI_CLAUDE_KEY` (Claude Code environments drop the first name). 178 tests (the SDK is mocked; request shapes, fallbacks, refusal and classifier behaviour are tested).

**Verified live (2026-10-13):** `pnpm ai:check` and `pnpm ai:eval` ran against the real models; results and one fixed safety miss (a child reporting bullying was refused as "violence") are in `docs/AI_PROVIDER.md`. Unit tests are isolated from real providers. **Not verified:** teacher judgement of any output. No claim is made that Claude is better than other providers for Jordanian classrooms; that needs the teacher-read evaluation. Data-protection and retention terms have not been reviewed.
