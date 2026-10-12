import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Star, Target } from "lucide-react";
import { useLocation } from "wouter";

export default function WeeklySummary() {
  const [, setLocation] = useLocation();

  const { data: latestSummary } = trpc.summaries.getLatest.useQuery();
  const generateSummary = trpc.summaries.generate.useMutation();
  const utils = trpc.useUtils();
  const handleGenerate = async () => {
    await generateSummary.mutateAsync();
    await utils.summaries.getLatest.invalidate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
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
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Weekly Learning Summary
            </h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-4 mb-6 bg-purple-50 border-purple-200">
          <p className="text-sm text-purple-900">
            📧 Emailed weekly summaries are not available yet. Generate this week's summary below to read it here.
          </p>
        </Card>

        {/* Generate Button */}
        <div className="text-center mb-8">
          <Button
            onClick={handleGenerate}
            disabled={generateSummary.isPending}
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-pink-600"
          >
            {generateSummary.isPending ? "Generating..." : "Generate This Week's Summary"}
          </Button>
        </div>

        {generateSummary.error && (
          <p className="text-center text-red-600 mb-6" role="alert">{generateSummary.error.message}</p>
        )}

        {/* Latest Summary */}
        {latestSummary && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">This Week's Progress</h2>
                <div className="text-sm text-gray-500">
                  {new Date(latestSummary.weekStart).toLocaleDateString()} -{" "}
                  {new Date(latestSummary.weekEnd).toLocaleDateString()}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-3xl font-bold text-purple-600">
                    {latestSummary.totalMessages}
                  </div>
                  <div className="text-sm text-gray-600">Messages Sent</div>
                </div>
                <div className="bg-pink-50 rounded-lg p-4">
                  <div className="text-3xl font-bold text-pink-600">
                    {latestSummary.totalSessions}
                  </div>
                  <div className="text-sm text-gray-600">Learning Sessions</div>
                </div>
              </div>

              {/* Topics Covered */}
              {latestSummary.topicsCovered && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-lg">Topics Covered</h3>
                  </div>
                  <p className="text-gray-700 leading-relaxed">
                    {latestSummary.topicsCovered}
                  </p>
                </div>
              )}

              {/* Strengths */}
              {latestSummary.strengths && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-5 h-5 text-yellow-600" />
                    <h3 className="font-bold text-lg">Strengths</h3>
                  </div>
                  <p className="text-gray-700 leading-relaxed">
                    {latestSummary.strengths}
                  </p>
                </div>
              )}

              {/* Areas to Improve */}
              {latestSummary.areasToImprove && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-5 h-5 text-orange-600" />
                    <h3 className="font-bold text-lg">Areas to Focus On</h3>
                  </div>
                  <p className="text-gray-700 leading-relaxed">
                    {latestSummary.areasToImprove}
                  </p>
                </div>
              )}

              {/* Recommendations */}
              {latestSummary.recommendations && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-5 h-5 text-green-600" />
                    <h3 className="font-bold text-lg">Recommendations for Next Week</h3>
                  </div>
                  <p className="text-gray-700 leading-relaxed">
                    {latestSummary.recommendations}
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}

        {!latestSummary && !generateSummary.isPending && (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold mb-2">No Summary Yet</h3>
            <p className="text-gray-600 mb-4">
              Generate your first weekly summary to see your learning progress!
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

