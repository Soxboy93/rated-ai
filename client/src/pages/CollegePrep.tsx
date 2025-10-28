import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Target, TrendingUp, BookOpen, Award } from "lucide-react";
import { useLocation } from "wouter";

export default function CollegePrep() {
  const [, setLocation] = useLocation();
  const [selectedTest, setSelectedTest] = useState<"SAT" | "ACT" | null>(null);

  const { data: progress } = trpc.collegePrep.getProgress.useQuery();
  const startPractice = trpc.collegePrep.startPractice.useMutation();

  const tests = [
    { id: "SAT", name: "SAT Prep", icon: "📚", description: "Prepare for the SAT exam", maxScore: 1600 },
    { id: "ACT", name: "ACT Prep", icon: "📖", description: "Prepare for the ACT exam", maxScore: 36 },
  ];

  const subjects = {
    SAT: ["Math", "Reading", "Writing"],
    ACT: ["Math", "Reading", "Writing", "Science"],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
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
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              College Prep Tracker
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-gray-600">Smart Students (13-17)</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <Card className="p-8 mb-8 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-center">
          <div className="text-6xl mb-4">🎓</div>
          <h2 className="text-3xl font-bold mb-3">Your Path to College Success</h2>
          <p className="text-lg opacity-90 mb-6">
            Personalized SAT & ACT prep with AI-powered practice and progress tracking
          </p>
          <div className="flex justify-center gap-4">
            <div className="bg-white/20 rounded-lg px-6 py-3">
              <div className="text-3xl font-bold">0</div>
              <div className="text-sm">Practice Tests</div>
            </div>
            <div className="bg-white/20 rounded-lg px-6 py-3">
              <div className="text-3xl font-bold">0</div>
              <div className="text-sm">Questions Solved</div>
            </div>
            <div className="bg-white/20 rounded-lg px-6 py-3">
              <div className="text-3xl font-bold">0%</div>
              <div className="text-sm">Accuracy</div>
            </div>
          </div>
        </Card>

        {/* Test Selection */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Choose Your Test</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tests.map((test) => (
              <Card
                key={test.id}
                className={`p-8 cursor-pointer hover:shadow-lg transition-all ${
                  selectedTest === test.id ? "ring-2 ring-indigo-500" : ""
                }`}
                onClick={() => setSelectedTest(test.id as "SAT" | "ACT")}
              >
                <div className="text-6xl mb-4 text-center">{test.icon}</div>
                <h3 className="text-2xl font-bold text-center mb-2">{test.name}</h3>
                <p className="text-gray-600 text-center mb-4">{test.description}</p>
                <div className="text-center text-sm text-gray-500 mb-4">
                  Max Score: {test.maxScore}
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    startPractice.mutate({ testType: test.id });
                  }}
                >
                  Start Practice
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Subject Breakdown */}
        {selectedTest && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">{selectedTest} Subjects</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {subjects[selectedTest].map((subject) => (
                <Card key={subject} className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <BookOpen className="w-6 h-6 text-indigo-600" />
                    <h3 className="font-bold text-lg">{subject}</h3>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Current Score</span>
                      <span className="font-bold">--</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Target Score</span>
                      <span className="font-bold">--</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Questions Done</span>
                      <span className="font-bold">0</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full">
                    Practice {subject}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Progress Tracking */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Your Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-8 h-8 text-indigo-600" />
                <h3 className="font-bold text-lg">Score Goals</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Set your target scores and track your progress toward your college goals
              </p>
              <Button variant="outline" className="w-full">Set Goals</Button>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-8 h-8 text-green-600" />
                <h3 className="font-bold text-lg">Improvement Areas</h3>
              </div>
              <p className="text-gray-600 mb-4">
                AI identifies your weak areas and creates personalized practice plans
              </p>
              <Button variant="outline" className="w-full">View Analysis</Button>
            </Card>
          </div>
        </div>

        {/* Features */}
        <div>
          <h2 className="text-2xl font-bold mb-6 text-center">What You Get</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 text-center">
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="font-bold mb-2">Personalized Practice</h3>
              <p className="text-sm text-gray-600">
                AI adapts to your skill level and focuses on areas you need most
              </p>
            </Card>
            <Card className="p-6 text-center">
              <div className="text-4xl mb-3">📊</div>
              <h3 className="font-bold mb-2">Detailed Analytics</h3>
              <p className="text-sm text-gray-600">
                Track your progress with comprehensive performance metrics
              </p>
            </Card>
            <Card className="p-6 text-center">
              <div className="text-4xl mb-3">💡</div>
              <h3 className="font-bold mb-2">Step-by-Step Solutions</h3>
              <p className="text-sm text-gray-600">
                Learn from mistakes with detailed explanations for every question
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

