import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Gamepad2, Home, MessageCircle, UserRound } from "lucide-react";
import { levelProgress } from "@shared/gamification";
import { useChild } from "./ChildContext";
import { guideById } from "./guides";
import Avatar from "./Avatar";
import Logo from "./Logo";
import { t, T } from "@/i18n";
import LanguageSwitch from "@/i18n/LanguageSwitch";
import { useAuth } from "@/_core/hooks/useAuth";
import { playSound } from "./sound";

const NAV = [
  { href: "/", label: T("Home"), Icon: Home, match: (p: string) => p === "/" },
  { href: "/lessons", label: T("Lessons"), Icon: BookOpen, match: (p: string) => p.startsWith("/lesson") },
  { href: "/ask", label: T("Ask"), Icon: MessageCircle, match: (p: string) => p.startsWith("/ask") },
  { href: "/play", label: T("Play"), Icon: Gamepad2, match: (p: string) => p.startsWith("/play") || p.startsWith("/games") },
  { href: "/me", label: T("Me"), Icon: UserRound, match: (p: string) => p.startsWith("/me") || p.startsWith("/mood") },
];

/**
 * Every kid screen lives in this shell: a slim top bar (who is playing, language, grown-ups) and five places to go,
 * always in the same spot. `bare` hides the navigation (the "who's playing" screen).
 */
export default function KidShell({ title, back, bare = false, children }: { title?: string; back?: { href: string; label: string }; bare?: boolean; children: ReactNode }) {
  const { child, progress } = useChild();
  const { user } = useAuth();
  const [path] = useLocation();
  const school = user?.accountType === "school";
  const guide = guideById(child?.selectedCharacter);
  const lp = levelProgress(progress?.xp ?? 0);

  return (
    <div className="kid">
      <header className="k-top">
        <div className="kid-wrap">
          <Link href="/" className="k-brandmark" aria-label={t("Rated AI")}><Logo size={34} /><span className="k-brandtext">{t("Rated AI")}</span></Link>
          <span style={{ flex: 1 }} />
          {child && progress && progress.streakDays > 0 && (
            <span className="k-chip sun" title={t("{n} day streak", { n: progress.streakDays })}><span className="k-flame" aria-hidden="true">🔥</span>{progress.streakDays}</span>
          )}
          {child && (
            <Link href="/me" className="k-chip k-player" aria-label={t("{name}, level {level}", { name: child.childName, level: lp.level })} style={{ paddingInline: 5, textDecoration: "none" }}>
              <Avatar guide={guide} size={30} />
              <span className="k-player-name"><bdi>{child.childName}</bdi></span>
              <span className="k-chip brand" style={{ padding: "0 9px", fontSize: ".85rem" }}>{t("Lv {level}", { level: lp.level })}</span>
            </Link>
          )}
          <LanguageSwitch />
          <Link href="/parent" className="k-btn small light round" aria-label={school ? t("Teacher area") : t("Parent area")} title={school ? t("Teacher area") : t("Parent area")}>🔒</Link>
        </div>
      </header>
      <main className="kid-wrap" style={{ paddingBlock: 22 }}>
        {back && <Link href={back.href} className="k-btn small light" style={{ marginBottom: 14 }} onClick={() => playSound("tap")}>← {back.label}</Link>}
        {title && <h1 className="k-page-title">{title}</h1>}
        {children}
      </main>
      {!bare && child && (
        <nav className="k-nav" aria-label={t("Main")}>
          {NAV.filter(n => !(progress?.controls?.focus && (n.href === "/ask" || n.href === "/play"))).map(({ href, label, Icon, match }) => (
            <Link key={href} href={href} aria-current={match(path) ? "page" : undefined} onClick={() => playSound("tap")}>
              <Icon aria-hidden="true" />
              <span>{t(label)}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

