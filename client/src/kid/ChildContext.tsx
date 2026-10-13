import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { badgeById } from "@shared/gamification";
import Confetti from "./Confetti";
import { playSound } from "./sound";
import { t } from "@/i18n";

export type Progress = inferRouterOutputs<AppRouter>["progress"]["get"];
export type AgeGroup = "kids" | "tweens" | "teens";
export type Child = { id: string; childName: string; ageGroup: AgeGroup; selectedCharacter: string | null; classId?: string | null };
export type Celebration = { badges?: Array<{ id: string; name: string; icon: string }>; levelUp?: number | null; title?: string };

type Ctx = {
  child: Child | null;
  profiles: Child[] | undefined;
  profilesLoading: boolean;
  selectChild: (id: string | null) => void;
  progress: Progress | undefined;
  refreshProgress: () => Promise<unknown>;
  celebrate: (c: Celebration) => void;
  localDay: () => string;
};

const ChildCtx = createContext<Ctx | null>(null);

export const localDay = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const STORE_KEY = "ra_child";
const readStored = () => { try { return sessionStorage.getItem(STORE_KEY); } catch { return null; } };

export function ChildProvider({ children }: { children: ReactNode }) {
  const profilesQ = trpc.profiles.list.useQuery();
  const [childId, setChildId] = useState<string | null>(readStored);
  const [celebration, setCelebration] = useState<(Celebration & { key: number }) | null>(null);
  const [queue, setQueue] = useState<Celebration[]>([]);
  // Keep the last burst key after the popup closes so closing it does not cut the confetti off.
  const [burstKey, setBurstKey] = useState(0);

  const profiles = profilesQ.data as Child[] | undefined;
  const child = profiles?.find(p => p.id === childId) ?? null;

  const progressQ = trpc.progress.get.useQuery({ profileId: child?.id ?? "", localDay: localDay() }, { enabled: !!child });

  const selectChild = useCallback((id: string | null) => {
    setChildId(id);
    try { id ? sessionStorage.setItem(STORE_KEY, id) : sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
  }, []);

  // If the stored child no longer exists (deleted by a parent), fall back to the picker.
  useEffect(() => {
    if (profiles && childId && !profiles.some(p => p.id === childId)) selectChild(null);
  }, [profiles, childId, selectChild]);

  const celebrate = useCallback((c: Celebration) => {
    if (!c.badges?.length && !c.levelUp) return;
    setQueue(q => [...q, c]);
  }, []);

  useEffect(() => {
    if (!celebration && queue.length) {
      // Several wins in a row (e.g. a level-up and two badges) become ONE popup, so a child taps once.
      const merged: Celebration = {
        badges: queue.flatMap(c => c.badges ?? []).filter((b, i, all) => all.findIndex(x => x.id === b.id) === i),
        levelUp: queue.reduce<number | null>((max, c) => (c.levelUp && (!max || c.levelUp > max) ? c.levelUp : max), null),
      };
      setQueue([]);
      const key = Date.now();
      setBurstKey(key);
      setCelebration({ ...merged, key });
      playSound(merged.levelUp ? "levelup" : "badge");
    }
  }, [queue, celebration]);

  const value = useMemo<Ctx>(
    () => ({
      child, profiles, profilesLoading: profilesQ.isLoading, selectChild,
      progress: progressQ.data, refreshProgress: () => progressQ.refetch(), celebrate, localDay,
    }),
    [child, profiles, profilesQ.isLoading, selectChild, progressQ.data, progressQ.refetch, celebrate]
  );

  return (
    <ChildCtx.Provider value={value}>
      {children}
      <Confetti fire={burstKey} />
      {celebration && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("Celebration")}
          className="fixed inset-0 z-[90] grid place-items-center p-4"
          style={{ background: "rgba(20,12,60,.55)" }}
          onClick={() => setCelebration(null)}
        >
          <div className="k-card k-in text-center" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            {celebration.levelUp ? (
              <>
                <div className="display" style={{ fontSize: "3.5rem" }} aria-hidden="true">🎉</div>
                <h2 style={{ fontSize: "2rem" }}>{t("Level {level}!", { level: celebration.levelUp })}</h2>
                <p className="k-muted" style={{ marginTop: 6 }}>{t("You're getting stronger every day.")}</p>
              </>
            ) : null}
            {celebration.badges?.map(b => (
              <div key={b.id} style={{ marginTop: 14 }}>
                <div className="k-bob" style={{ fontSize: "4rem" }} aria-hidden="true">{badgeById(b.id)?.icon ?? b.icon}</div>
                <h2 style={{ fontSize: "1.7rem" }}>{t("New badge: {name}!", { name: t(badgeById(b.id)?.name ?? b.name) })}</h2>
                <p className="k-muted">{t(badgeById(b.id)?.description ?? "")}</p>
              </div>
            ))}
            <button className="k-btn" style={{ marginTop: 18 }} onClick={() => setCelebration(null)} autoFocus>{t("Awesome!")}</button>
          </div>
        </div>
      )}
    </ChildCtx.Provider>
  );
}

export function useChild() {
  const ctx = useContext(ChildCtx);
  if (!ctx) throw new Error("useChild must be used inside ChildProvider");
  return ctx;
}
