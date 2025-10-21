import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Shield, ArrowLeft, Lock, Activity, MessageSquare, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

export default function ParentDashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const verifyPassword = trpc.parent.verifyPassword.useMutation();
  const setupPassword = trpc.parent.setupPassword.useMutation();
  const { data: activityReport, refetch } = trpc.parent.getActivityReport.useQuery(
    undefined,
    { enabled: isVerified && isAuthenticated }
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Parent Dashboard</CardTitle>
            <CardDescription>Please sign in to access parental controls</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => window.location.href = getLoginUrl()}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              Sign In
            </Button>
            <Button
              onClick={() => setLocation("/")}
              variant="ghost"
              className="w-full mt-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleVerifyPassword = async () => {
    setError("");
    try {
      const result = await verifyPassword.mutateAsync({ password });
      if (result.needsSetup) {
        setSetupMode(true);
      } else if (result.valid) {
        setIsVerified(true);
        refetch();
      } else {
        setError("Incorrect password. Please try again.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    }
  };

  const handleSetupPassword = async () => {
    setError("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await setupPassword.mutateAsync({ password: newPassword });
      setSetupMode(false);
      setIsVerified(true);
      refetch();
    } catch (err) {
      setError("Failed to setup password. Please try again.");
    }
  };

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">
              {setupMode ? "Setup Parent Password" : "Parent Access"}
            </CardTitle>
            <CardDescription>
              {setupMode
                ? "Create a password to protect the parent dashboard"
                : "Enter your password to access the dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {setupMode ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    onKeyPress={(e) => e.key === "Enter" && handleSetupPassword()}
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button
                  onClick={handleSetupPassword}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  Setup Password
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    onKeyPress={(e) => e.key === "Enter" && handleVerifyPassword()}
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button
                  onClick={handleVerifyPassword}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  Unlock Dashboard
                </Button>
              </>
            )}
            <Button
              onClick={() => setLocation("/")}
              variant="ghost"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Parent Dashboard</h1>
          </div>
          <Button
            onClick={() => setLocation("/")}
            variant="outline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activityReport?.totalSessions || 0}</div>
              <p className="text-xs text-muted-foreground">Chat sessions created</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activityReport?.totalMessages || 0}</div>
              <p className="text-xs text-muted-foreground">Messages exchanged</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Active</div>
              <p className="text-xs text-muted-foreground">All systems operational</p>
            </CardContent>
          </Card>
        </div>

        {/* Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Complete history of all conversations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activityReport?.messages && activityReport.messages.length > 0 ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {activityReport.messages
                    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
                    .map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-lg ${
                          msg.role === "user"
                            ? "bg-purple-50 border-l-4 border-purple-500"
                            : "bg-blue-50 border-l-4 border-blue-500"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-sm">
                            {msg.role === "user" ? "Child" : "AI Assistant"}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.createdAt!).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No activity yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

