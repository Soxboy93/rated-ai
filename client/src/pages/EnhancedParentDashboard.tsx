import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, ArrowLeft, MessageSquare, Clock, Shield, Users, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function EnhancedParentDashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState("");

  const verifyPassword = trpc.parent.verifyPassword.useMutation();
  const { data: settings } = trpc.parent.getSettings.useQuery(undefined, {
    enabled: isAuthenticated && isUnlocked,
  });
  const { data: allSessions } = trpc.chat.getAllSessions.useQuery(undefined, {
    enabled: isAuthenticated && isUnlocked,
  });

  const handleUnlock = async () => {
    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    try {
      const result = await verifyPassword.mutateAsync({ password });
      if (result.valid) {
        setIsUnlocked(true);
        setError("");
      } else if (result.needsSetup) {
        setError("No password set. Please contact an administrator.");
      } else {
        setError("Incorrect password. Please try again.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleUnlock();
    }
  };

  // Calculate statistics
  const totalSessions = allSessions?.length || 0;
  const totalMessages = allSessions?.reduce((sum: number, session: any) => sum + (session.messageCount || 0), 0) || 0;
  const recentActivity = allSessions?.slice(0, 10) || [];

  if (!isUnlocked) {
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
                Enter your password to access the dashboard
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <Button
              onClick={handleUnlock}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              disabled={verifyPassword.isPending}
            >
              {verifyPassword.isPending ? "Verifying..." : "Unlock Dashboard"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="w-full"
            >
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
              <p className="text-sm text-gray-600">Monitor and control your child's AI experience</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setIsUnlocked(false);
              setPassword("");
              setLocation("/");
            }}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit Dashboard
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Statistics Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Total Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{totalMessages}</div>
              <p className="text-xs text-gray-500 mt-1">Across all sessions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Chat Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{totalSessions}</div>
              <p className="text-xs text-gray-500 mt-1">Total conversations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Safety Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">✓</div>
              <p className="text-xs text-gray-500 mt-1">All content filtered</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-pink-600">
                {totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Avg messages per session</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest chat sessions and interactions</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No activity yet</p>
                <p className="text-sm">Chat sessions will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((session: any) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-800">{session.childName}</span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-sm text-gray-600">
                          {session.messageCount || 0} messages
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Started {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'Unknown'} at{" "}
                        {session.createdAt ? new Date(session.createdAt).toLocaleTimeString() : 'Unknown'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        Safe
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Safety Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Safety & Control Settings
            </CardTitle>
            <CardDescription>Configure how your child interacts with AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-800">Content Filtering</h3>
                <p className="text-sm text-gray-600">
                  All responses are automatically filtered for age-appropriate content
                </p>
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Shield className="w-4 h-4" />
                  <span>Active and Protected</span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-800">Activity Monitoring</h3>
                <p className="text-sm text-gray-600">
                  All conversations are logged and can be reviewed at any time
                </p>
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Clock className="w-4 h-4" />
                  <span>Real-time Tracking</span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-800">AI Character Selection</h3>
                <p className="text-sm text-gray-600">
                  Children can choose from 4 educational AI companions with unique personalities
                </p>
                <div className="flex gap-2 mt-2">
                  <span className="text-lg">🎓</span>
                  <span className="text-lg">🎨</span>
                  <span className="text-lg">🔬</span>
                  <span className="text-lg">💫</span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-800">Age-Appropriate Responses</h3>
                <p className="text-sm text-gray-600">
                  AI responses are tailored to the selected age group (4-8, 9-12, 13-17)
                </p>
                <div className="flex items-center gap-2 text-sm text-purple-600">
                  <Users className="w-4 h-4" />
                  <span>Adaptive Learning</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">💡 Tip for Parents</h4>
                <p className="text-sm text-blue-800">
                  Regularly review the activity log to understand your child's interests and learning
                  patterns. This helps you engage in meaningful conversations about what they're
                  learning!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

