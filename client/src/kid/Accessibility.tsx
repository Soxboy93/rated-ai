import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { isMuted, setMuted } from "./sound";

export type A11y = { largeText: boolean; easyRead: boolean; highContrast: boolean; calm: boolean; night: boolean; sound: boolean };

const Ctx = createContext<{ settings: A11y; update: (patch: Partial<A11y>) => void } | null>(null);

const readNight = () => { try { return localStorage.getItem("ra_night") === "1"; } catch { return false; } };

/**
 * Applies the child's accessibility choices to <html>. Large text / easy-read / contrast / calm are saved to the
 * account (so they follow the child across devices); night mode and sound are per device.
 */
export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const saved = trpc.accessibility.getSettings.useQuery();
  const save = trpc.accessibility.updateSettings.useMutation();
  const [local, setLocal] = useState({ night: readNight(), sound: !isMuted() });

  const settings: A11y = useMemo(() => {
    const s = saved.data;
    return {
      largeText: s?.fontSize === "large" || s?.fontSize === "xlarge",
      easyRead: !!s?.dyslexiaMode,
      highContrast: !!s?.highContrast,
      calm: !!s?.reducedMotion || !!s?.adhdMode,
      ...local,
    };
  }, [saved.data, local]);

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("a11y-large", settings.largeText);
    el.classList.toggle("a11y-easyread", settings.easyRead);
    el.classList.toggle("a11y-contrast", settings.highContrast);
    el.classList.toggle("a11y-calm", settings.calm);
    el.classList.toggle("theme-night", settings.night);
  }, [settings]);

  const update = useCallback(
    (patch: Partial<A11y>) => {
      if ("night" in patch || "sound" in patch) {
        setLocal(l => ({ ...l, ...("night" in patch ? { night: !!patch.night } : {}), ...("sound" in patch ? { sound: !!patch.sound } : {}) }));
        if ("night" in patch) { try { localStorage.setItem("ra_night", patch.night ? "1" : "0"); } catch { /* ignore */ } }
        if ("sound" in patch) setMuted(!patch.sound);
      }
      const next = { ...settings, ...patch };
      if (["largeText", "easyRead", "highContrast", "calm"].some(k => k in patch)) {
        save.mutate(
          {
            dyslexiaMode: next.easyRead,
            adhdMode: false,
            autismMode: false,
            fontSize: next.largeText ? "large" : "medium",
            highContrast: next.highContrast,
            textToSpeech: false,
            reducedMotion: next.calm,
          },
          { onSuccess: () => saved.refetch() }
        );
      }
    },
    [settings, save, saved]
  );

  return <Ctx.Provider value={{ settings, update }}>{children}</Ctx.Provider>;
}

export function useA11y() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useA11y must be used inside AccessibilityProvider");
  return c;
}
