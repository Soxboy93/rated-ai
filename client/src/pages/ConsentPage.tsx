import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { consentFor } from "@shared/consent";
import { t, useLang } from "@/i18n";
import LanguageSwitch from "@/i18n/LanguageSwitch";

export default function ConsentPage({ contactEmail, accountType, version }: { contactEmail: string | null; accountType: "family" | "school"; version: string }) {
  const utils = trpc.useUtils();
  const { logout } = useAuth();
  const { lang } = useLang();
  const [, setLocation] = useLocation();
  const [agreed, setAgreed] = useState(false);
  const grant = trpc.consent.grant.useMutation({
    onSuccess: () => utils.consent.status.invalidate(),
  });
  const text = consentFor(accountType, lang);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-2xl">{text.title}</CardTitle>
            <LanguageSwitch className="shrink-0 rounded-full border px-3 py-1 text-sm font-semibold text-purple-800" />
          </div>
          <CardDescription>
            {accountType === "school"
              ? t("Please read how Rated AI handles your students' information.")
              : t("Please read how Rated AI handles your child's information.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="space-y-4">
            {text.points.map(point => (
              <div key={point.heading}>
                <dt className="font-semibold text-gray-900">{point.heading}</dt>
                <dd className="text-gray-700">{point.body}</dd>
              </div>
            ))}
          </dl>
          {contactEmail && (
            <p className="text-sm text-gray-600">
              {t("Questions or requests about your data:")} <span className="font-medium" dir="ltr">{contactEmail}</span>
            </p>
          )}
          <label htmlFor="consent-check" className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
            <input
              id="consent-check"
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
            />
            <span className="text-gray-900">{text.statement}</span>
          </label>
          {grant.error && <p className="text-sm text-red-600" role="alert">{t(grant.error.message)}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={!agreed || grant.isPending}
              onClick={() => grant.mutate({ version, language: lang, confirmParent: true })}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              {grant.isPending ? t("Saving…") : t("I agree and continue")}
            </Button>
            <Button variant="ghost" onClick={() => setLocation("/parent")}>{t("Manage or delete my data")}</Button>
            <Button variant="ghost" onClick={() => logout()}>{t("Sign out")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
