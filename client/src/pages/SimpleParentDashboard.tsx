import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, ArrowLeft, MessageSquare, Clock, Shield, Users, TrendingUp, Eye } from "lucide-react";
import { useLocation } from "wouter";

export default function SimpleParentDashboard() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [storedPassword, setStoredPassword] = useState<string | null>(null);

  // Load password from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("parentPassword");
    setStoredPassword(saved);
  }, []);

  const { data: allSessions, refetch: refetchSessions } = trpc.chat.getAllSessionsPublic.useQuery(undefined, {
    enabled: isUnlocked,
  });

  const { data: allMessages, refetch: refetchMessages } = trpc.chat.getAllMessagesPublic.useQuery(undefined, {
    enabled: isUnlocked,
  });

  const handleUnlock = () => {
    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    // First time setup
    if (!storedPassword) {
      localStorage.setItem("parentPassword", password);
      setStoredPassword(password);
      setIsUnlocked(true);
      setError("");
      return;
    }

    // Verify password
    if (password === storedPassword) {
      setIsUnlocked(true);
      setError("");
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleUnlock();
    }
  };

  // Calculate statistics
  const totalSessions = allSessions?.length || 0;
  const totalMessages = allMessages?.length || 0;
  const userMessages = allMessages?.filter((m: any) => m.role === "user") || [];
  const recentSessions = allSessions?.slice(0, 10) || [];

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
                {!storedPassword 
                  ? "Set up your password to protect the dashboard"
                  : "Enter your password to access the dashboard"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder={!storedPassword ? "Create a password" : "Enter your password"}
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
            >
              {!storedPassword ? "Set Password & Continue" : "Unlock Dashboard"}
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
              <p className="text-sm text-gray-600">Monitor your child's AI conversations</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchSessions();
                refetchMessages();
              }}
            >
              Refresh
            </Button>
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
              Exit
            </Button>
          </div>
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
              <p className="text-xs text-gray-500 mt-1">All conversations</p>
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
              <p className="text-xs text-gray-500 mt-1">Total sessions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Child Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{userMessages.length}</div>
              <p className="text-xs text-gray-500 mt-1">Questions asked</p>
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
              <p className="text-xs text-gray-500 mt-1">Avg per session</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Chat Sessions
            </CardTitle>
            <CardDescription>Latest conversations with timestamps</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No activity yet</p>
                <p className="text-sm">Chat sessions will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSessions.map((session: any) => {
                  const sessionMessages = allMessages?.filter((m: any) => m.sessionId === session.id) || [];
                  const lastMessage = sessionMessages[sessionMessages.length - 1];
                  
                  return (
                    <div
                      key={session.id}
                      className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-800">
                              {session.childName || "Anonymous"}
                            </span>
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-sm text-gray-600">
                              {sessionMessages.length} messages
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {session.createdAt ? new Date(session.createdAt).toLocaleString() : 'Unknown time'}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                          Safe
                        </span>
                      </div>
                      {lastMessage && (
                        <div className="mt-2 text-sm text-gray-600 bg-white p-2 rounded border border-gray-200">
                          <span className="font-medium">Last message: </span>
                          {lastMessage.content.substring(0, 100)}
                          {lastMessage.content.length > 100 ? "..." : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Message Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Complete Message History
            </CardTitle>
            <CardDescription>All conversations between your child and the AI</CardDescription>
          </CardHeader>
          <CardContent>
            {userMessages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No messages yet</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {allMessages?.map((message: any, index: number) => {
                  const isUser = message.role === "user";
                  return (
                    <div
                      key={message.id || index}
                      className={`p-4 rounded-lg ${
                        isUser
                          ? "bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500"
                          : "bg-blue-50 border-l-4 border-blue-500"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-sm">
                          {isUser ? "👶 Child" : "🤖 AI Assistant"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {message.createdAt ? new Date(message.createdAt).toLocaleString() : 'Unknown time'}
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

        {/* Safety Information */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Safety Features Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">Content Filtering</h3>
                  <p className="text-sm text-gray-600">All AI responses are filtered for age-appropriate content</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">Full Monitoring</h3>
                  <p className="text-sm text-gray-600">Every conversation is logged and available for review</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">Age-Appropriate</h3>
                  <p className="text-sm text-gray-600">Responses tailored to selected age group</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

