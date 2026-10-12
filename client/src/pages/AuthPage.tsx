import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function AuthPage() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSuccess = () => {
    utils.invalidate();
  };
  const onError = (e: { message: string }) => setError(e.message);
  const login = trpc.auth.login.useMutation({ onSuccess, onError });
  const register = trpc.auth.register.useMutation({ onSuccess, onError });
  const busy = login.isPending || register.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "login") login.mutate({ email, password });
    else register.mutate({ email, password, name: name || undefined });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-2xl">Rated AI</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Parents: sign in to let your child learn safely."
              : "Parents: create a family account. Children use the app under your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <Input placeholder="Your name (optional)" value={name} maxLength={100} onChange={e => setName(e.target.value)} autoComplete="name" />
            )}
            <Input type="email" placeholder="Email" value={email} required maxLength={320} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            <Input
              type="password"
              placeholder={mode === "register" ? "Password (8+ characters)" : "Password"}
              value={password}
              required
              minLength={mode === "register" ? 8 : 1}
              maxLength={128}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-purple-500 to-pink-500">
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-purple-700 underline"
              onClick={() => {
                setError("");
                setMode(mode === "login" ? "register" : "login");
              }}
            >
              {mode === "login" ? "New here? Create a parent account" : "Already have an account? Sign in"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
