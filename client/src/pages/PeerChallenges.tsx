import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trophy, Zap, Users, Target } from "lucide-react";
import { useLocation } from "wouter";

export default function PeerChallenges() {
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const { data: challenges } = trpc.challenges.getMyChallenges.useQuery();
  const createChallenge = trpc.challenges.create.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
  });

  const challengeTypes = [
    { id: "math_race", name: "Math Race", icon: "🔢", description: "Solve math problems faster than your friend!" },
    { id: "trivia", name: "Trivia Quiz", icon: "🧠", description: "Test your knowledge across all subjects!" },
    { id: "spelling", name: "Spelling Bee", icon: "✏️", description: "Who can spell the hardest words?" },
    { id: "science", name: "Science Challenge", icon: "🔬", description: "Answer science questions correctly!" },
  ];

  const handleCreateChallenge = async (type: string) => {
    await createChallenge.mutateAsync({
      challengeType: type,
      subject: type === "math_race" ? "Math" : type === "science" ? "Science" : "General",
      difficulty: "medium",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              Peer Challenges
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-gray-600">
              {challenges?.length || 0} Challenges
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <Card className="p-8 mb-8 bg-gradient-to-r from-orange-500 to-red-500 text-white text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-3xl font-bold mb-3">Challenge Your Friends!</h2>
          <p className="text-lg opacity-90 mb-4">
            Compete in fun learning challenges and see who's the smartest!
          </p>
          <div className="flex justify-center gap-4">
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm">Wins</div>
            </div>
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm">Active</div>
            </div>
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm">Points</div>
            </div>
          </div>
        </Card>

        {/* Challenge Types */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Create New Challenge</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {challengeTypes.map((type) => (
              <Card
                key={type.id}
                className={`p-6 cursor-pointer hover:shadow-lg transition-all ${
                  selectedType === type.id ? "ring-2 ring-orange-500" : ""
                }`}
                onClick={() => setSelectedType(type.id)}
              >
                <div className="text-4xl mb-3 text-center">{type.icon}</div>
                <h3 className="font-bold text-center mb-2">{type.name}</h3>
                <p className="text-sm text-gray-600 text-center mb-4">
                  {type.description}
                </p>
                <Button
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateChallenge(type.id);
                  }}
                  disabled={createChallenge.isPending}
                >
                  {createChallenge.isPending ? "Creating..." : "Start Challenge"}
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* My Challenges */}
        <div>
          <h2 className="text-2xl font-bold mb-4">My Challenges</h2>
          
          {challenges && challenges.length > 0 ? (
            <div className="space-y-4">
              {challenges.map((challenge: any) => (
                <Card key={challenge.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white text-2xl">
                        🎯
                      </div>
                      <div>
                        <h3 className="font-bold text-lg capitalize">
                          {challenge.challengeType.replace("_", " ")}
                        </h3>
                        <div className="flex gap-4 text-sm text-gray-600">
                          <span>📚 {challenge.subject}</span>
                          <span>⚡ {challenge.difficulty}</span>
                          <span className={`font-bold ${
                            challenge.status === "pending" ? "text-yellow-600" :
                            challenge.status === "active" ? "text-green-600" :
                            "text-gray-600"
                          }`}>
                            {challenge.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-orange-600">
                        {challenge.creatorScore} : {challenge.challengerScore}
                      </div>
                      <div className="text-sm text-gray-600">Score</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">🎮</div>
              <h3 className="text-xl font-bold mb-2">No Challenges Yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first challenge and invite a friend to compete!
              </p>
            </Card>
          )}
        </div>

        {/* How It Works */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="font-bold mb-2">1. Choose Challenge</h3>
              <p className="text-sm text-gray-600">
                Pick from Math, Science, Trivia, or Spelling challenges
              </p>
            </Card>
            <Card className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="font-bold mb-2">2. Invite Friend</h3>
              <p className="text-sm text-gray-600">
                Share your challenge code with a friend to compete
              </p>
            </Card>
            <Card className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="font-bold mb-2">3. Win Rewards</h3>
              <p className="text-sm text-gray-600">
                Earn points, badges, and level up your learning pet!
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

