import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import KidShell from "./Shell";
import { useChild } from "./ChildContext";
import { guideById } from "./guides";
import { PracticeGame } from "./LessonGame";
import { t, currentLang } from "@/i18n";

/** A quick mixed review of what the class has learned lately: unmarked, instant feedback. */
export default function Boost() {
  const { child } = useChild();
  const [, go] = useLocation();
  const guide = guideById(child?.selectedCharacter);
  const q = trpc.studentLessons.boost.useQuery({ profileId: child?.id ?? "" }, { enabled: !!child, refetchOnWindowFocus: false });
  const questions = q.data?.questions ?? [];
  return (
    <KidShell title={t("Daily Boost")} color="var(--c-memory)">
      {q.isLoading ? <p className="k-muted">{t("Loading…")}</p> : questions.length === 0 ? (
        <div className="k-card" style={{ maxWidth: 560, margin: "0 auto", display: "grid", gap: 12, textAlign: "center" }}>
          <span style={{ fontSize: "2.4rem" }} aria-hidden="true">🚀</span>
          <p style={{ fontSize: "1.2rem" }}>{t("Your Daily Boost fills up when your teacher shares lessons. Check back soon!")}</p>
          <Link href="/" className="k-btn">🏠 {t("Home")}</Link>
        </div>
      ) : (
        <PracticeGame questions={questions} guide={guide} d={{ dir: currentLang() === "ar" ? "rtl" : "ltr", lang: currentLang() }} onExit={() => go("/")} />
      )}
    </KidShell>
  );
}
