import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CONSENT_POINTS, CONSENT_STATEMENT, CONSENT_TITLE, CONSENT_VERSION } from "@shared/consent";

export default function ConsentPage({ contactEmail }: { contactEmail: string | null }) {
  const utils = trpc.useUtils();
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [agreed, setAgreed] = useState(false);
  const grant = trpc.consent.grant.useMutation({
    onSuccess: () => utils.consent.status.invalidate(),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">{CONSENT_TITLE}</CardTitle>
          <CardDescription>Please read how Rated AI handles your child's information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="space-y-4">
            {CONSENT_POINTS.map(point => (
              <div key={point.heading}>
                <dt className="font-semibold text-gray-900">{point.heading}</dt>
                <dd className="text-gray-700">{point.body}</dd>
              </div>
            ))}
          </dl>
          {contactEmail && (
            <p className="text-sm text-gray-600">
              Questions or requests about your data: <span className="font-medium">{contactEmail}</span>
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
            <span className="text-gray-900">{CONSENT_STATEMENT}</span>
          </label>
          {grant.error && <p className="text-sm text-red-600" role="alert">{grant.error.message}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={!agreed || grant.isPending}
              onClick={() => grant.mutate({ version: CONSENT_VERSION, confirmParent: true })}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              {grant.isPending ? "Saving…" : "I agree and continue"}
            </Button>
            <Button variant="ghost" onClick={() => setLocation("/parent")}>Manage or delete my data</Button>
            <Button variant="ghost" onClick={() => logout()}>Sign out</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
