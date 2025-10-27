import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { FileText, Download, Share2, TrendingUp, Award, Target, Lightbulb, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function ReportCard() {
  const [, setLocation] = useLocation();
  const [generating, setGenerating] = useState(false);

  const { data: reportCard, refetch } = trpc.reports.getLatestReport.useQuery();
  const generateReport = trpc.reports.generateReport.useMutation({
    onSuccess: () => {
      refetch();
      setGenerating(false);
    },
  });

  const handleGenerate = () => {
    setGenerating(true);
    generateReport.mutate();
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "text-green-600 bg-green-50";
    if (grade.startsWith("B")) return "text-blue-600 bg-blue-50";
    if (grade.startsWith("C")) return "text-yellow-600 bg-yellow-50";
    return "text-gray-600 bg-gray-50";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4">
      <div className="container max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            AI Report Card
          </h1>
          <div className="w-20" />
        </div>

        {/* Generate Button */}
        {!reportCard && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Generate Your Report Card
              </CardTitle>
              <CardDescription>
                Get an AI-generated report card based on your learning activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {generating ? "Generating..." : "Generate Report Card"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Report Card Display */}
        {reportCard && (
          <div className="space-y-6">
            {/* Header Card */}
            <Card className="border-2 border-purple-200">
              <CardHeader className="bg-gradient-to-r from-purple-100 to-pink-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Progress Report</CardTitle>
                    <CardDescription className="text-gray-700">
                      {reportCard.periodStart && reportCard.periodEnd
                        ? `${new Date(reportCard.periodStart).toLocaleDateString()} - ${new Date(reportCard.periodEnd).toLocaleDateString()}`
                        : "Recent Activity"}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Overall Grade</div>
                    <div className={`text-4xl font-bold px-4 py-2 rounded-lg ${getGradeColor(reportCard.overallGrade || "B+")}`}>
                      {reportCard.overallGrade || "B+"}
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Subject Grades */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Subject Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { subject: "Math", grade: reportCard.mathGrade || "A-" },
                    { subject: "Science", grade: reportCard.scienceGrade || "B+" },
                    { subject: "English", grade: reportCard.englishGrade || "A" },
                    { subject: "History", grade: reportCard.historyGrade || "B" },
                  ].map((item) => (
                    <div key={item.subject} className="text-center p-4 rounded-lg border-2 border-gray-200">
                      <div className="text-sm text-gray-600 mb-2">{item.subject}</div>
                      <div className={`text-3xl font-bold px-3 py-1 rounded-lg inline-block ${getGradeColor(item.grade)}`}>
                        {item.grade}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Strengths */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="w-5 h-5" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">
                  {reportCard.strengths || "Shows excellent curiosity and asks thoughtful questions. Demonstrates strong problem-solving skills and engages actively with learning materials."}
                </p>
              </CardContent>
            </Card>

            {/* Areas for Improvement */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <Target className="w-5 h-5" />
                  Areas for Growth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">
                  {reportCard.weaknesses || "Could benefit from more practice with complex word problems. Consider spending additional time on reading comprehension exercises."}
                </p>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-600">
                  <Lightbulb className="w-5 h-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">
                  {reportCard.recommendations || "Continue exploring science topics through hands-on experiments. Practice math skills daily for 15-20 minutes. Read for pleasure to improve vocabulary and comprehension."}
                </p>
              </CardContent>
            </Card>

            {/* Activity Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Learning Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600">{reportCard.totalMessages || 0}</div>
                    <div className="text-sm text-gray-600">Messages</div>
                  </div>
                  <div className="text-center p-4 bg-pink-50 rounded-lg">
                    <div className="text-3xl font-bold text-pink-600">{reportCard.totalSessions || 0}</div>
                    <div className="text-sm text-gray-600">Sessions</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <FileText className="w-4 h-4 mr-2" />
                Generate New Report
              </Button>
              <Button variant="outline" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button variant="outline" className="flex-1">
                <Share2 className="w-4 h-4 mr-2" />
                Share with Teacher
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

