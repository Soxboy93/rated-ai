import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Upload, Camera, BookOpen, Loader2, CheckCircle, X } from "lucide-react";
import { useLocation } from "wouter";

export default function HomeworkHelper() {
  const [, setLocation] = useLocation();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [subject, setSubject] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [solution, setSolution] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitHomework = trpc.homework.analyzeHomework.useMutation({
    onSuccess: (data) => {
      setSolution(data);
      setAnalyzing(false);
    },
    onError: (error) => {
      console.error("Error analyzing homework:", error);
      setAnalyzing(false);
      alert("Failed to analyze homework. Please try again.");
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage || !imageFile) return;

    setAnalyzing(true);
    
    // Convert image to base64
    const base64Image = selectedImage.split(',')[1];
    
    submitHomework.mutate({
      imageData: base64Image,
      subject: subject || "general",
    });
  };

  const handleReset = () => {
    setSelectedImage(null);
    setImageFile(null);
    setSubject("");
    setSolution(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            onClick={() => setLocation("/")}
            className="gap-2"
          >
            ← Back
          </Button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-purple-600" />
            Homework Helper
          </h1>
          <div className="w-20" /> {/* Spacer */}
        </div>

        <p className="text-center text-gray-600 mb-8">
          📸 Take a photo of your homework and I'll help you solve it step-by-step!
        </p>

        {/* Upload Section */}
        {!selectedImage && (
          <Card className="p-8 mb-6">
            <div className="flex flex-col items-center gap-6">
              <div className="w-full max-w-md">
                <label className="block text-sm font-medium mb-2">
                  Subject (optional)
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Auto-detect</option>
                  <option value="math">Math</option>
                  <option value="science">Science</option>
                  <option value="english">English</option>
                  <option value="history">History</option>
                  <option value="geography">Geography</option>
                </select>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
              />

              <div className="flex gap-4">
                <Button
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Camera className="w-5 h-5" />
                  Take Photo
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Upload Image
                </Button>
              </div>

              <p className="text-sm text-gray-500 text-center max-w-md">
                Make sure the homework problem is clearly visible in the photo.
                Works best with math problems, science questions, and reading passages.
              </p>
            </div>
          </Card>
        )}

        {/* Image Preview & Analysis */}
        {selectedImage && !solution && (
          <Card className="p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Your Homework</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Clear
              </Button>
            </div>

            <div className="mb-6">
              <img
                src={selectedImage}
                alt="Homework"
                className="w-full max-h-96 object-contain rounded-lg border-2 border-purple-200"
              />
            </div>

            {!analyzing && (
              <Button
                size="lg"
                onClick={handleAnalyze}
                className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <BookOpen className="w-5 h-5" />
                Analyze & Solve
              </Button>
            )}

            {analyzing && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
                <p className="text-lg font-medium">Analyzing your homework...</p>
                <p className="text-sm text-gray-500">This may take a few seconds</p>
              </div>
            )}
          </Card>
        )}

        {/* Solution Display */}
        {solution && (
          <div className="space-y-6">
            <Card className="p-6 bg-green-50 border-green-200">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <h3 className="text-xl font-bold text-green-900">Solution Ready!</h3>
                  <p className="text-sm text-green-700">Here's how to solve this problem</p>
                </div>
              </div>
            </Card>

            {/* Problem Statement */}
            {solution.question && (
              <Card className="p-6">
                <h4 className="font-bold text-lg mb-3 text-purple-900">📝 Problem:</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{solution.question}</p>
              </Card>
            )}

            {/* Step-by-Step Solution */}
            {solution.steps && solution.steps.length > 0 && (
              <Card className="p-6">
                <h4 className="font-bold text-lg mb-4 text-purple-900">
                  🎯 Step-by-Step Solution:
                </h4>
                <div className="space-y-4">
                  {solution.steps.map((step: any, index: number) => (
                    <div
                      key={index}
                      className="flex gap-4 p-4 bg-purple-50 rounded-lg border border-purple-200"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-800 whitespace-pre-wrap">{step}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Final Answer */}
            {solution.answer && (
              <Card className="p-6 bg-gradient-to-r from-purple-100 to-pink-100 border-purple-300">
                <h4 className="font-bold text-lg mb-3 text-purple-900">✨ Final Answer:</h4>
                <p className="text-xl font-bold text-purple-900">{solution.answer}</p>
              </Card>
            )}

            {/* Explanation */}
            {solution.explanation && (
              <Card className="p-6">
                <h4 className="font-bold text-lg mb-3 text-purple-900">💡 Explanation:</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{solution.explanation}</p>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                size="lg"
                onClick={handleReset}
                className="flex-1 gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Camera className="w-5 h-5" />
                Solve Another Problem
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setLocation("/")}
                className="flex-1"
              >
                Back to Home
              </Button>
            </div>
          </div>
        )}

        {/* Tips Section */}
        {!selectedImage && (
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="font-bold text-lg mb-3 text-blue-900">📚 Tips for Best Results:</h3>
            <ul className="space-y-2 text-blue-800">
              <li>• Make sure the problem is clearly visible and in focus</li>
              <li>• Include the full question, not just part of it</li>
              <li>• Good lighting helps the AI read your homework better</li>
              <li>• Works great for math, science, reading comprehension, and more!</li>
              <li>• If you get stuck, you can always ask your AI character for more help</li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

