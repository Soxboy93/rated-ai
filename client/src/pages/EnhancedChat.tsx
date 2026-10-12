import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Sparkles, Menu, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { AI_CHARACTERS, AGE_GROUPS } from "@shared/characters";
import { useAuth } from "@/_core/hooks/useAuth";

type AgeGroupId = "kids" | "tweens" | "teens";

export default function EnhancedChat() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"age" | "character" | "chat">("age");
  const [selectedAge, setSelectedAge] = useState<AgeGroupId | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const { data: profiles, isLoading: profilesLoading } = trpc.profiles.list.useQuery();
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createSession = trpc.chat.createSession.useMutation();
  const sendMessage = trpc.chat.sendMessage.useMutation();
  const [sendError, setSendError] = useState("");
  const { logout } = useAuth();
  const { data: messages, refetch } = trpc.chat.getMessages.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId }
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleProfileSelect = (profile: { id: string; ageGroup: AgeGroupId; selectedCharacter: string | null }) => {
    setSelectedProfileId(profile.id);
    setSelectedAge(profile.ageGroup);
    setSelectedCharacter(profile.selectedCharacter);
    setStep("character");
  };

  const handleCharacterSelect = (characterId: string) => {
    setSelectedCharacter(characterId);
  };

  const startChat = () => {
    if (!selectedCharacter || !selectedProfileId) return;

    createSession.mutate({
      profileId: selectedProfileId,
      characterId: selectedCharacter as "sage" | "phoenix" | "nova" | "echo",
    }, {
      onSuccess: (data) => {
        setSessionId(data.sessionId);
        setStep("chat");
      },
    });
  };

  const handleSend = async () => {
    if (!message.trim() || !sessionId || isLoading) return;

    const userMessage = message;
    setMessage("");
    setSendError("");
    setIsLoading(true);

    try {
      await sendMessage.mutateAsync({
        sessionId,
        message: userMessage,
      });
      await refetch();
    } catch (error) {
      console.error("Failed to send message:", error);
      setSendError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
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

  const character = selectedCharacter ? AI_CHARACTERS.find(c => c.id === selectedCharacter) : null;
  const ageGroup = selectedAge ? AGE_GROUPS[selectedAge] : null;

  // Age Selection Screen
  if (step === "age") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100">
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
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                Sign out
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/parent")}
                className="rounded-full"
                aria-label="Parent dashboard"
              >
                <Menu className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Banner */}
        <div className="relative overflow-hidden mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20 z-10"></div>
          <img 
            src="/hero-banner.png" 
            alt="Rated AI - Kids Learning with AI" 
            className="w-full h-64 md:h-96 object-cover"
          />
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="text-center text-white drop-shadow-2xl">
              <h1 className="text-5xl md:text-7xl font-black mb-4 animate-pulse">
                Welcome to Rated AI!
              </h1>
              <p className="text-xl md:text-3xl font-semibold">
                Your AI Learning Adventure Starts Here ✨
              </p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12 max-w-6xl">
          <div className="text-center mb-12">
            <div className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-semibold mb-4">
              ✨ Choose Your Adventure ✨
            </div>
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Who is learning today?</h2>
            <p className="text-xl text-gray-600">Pick your name to start. Your guide will talk the way that suits your age.</p>
          </div>

          {profilesLoading ? (
            <p className="text-center text-gray-500">Loading…</p>
          ) : !profiles || profiles.length === 0 ? (
            <Card className="p-8 max-w-xl mx-auto text-center space-y-4">
              <h3 className="text-2xl font-bold text-gray-800">No child profile yet</h3>
              <p className="text-gray-600">A parent needs to add a child profile before the chat can start.</p>
              <Button onClick={() => setLocation("/parent")} className="bg-gradient-to-r from-purple-500 to-pink-500">
                Open the parent area
              </Button>
            </Card>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {profiles.map((profile) => {
                const age = AGE_GROUPS[profile.ageGroup as AgeGroupId];
                return (
                  <Card
                    key={profile.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleProfileSelect(profile as any)}
                    onKeyDown={(e) => e.key === "Enter" && handleProfileSelect(profile as any)}
                    className="p-8 cursor-pointer hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-4 border-transparent hover:border-purple-400"
                  >
                    <div className="text-center">
                      <div className="text-6xl mb-4">{age.icon}</div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">{profile.childName}</h3>
                      <p className="text-purple-600 font-semibold mb-4">{age.name} · Ages {age.ageRange}</p>
                      <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                        Start Chatting!
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Character Selection Screen
  if (step === "character") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100">
        <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("age")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
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

        <div className="container mx-auto px-4 py-12 max-w-6xl">
          <div className="text-center mb-12">
            <div className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-semibold mb-4">
              🎭 Choose Your AI Companion 🎭
            </div>
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Meet Your AI Friends!</h2>
            <p className="text-xl text-gray-600">
              Each character has a unique personality to help you learn and grow
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {AI_CHARACTERS.map((char) => (
              <Card
                key={char.id}
                onClick={() => handleCharacterSelect(char.id)}
                className={`p-6 cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-300 ${
                  selectedCharacter === char.id
                    ? "border-4 border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-2xl scale-105"
                    : "border-2 border-gray-200 hover:border-purple-300"
                }`}
              >
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-48 h-48 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center shadow-lg">
                    <img 
                      src={`/character-${char.id}.png`} 
                      alt={char.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = `<div class="text-6xl">${char.emoji}</div>`;
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">{char.name}</h3>
                    <p className="text-gray-600 mb-3 text-base">{char.description}</p>
                    <p className="text-sm text-gray-500 italic">{char.personality}</p>
                    {selectedCharacter === char.id && (
                      <div className="mt-4 inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                        ✓ Selected
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {selectedCharacter && (
            <div className="text-center">
              <Card className="inline-block p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300">
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Ready to start your adventure with {character?.name}?
                </h3>
                <p className="text-gray-600 mb-4">
                  {character?.emoji} will be your guide as a {ageGroup?.name}!
                </p>
                <Button
                  onClick={startChat}
                  size="lg"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  Start Learning! 🚀
                </Button>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chat Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100">
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl">{character?.emoji}</div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{character?.name}</h1>
              <p className="text-sm text-gray-600">{ageGroup?.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-full"
            >
              <Menu className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </header>

      {/* Enhanced Menu Overlay */}
      {showMenu && (
        <div className="absolute top-16 right-4 bg-white rounded-lg shadow-2xl border-2 border-purple-200 p-4 z-50 min-w-[250px]">
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => {
                setShowMenu(false);
                setLocation("/homework");
              }}
            >
              <span className="text-2xl">📸</span>
              <span>Homework Helper</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => {
                setShowMenu(false);
                setLocation("/report-card");
              }}
            >
              <span className="text-2xl">📊</span>
              <span>My Report Card</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => {
                setShowMenu(false);
                setLocation("/weekly-summary");
              }}
            >
              <span className="text-2xl">📧</span>
              <span>Weekly Summary</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => {
                setShowMenu(false);
                setLocation("/story-studio");
              }}
            >
              <span className="text-2xl">📚</span>
              <span>Story Studio</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => {
                setShowMenu(false);
                setLocation("/achievements");
              }}
            >
              <span className="text-2xl">🏆</span>
              <span>Achievements</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => {
                setShowMenu(false);
                setLocation("/pet");
              }}
            >
              <span className="text-2xl">🐾</span>
              <span>My Pet</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => {
                setShowMenu(false);
                setLocation("/parent");
              }}
            >
              <span className="text-2xl">👨‍👩‍👧</span>
              <span>Parent Dashboard</span>
            </Button>
            <div className="border-t border-gray-200 my-2" />
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => {
                setShowMenu(false);
                window.location.reload();
              }}
            >
              <span className="text-2xl">🔄</span>
              <span>New Chat</span>
            </Button>
          </div>
        </div>
      )}

      {/* Old menu overlay - remove if exists */}
      {false && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowMenu(false)}>
          <Card className="max-w-md w-full m-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Menu</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowMenu(false)}>
                ✕
              </Button>
            </div>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start text-left"
                onClick={() => {
                  setStep("age");
                  setShowMenu(false);
                }}
              >
                🏠 Start Over
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start text-left"
                onClick={() => {
                  setStep("character");
                  setShowMenu(false);
                }}
              >
                🎭 Change Character
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start text-left"
                onClick={() => {
                  setLocation("/parent");
                  setShowMenu(false);
                }}
              >
                👨‍👩‍👧‍👦 Parent Controls
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card className="bg-white/90 backdrop-blur-sm shadow-xl rounded-3xl overflow-hidden border-2 border-purple-200">
          <div className="h-[calc(100vh-280px)] overflow-y-auto p-6 space-y-4">
            {!messages || messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="text-8xl animate-bounce">{character?.emoji}</div>
                <div>
                  <h2 className="text-2xl font-bold text-purple-700 mb-2">
                    Hi there! 👋
                  </h2>
                  <p className="text-gray-600 text-lg">
                    I'm {character?.name}! {character?.description}
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

          <div className="border-t-2 border-purple-200 bg-white/50 p-4">
            {sendError && (
              <p className="text-sm text-red-600 mb-2 text-center" role="alert">{sendError}</p>
            )}
            <div className="flex gap-3">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message here..."
                maxLength={2000}
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

