# Privacy, consent and data map

Status of this document: describes what the **software does today**. It is not legal advice and the consent wording in `shared/consent.ts` is an unreviewed draft.

## What the product does

- A parent creates an account (email + password) and must agree to the consent text (`shared/consent.ts`) before any child data can be created or processed. The server enforces this on chat and every AI tool (`consentedProcedure`); hiding the UI is not what protects it.
- Consent is recorded per parent account: version, timestamp and a SHA-256 hash of the exact wording shown. Changing the wording requires bumping `CONSENT_VERSION`; parents who agreed to older wording are asked again and old consent no longer counts.
- Parents add up to 6 child profiles (first name or nickname, age group, favourite guide). No birth date, surname, email or photo is collected for a child; contact details in the name field are rejected.
- Each chat belongs to one child profile. The AI's age-appropriate style comes from the parent-managed profile, not from the child's request.
- Parent-only actions require the PIN unlock: add/edit/delete a child, download a child's data, withdraw consent, delete the account (which also needs the account password).
- **Export:** a child's profile and all their conversations as JSON.
- **Delete a child:** removes the profile and all that child's conversations and messages.
- **Withdraw consent:** chat and AI tools stop immediately; data is kept until the parent deletes it.
- **Delete account:** removes the user and every row keyed to it (profiles, chats, messages, homework, reports, summaries, pet, settings, consent records, audit log). Verified against a real MariaDB run.
- An audit log of privacy actions (consent, profile changes, exports, PIN changes) is shown to the parent.

## Data inventory

| Data | Where | Who can see it | Sent to third parties? |
|---|---|---|---|
| Parent email, name, password hash | `users` | The parent (own account); operator (database) | No |
| Child first name/nickname, age group, favourite guide | `userProfiles` | Parent; child sees their own name on the start screen | No |
| Chat messages and AI replies | `chatSessions`, `chatMessages` | Parent dashboard; operator (database) | Message text goes to the configured AI provider (`LLM_API_URL`) to generate replies. Flagged messages are not sent for a reply but may go to the provider's moderation endpoint if `LLM_MODERATION=1` |
| Homework photos | Sent to the AI provider for analysis; only the extracted question/solution text is stored (`homeworkSubmissions`) | Parent (via future UI); operator | Yes, the image goes to the AI provider |
| Teacher lesson plans (topic, notes, optional pasted textbook passage, AI-drafted content) | `lessons` | The teacher (own account); operator (database) | Yes: the request and any pasted passage go to the AI provider to write the lesson. Do not paste anything containing student data. |
| Teacher companion chat | Not stored | Nobody (cleared when the page closes) | Yes: the messages go to the AI provider |
| Shared lessons and students' quiz answers/scores | `lesson_shares`, `lesson_results` (answers, score, first attempt only) | The teacher of that class; the student sees their own score | No |
| Parent PIN | `parentalSettings` (bcrypt hash) | Nobody | No |
| Consent records, audit events | `parental_consents`, `audit_events` | Parent (audit); operator | No |

## What this is not (read before launch)

- **Not "verifiable parental consent" in the COPPA sense.** A checkbox inside a logged-in parent account is a consent record, not one of the FTC's recognised verification methods (e.g. a payment-card transaction, signed form, ID check or video call). The "email plus" shortcut does not cover this product because children's messages are disclosed to a third-party AI provider. If any user is under 13 in the US, get legal advice on the right verification method before launch.
- **Not a compliance certification** of any kind (COPPA, FERPA, GDPR, SOC 2). The same applies to the consent wording.
- **No data-processing agreements** with the AI provider, hosting provider or Cloudflare are included. They are needed.

## Schools (Jordan)

School accounts use separate consent wording (English and Arabic, version `2026-10-school-draft-1`). The school, not Rated AI, is responsible for any parental consent the law or school policy requires; Rated AI does not collect or verify it. Students have no emails or passwords, only a first name or nickname and a class. Jordan's Personal Data Protection Law No. 24 of 2023 may apply (parental consent for children's data, limits on transfers abroad); the age threshold and transfer rules have not been confirmed from the official text. See `docs/JORDAN_SCHOOLS.md`.

## Still to do

- Jordanian legal review of the Arabic and English consent wording and of data location/transfer to the AI provider.

- Legal review of the consent wording; a public privacy policy and terms page; a named privacy contact (`PRIVACY_CONTACT_EMAIL`).
- Retention policy and automatic expiry (nothing is deleted automatically today), plus backup/log deletion procedures.
- Verifiable parental consent method appropriate to your markets.
- Per-child scoping of the other features (homework history, report cards, weekly summaries, pet are still per account).
- Email notifications of consent/PIN/deletion events; password reset; email verification.
- A subprocessor list and a process for access/deletion requests that come by email.
