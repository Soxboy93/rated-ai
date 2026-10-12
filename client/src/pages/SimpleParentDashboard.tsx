import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, ArrowLeft, MessageSquare, Clock, Shield, Users, TrendingUp, Eye, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import FamilyPanel from "./FamilyPanel";

export default function SimpleParentDashboard() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const { data: status, isLoading: statusLoading } = trpc.parent.status.useQuery();
  const unlocked = !!status?.unlocked;

  const refreshAll = () => utils.parent.invalidate();
  const unlock = trpc.parent.unlock.useMutation({
    onSuccess: res => {
      if (res.valid) {
        setPin("");
        setError("");
        refreshAll();
      } else {
        setError("Incorrect PIN. Please try again.");
      }
    },
    onError: e => setError(e.message),
  });
  const setupPin = trpc.parent.setPin.useMutation({
    onSuccess: () => {
      setPin("");
      setError("");
      refreshAll();
    },
    onError: e => setError(e.message),
  });
  const lock = trpc.parent.lock.useMutation({
    onSuccess: async () => {
      await refreshAll();
      setLocation("/");
    },
  });

  const { data: report, refetch } = trpc.parent.getActivityReport.useQuery(undefined, { enabled: unlocked });

  const sessions = report?.sessions ?? [];
  const messages = report?.messages ?? [];
  const flagged = report?.flaggedMessages ?? [];
  const childMessages = messages.filter(m => m.role === "user");
  const totalSessions = report?.totalSessions ?? 0;
  const totalMessages = report?.totalMessages ?? 0;
  const flaggedBySession = new Map<string, number>();
  flagged.forEach(m => flaggedBySession.set(m.sessionId, (flaggedBySession.get(m.sessionId) ?? 0) + 1));

  const submit = () => {
    setError("");
    if (!status?.hasPin) {
      if (pin.length < 4) return setError("Choose a PIN of at least 4 characters.");
      setupPin.mutate({ pin });
    } else {
      if (!pin) return setError("Please enter your PIN");
      unlock.mutate({ pin });
    }
  };

  if (statusLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 via-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Parent Access</CardTitle>
              <CardDescription className="mt-2">
                {status?.hasPin
                  ? "Enter your parent PIN to open the dashboard"
                  : "Create a parent PIN so your child can't open this area"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="pin" className="text-sm font-medium">Parent PIN</label>
              <Input
                id="pin"
                type="password"
                inputMode="text"
                maxLength={64}
                placeholder={status?.hasPin ? "Enter your PIN" : "Create a PIN (4+ characters)"}
                value={pin}
                onChange={e => setPin(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                autoComplete="off"
              />
              {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
            </div>
            <Button
              onClick={submit}
              disabled={unlock.isPending || setupPin.isPending}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {status?.hasPin ? "Unlock Dashboard" : "Set PIN & Continue"}
            </Button>
            <Button variant="outline" onClick={() => setLocation("/")} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-purple-50 to-blue-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Parental Dashboard</h1>
              <p className="text-sm text-gray-600">Review your child's AI conversations</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
            <Button variant="outline" onClick={() => lock.mutate()} className="gap-2">
              <Lock className="w-4 h-4" />
              Lock &amp; Exit
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />Total Messages
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold text-purple-600">{totalMessages}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Users className="w-4 h-4" />Chat Sessions
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold text-blue-600">{totalSessions}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />Avg per Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-pink-600">
                {totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0}
              </div>
            </CardContent>
          </Card>
          <Card className={flagged.length > 0 ? "border-amber-400" : undefined}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />Flagged Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${flagged.length > 0 ? "text-amber-600" : "text-green-600"}`}>
                {flagged.length}
              </div>
              <p className="text-xs text-gray-500 mt-1">Needs your attention</p>
            </CardContent>
          </Card>
        </div>

        {flagged.length > 0 && (
          <Card className="mb-8 border-amber-300 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-5 h-5" />Messages worth a conversation
              </CardTitle>
              <CardDescription>
                These messages matched our safety checks. The assistant did not answer them with AI-generated text.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {flagged.map(m => (
                <div key={m.id} className="p-3 bg-white rounded border border-amber-200">
                  <p className="text-xs text-gray-500 mb-1">
                    {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""} · {m.role === "user" ? "Child" : "AI reply (blocked)"} · {m.flagged}
                  </p>
                  <p className="text-gray-800 whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" />Recent Chat Sessions</CardTitle>
            <CardDescription>Latest conversations with timestamps</CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No activity yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.slice(0, 10).map(session => {
                  const count = messages.filter(m => m.sessionId === session.id).length;
                  const flaggedCount = flaggedBySession.get(session.id) ?? 0;
                  return (
                    <div key={session.id} className="p-4 bg-gray-50 rounded-lg flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-800">{session.childName || "Child"}</span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-sm text-gray-600">{count} messages</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {session.createdAt ? new Date(session.createdAt).toLocaleString() : "Unknown time"}
                        </p>
                      </div>
                      {flaggedCount > 0 ? (
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">
                          {flaggedCount} flagged
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                          No flags
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Eye className="w-5 h-5" />Complete Message History</CardTitle>
            <CardDescription>All conversations between your child and the AI</CardDescription>
          </CardHeader>
          <CardContent>
            {childMessages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No messages yet</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {messages.map(message => {
                  const isUser = message.role === "user";
                  return (
                    <div
                      key={message.id}
                      className={`p-4 rounded-lg ${
                        isUser
                          ? "bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500"
                          : "bg-blue-50 border-l-4 border-blue-500"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-sm">{isUser ? "👶 Child" : "🤖 AI Assistant"}</span>
                        <span className="text-xs text-gray-500">
                          {message.createdAt ? new Date(message.createdAt).toLocaleString() : "Unknown time"}
                        </span>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap">{message.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <h2 className="text-xl font-bold text-gray-800 mt-10 mb-4">Family and privacy</h2>
        <FamilyPanel />

        <p className="text-xs text-gray-500 mt-6">
          Safety checks use automated keyword screening plus age-appropriate instructions to the AI. They reduce risk but
          cannot catch everything, so we recommend reviewing conversations. Time limits are not enforced yet.
        </p>
      </div>
    </div>
  );
}
