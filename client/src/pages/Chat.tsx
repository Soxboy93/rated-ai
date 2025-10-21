import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Sparkles, Menu } from "lucide-react";
import { useLocation } from "wouter";

export default function Chat() {
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createSession = trpc.chat.createSession.useMutation();
  const sendMessage = trpc.chat.sendMessage.useMutation();
  const { data: messages, refetch } = trpc.chat.getMessages.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId }
  );

  useEffect(() => {
    // Create a new chat session on mount
    createSession.mutate({ childName: "Friend" }, {
      onSuccess: (data) => {
        setSessionId(data.sessionId);
      },
    });
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !sessionId || isLoading) return;

    const userMessage = message;
    setMessage("");
    setIsLoading(true);

    try {
      await sendMessage.mutateAsync({
        sessionId,
        message: userMessage,
      });
      await refetch();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Rated AI
            </h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/parent")}
            className="rounded-full"
          >
            <Menu className="w-6 h-6" />
          </Button>
        </div>
      </header>

      {/* Chat Container */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card className="bg-white/90 backdrop-blur-sm shadow-xl rounded-3xl overflow-hidden border-2 border-purple-200">
          {/* Messages Area */}
          <div className="h-[calc(100vh-280px)] overflow-y-auto p-6 space-y-4">
            {!messages || messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center animate-bounce">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-purple-700 mb-2">
                    Hi there! 👋
                  </h2>
                  <p className="text-gray-600 text-lg">
                    I'm your friendly AI assistant! Ask me anything!
                  </p>
                </div>
              </div>
            ) : (
              messages
                .filter((msg) => msg.role !== "system")
                .map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-3xl px-6 py-4 ${
                        msg.role === "user"
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                          : "bg-gradient-to-r from-blue-100 to-purple-100 text-gray-800"
                      }`}
                    >
                      <p className="text-base leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-3xl px-6 py-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce delay-100"></div>
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t-2 border-purple-200 bg-white/50 p-4">
            <div className="flex gap-3">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message here..."
                disabled={isLoading}
                className="flex-1 rounded-full border-2 border-purple-300 focus:border-purple-500 px-6 py-6 text-base"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !message.trim()}
                size="lg"
                className="rounded-full w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

