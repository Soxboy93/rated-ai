/** How the safety inbox ranks and explains flagged messages. Pure, so the server, the UI and the preview agree. */
import type { SafetyCategory } from "../server/safety";

export type InboxCategory = SafetyCategory | "other";
export type Urgency = "urgent" | "attention" | "info";

/** Self-harm and abuse disclosures come first; everything else is a conversation, not an emergency. */
export function urgencyOf(category: InboxCategory): Urgency {
  if (category === "self_harm" || category === "being_hurt") return "urgent";
  if (category === "personal_info" || category === "sexual" || category === "violence") return "attention";
  return "info";
}

export type InboxItem = {
  id: string;
  sessionId: string;
  studentId: string | null;
  studentName: string;
  className: string | null;
  content: string;
  /** "child" is something the student wrote; "reply" is an AI answer our own check blocked. */
  from: "child" | "reply";
  level: "review" | "blocked";
  category: InboxCategory;
  urgency: Urgency;
  createdAt: Date | null;
  reviewedAt: Date | null;
};

const RANK: Record<Urgency, number> = { urgent: 0, attention: 1, info: 2 };

/** Unreviewed before reviewed, then urgent before the rest, then newest first. */
export function sortInbox<T extends Pick<InboxItem, "urgency" | "reviewedAt" | "createdAt">>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (!!a.reviewedAt !== !!b.reviewedAt) return a.reviewedAt ? 1 : -1;
    if (a.urgency !== b.urgency) return RANK[a.urgency] - RANK[b.urgency];
    return (b.createdAt ? +new Date(b.createdAt) : 0) - (a.createdAt ? +new Date(a.createdAt) : 0);
  });
}
