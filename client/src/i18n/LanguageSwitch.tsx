import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import type { Lang } from "@shared/jordan";
import { useLang } from "./index";

/**
 * Always-visible two-button language toggle (العربية | English). One tap switches the whole app; when signed in the
 * choice is also saved on the account.
 */
export default function LanguageSwitch({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  const { lang, setLang } = useLang();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const save = trpc.auth.setLanguage.useMutation({
    onSuccess: (_d, vars) => utils.auth.me.setData(undefined, u => (u ? { ...u, language: vars.language } : u)),
  });
  const choose = (next: Lang) => {
    if (next === lang) return;
    setLang(next);
    if (user) save.mutate({ language: next });
  };
  return (
    <div className={`lang-toggle ${className}`} style={style} role="group" aria-label="اللغة / Language">
      <button type="button" lang="ar" aria-pressed={lang === "ar"} onClick={() => choose("ar")}>العربية</button>
      <button type="button" lang="en" aria-pressed={lang === "en"} onClick={() => choose("en")}>English</button>
    </div>
  );
}
