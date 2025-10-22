import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Star, Award, Target, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

const ACHIEVEMENT_CATEGORIES = [
  {
    id: "learning",
    name: "Learning Master",
    icon: "🎓",
    color: "from-blue-500 to-blue-600",
    achievements: [
      { id: 1, title: "First Question", description: "Asked your first question", unlocked: true },
      { id: 2, title: "Curious Mind", description: "Asked 10 questions", unlocked: true },
      { id: 3, title: "Knowledge Seeker", description: "Asked 50 questions", unlocked: false },
      { id: 4, title: "Wisdom Collector", description: "Asked 100 questions", unlocked: false },
    ]
  },
  {
    id: "creative",
    name: "Creative Genius",
    icon: "🎨",
    color: "from-pink-500 to-pink-600",
    achievements: [
      { id: 5, title: "First Story", description: "Created your first story", unlocked: false },
      { id: 6, title: "Story Teller", description: "Created 5 stories", unlocked: false },
      { id: 7, title: "Master Author", description: "Created 20 stories", unlocked: false },
    ]
  },
  {
    id: "social",
    name: "Friendly Explorer",
    icon: "💫",
    color: "from-green-500 to-green-600",
    achievements: [
      { id: 8, title: "First Friend", description: "Met your first AI character", unlocked: true },
      { id: 9, title: "Social Butterfly", description: "Chatted with all characters", unlocked: false },
      { id: 10, title: "Conversation Master", description: "Had 100 conversations", unlocked: false },
    ]
  },
  {
    id: "streak",
    name: "Consistency Champion",
    icon: "🔥",
    color: "from-orange-500 to-orange-600",
    achievements: [
      { id: 11, title: "Daily Learner", description: "Used the app for 3 days in a row", unlocked: false },
      { id: 12, title: "Week Warrior", description: "Used the app for 7 days in a row", unlocked: false },
      { id: 13, title: "Month Master", description: "Used the app for 30 days in a row", unlocked: false },
    ]
  },
];

export default function Achievements() {
  const [, setLocation] = useLocation();

  const totalAchievements = ACHIEVEMENT_CATEGORIES.reduce((sum, cat) => sum + cat.achievements.length, 0);
  const unlockedCount = ACHIEVEMENT_CATEGORIES.reduce(
    (sum, cat) => sum + cat.achievements.filter(a => a.unlocked).length,
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100">
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-600" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
              Achievements
            </h1>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Progress Overview */}
        <Card className="mb-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none">
          <CardContent className="pt-6">
            <div className="text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2">
                {unlockedCount} / {totalAchievements}
              </h2>
              <p className="text-lg opacity-90">Achievements Unlocked</p>
              <div className="mt-4 bg-white/20 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-white h-full transition-all duration-500"
                  style={{ width: `${(unlockedCount / totalAchievements) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Achievement Categories */}
        <div className="space-y-6">
          {ACHIEVEMENT_CATEGORIES.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${category.color} flex items-center justify-center text-2xl`}>
                    {category.icon}
                  </div>
                  <span>{category.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {category.achievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        achievement.unlocked
                          ? "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-400 shadow-md"
                          : "bg-gray-50 border-gray-200 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          achievement.unlocked ? "bg-yellow-400" : "bg-gray-300"
                        }`}>
                          {achievement.unlocked ? (
                            <Star className="w-6 h-6 text-white" fill="white" />
                          ) : (
                            <Award className="w-6 h-6 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800 mb-1">{achievement.title}</h3>
                          <p className="text-sm text-gray-600">{achievement.description}</p>
                          {achievement.unlocked && (
                            <p className="text-xs text-yellow-600 font-medium mt-2">✓ Unlocked!</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

