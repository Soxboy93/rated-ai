import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLang } from "./index";

/** Switches between Arabic and English. When signed in the choice is also saved on the account. */
export default function LanguageSwitch({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  const { lang, setLang } = useLang();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const save = trpc.auth.setLanguage.useMutation({
    onSuccess: (_d, vars) => utils.auth.me.setData(undefined, u => (u ? { ...u, language: vars.language } : u)),
  });
  const next = lang === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      className={className}
      style={style}
      lang={next}
      aria-label={next === "ar" ? "التبديل إلى العربية" : "Switch to English"}
      onClick={() => {
        setLang(next);
        if (user) save.mutate({ language: next });
      }}
    >
      {next === "ar" ? "العربية" : "English"}
    </button>
  );
}
