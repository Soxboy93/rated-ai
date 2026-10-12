/**
 * Parental consent text, shown by the client and hashed by the server when consent is granted,
 * so each consent record proves exactly which wording the parent saw.
 *
 * DRAFT: this wording describes what the software actually does today. It has NOT had legal
 * review and must be reviewed (COPPA / GDPR-K / local law) before real families use the service.
 * Bump CONSENT_VERSION whenever any wording or data practice changes; parents are then asked again.
 */
export const CONSENT_VERSION = "2026-10-draft-1";

export const CONSENT_TITLE = "Before your child uses Rated AI";

export const CONSENT_POINTS: ReadonlyArray<{ heading: string; body: string }> = [
  {
    heading: "What we collect",
    body: "Your email address, and for each child you add: a first name or nickname and an age group (not a birth date). We also store the messages your child sends, the AI's replies, homework photos they submit, and the settings you choose.",
  },
  {
    heading: "Why",
    body: "To run the learning chat and tools, to show you what your child is doing, and to create progress summaries for you. We do not sell this data and do not use it for advertising.",
  },
  {
    heading: "Who else receives it",
    body: "Messages (and homework photos) are sent to an AI service provider so it can write replies. Messages that our safety checks flag are not sent to the AI model for a reply, but may be sent to the provider's moderation service when that is switched on.",
  },
  {
    heading: "You stay in control",
    body: "You can read every conversation. Flagged messages are highlighted for you. A parent PIN protects the parent area from your child. You can export or delete a child's data, withdraw this consent, or delete your whole account at any time from the parent area.",
  },
  {
    heading: "Safety checks have limits",
    body: "Safety checks are automated and will miss some things. They are not a substitute for supervision. Please tell your child not to share surnames, addresses, phone numbers or photos.",
  },
];

export const CONSENT_STATEMENT =
  "I am the parent or legal guardian of every child I add to Rated AI, and I agree to the above.";
