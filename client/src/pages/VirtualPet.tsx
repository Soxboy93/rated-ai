import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Heart, Sparkles, Star, TrendingUp, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

const PET_TYPES = [
  { id: "dragon", name: "Dragon", emoji: "🐉", description: "Fierce and loyal" },
  { id: "unicorn", name: "Unicorn", emoji: "🦄", description: "Magical and wise" },
  { id: "robot", name: "Robot", emoji: "🤖", description: "Smart and helpful" },
  { id: "cat", name: "Cat", emoji: "🐱", description: "Curious and playful" },
  { id: "owl", name: "Owl", emoji: "🦉", description: "Wise and observant" },
  { id: "fox", name: "Fox", emoji: "🦊", description: "Clever and quick" },
];

const EVOLUTION_STAGES = {
  baby: { name: "Baby", emoji: "🥚" },
  child: { name: "Child", emoji: "🐣" },
  teen: { name: "Teen", emoji: "🐥" },
  adult: { name: "Adult", emoji: "✨" },
};

export default function VirtualPet() {
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [petName, setPetName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);

  const { data: pet, refetch: refetchPet } = trpc.pet.getMyPet.useQuery();
  const createPet = trpc.pet.createPet.useMutation({
    onSuccess: () => {
      refetchPet();
      setShowNameInput(false);
    },
  });
  const feedPet = trpc.pet.feedPet.useMutation({
    onSuccess: () => refetchPet(),
  });
  const playWithPet = trpc.pet.playWithPet.useMutation({
    onSuccess: () => refetchPet(),
  });

  const handleCreatePet = () => {
    if (!selectedType || !petName.trim()) return;
    createPet.mutate({
      type: selectedType,
      name: petName.trim(),
    });
  };

  const getHappinessColor = (happiness: number) => {
    if (happiness >= 80) return "text-green-600";
    if (happiness >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getHungerColor = (hunger: number) => {
    if (hunger <= 30) return "text-green-600";
    if (hunger <= 60) return "text-yellow-600";
    return "text-red-600";
  };

  // Pet Selection Screen
  if (!pet && !showNameInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Choose Your Pet
            </h1>
            <div className="w-20" />
          </div>

          <p className="text-center text-gray-600 mb-8">
            🐾 Pick a learning companion that will grow with you!
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {PET_TYPES.map((type) => (
              <Card
                key={type.id}
                className={`p-6 cursor-pointer transition-all hover:scale-105 ${
                  selectedType === type.id
                    ? "ring-4 ring-purple-500 bg-purple-50"
                    : "hover:shadow-lg"
                }`}
                onClick={() => setSelectedType(type.id)}
              >
                <div className="text-center">
                  <div className="text-6xl mb-3">{type.emoji}</div>
                  <h3 className="font-bold text-lg mb-1">{type.name}</h3>
                  <p className="text-sm text-gray-600">{type.description}</p>
                  {selectedType === type.id && (
                    <div className="mt-3 text-purple-600 font-semibold">
                      ✓ Selected
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {selectedType && (
            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={() => setShowNameInput(true)}
                className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Sparkles className="w-5 h-5" />
                Continue
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Name Input Screen
  if (!pet && showNameInput && selectedType) {
    const petType = PET_TYPES.find((t) => t.id === selectedType);
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4 flex items-center justify-center">
        <Card className="max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="text-8xl mb-4">{petType?.emoji}</div>
            <h2 className="text-2xl font-bold mb-2">Name Your {petType?.name}</h2>
            <p className="text-gray-600">Choose a special name for your companion</p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              placeholder="Enter pet name..."
              className="w-full p-3 border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              maxLength={20}
            />

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowNameInput(false)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleCreatePet}
                disabled={!petName.trim() || createPet.isPending}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {createPet.isPending ? "Creating..." : "Create Pet"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Pet Dashboard
  if (pet) {
    const petType = PET_TYPES.find((t) => t.id === pet.type);
    const evolution = EVOLUTION_STAGES[pet.evolution as keyof typeof EVOLUTION_STAGES] || EVOLUTION_STAGES.baby;
    const nextLevelXP = (pet.level || 1) * 100;
    const xpProgress = ((pet.experience || 0) / nextLevelXP) * 100;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-gray-800">{pet.name}</h1>
            <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full">
              <Star className="w-4 h-4 text-yellow-600" />
              <span className="font-bold text-yellow-900">Level {pet.level}</span>
            </div>
          </div>

          {/* Pet Display */}
          <Card className="p-8 mb-6 bg-gradient-to-br from-purple-100 to-pink-100">
            <div className="text-center">
              <div className="relative inline-block">
                <div className="text-9xl mb-4">{petType?.emoji}</div>
                <div className="absolute -top-2 -right-2 text-4xl">{evolution.emoji}</div>
              </div>
              <h2 className="text-3xl font-bold mb-2">{pet.name}</h2>
              <p className="text-lg text-purple-700 mb-4">
                {evolution.name} {petType?.name}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-white/70 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className={`w-5 h-5 ${getHappinessColor(pet.happiness || 100)}`} />
                  <span className="font-semibold">Happiness</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-pink-500 to-red-500 h-3 rounded-full transition-all"
                    style={{ width: `${pet.happiness}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">{pet.happiness}%</p>
              </div>

              <div className="bg-white/70 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className={`w-5 h-5 ${getHungerColor(pet.hunger || 0)}`} />
                  <span className="font-semibold">Hunger</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full transition-all"
                    style={{ width: `${pet.hunger}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">{pet.hunger}%</p>
              </div>
            </div>

            {/* XP Progress */}
            <div className="mt-6 bg-white/70 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold">Experience</span>
                </div>
                <span className="text-sm text-gray-600">
                  {pet.experience} / {nextLevelXP} XP
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(xpProgress, 100)}%` }}
                />
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Button
              size="lg"
              onClick={() => feedPet.mutate()}
              disabled={feedPet.isPending || (pet.hunger || 0) < 30}
              className="gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              🍎 Feed Pet
            </Button>
            <Button
              size="lg"
              onClick={() => playWithPet.mutate()}
              disabled={playWithPet.isPending}
              className="gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              🎮 Play Together
            </Button>
          </div>

          {/* Tips */}
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="font-bold text-lg mb-3 text-blue-900">💡 Pet Care Tips:</h3>
            <ul className="space-y-2 text-blue-800">
              <li>• Complete homework and lessons to earn XP for your pet</li>
              <li>• Feed your pet when hunger is above 30%</li>
              <li>• Play with your pet to increase happiness</li>
              <li>• Your pet evolves as it levels up!</li>
              <li>• Happy pets learn faster and earn bonus XP</li>
            </ul>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}

