import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Logo from "@/kid/Logo";
import { t, useLang } from "@/i18n";
import LanguageSwitch from "@/i18n/LanguageSwitch";
import type { AccountType } from "@shared/jordan";

export default function AuthPage() {
  const utils = trpc.useUtils();
  const { lang } = useLang();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [accountType, setAccountType] = useState<AccountType>("family");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSuccess = () => {
    utils.invalidate();
  };
  const onError = (e: { message: string }) => setError(t(e.message));
  const login = trpc.auth.login.useMutation({ onSuccess, onError });
  const register = trpc.auth.register.useMutation({ onSuccess, onError });
  const busy = login.isPending || register.isPending;
  const school = accountType === "school";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "login") login.mutate({ email, password });
    else register.mutate({ email, password, name: name || undefined, accountType, language: lang });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-slate-50 flex items-center justify-center p-4">
      <LanguageSwitch className="fixed top-3 end-3" />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto"><Logo size={56} /></div>
          <CardTitle className="text-2xl">{t("Rated AI")}</CardTitle>
          <CardDescription>
            {mode === "login"
              ? t("Parents and teachers: sign in to let children learn safely.")
              : school
                ? t("Teachers: create a school account. Students use the app under your account.")
                : t("Parents: create a family account. Children use the app under your account.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div role="radiogroup" aria-label={t("Account type")} className="grid grid-cols-2 gap-2">
                {([["family", t("Family"), "🏠"], ["school", t("School"), "🏫"]] as const).map(([id, label, icon]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={accountType === id}
                    onClick={() => setAccountType(id)}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold ${accountType === id ? "border-teal-600 bg-teal-50 text-teal-900" : "border-gray-200 text-gray-700"}`}
                  >
                    <span aria-hidden="true">{icon}</span> {label}
                  </button>
                ))}
              </div>
            )}
            {mode === "register" && (
              <Input placeholder={school ? t("Your name or school name (optional)") : t("Your name (optional)")} value={name} maxLength={100} onChange={e => setName(e.target.value)} autoComplete="name" />
            )}
            <Input type="email" dir="ltr" placeholder={t("Email")} value={email} required maxLength={320} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            <Input
              type="password"
              dir="ltr"
              placeholder={mode === "register" ? t("Password (8+ characters)") : t("Password")}
              value={password}
              required
              minLength={mode === "register" ? 8 : 1}
              maxLength={128}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full bg-teal-700 hover:bg-teal-800">
              {busy ? t("Please wait…") : mode === "login" ? t("Sign in") : t("Create account")}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-teal-800 underline"
              onClick={() => {
                setError("");
                setMode(mode === "login" ? "register" : "login");
              }}
            >
              {mode === "login" ? t("New here? Create an account") : t("Already have an account? Sign in")}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
