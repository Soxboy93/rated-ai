import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Sparkles, Image, Loader2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function StoryStudio() {
  const [, setLocation] = useLocation();
  const [storyPrompt, setStoryPrompt] = useState("");
  const [generatedStory, setGeneratedStory] = useState("");
  const [illustrations, setIllustrations] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateStory = trpc.creative.generateStory.useMutation();
  const generateIllustration = trpc.creative.generateIllustration.useMutation();

  const handleGenerateStory = async () => {
    if (!storyPrompt.trim()) {
      toast.error("Please enter a story idea!");
      return;
    }

    setIsGenerating(true);
    setGeneratedStory("");
    setIllustrations([]);

    try {
      // Generate story text
      const story = await generateStory.mutateAsync({ prompt: storyPrompt });
      setGeneratedStory(story.content);
      toast.success("✨ Story created!");

      // Generate illustrations for key scenes
      toast.info("🎨 Creating illustrations...");
      const illustrationPrompts = [
        `Children's book illustration: ${storyPrompt}, opening scene, colorful, friendly`,
        `Children's book illustration: ${storyPrompt}, middle scene, vibrant, whimsical`,
        `Children's book illustration: ${storyPrompt}, happy ending, bright colors, magical`,
      ];

      const images: string[] = [];
      for (const prompt of illustrationPrompts) {
        try {
          const result = await generateIllustration.mutateAsync({ prompt });
          if (result.imageUrl) {
            images.push(result.imageUrl);
          }
        } catch (error) {
          console.error("Failed to generate illustration:", error);
        }
      }

      setIllustrations(images);
      toast.success("🎨 Illustrations ready!");
    } catch (error) {
      console.error("Error generating story:", error);
      toast.error("Failed to generate story");
    } finally {
      setIsGenerating(false);
    }
  };

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
            <BookOpen className="w-8 h-8 text-purple-600" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Story Studio
            </h1>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Create Your Story
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                What story would you like to create?
              </label>
              <Textarea
                placeholder="Example: A brave little dragon who learns to fly..."
                value={storyPrompt}
                onChange={(e) => setStoryPrompt(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <Button
              onClick={handleGenerateStory}
              disabled={isGenerating || !storyPrompt.trim()}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Magic...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Story with Illustrations
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {generatedStory && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                Your Story
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-purple max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {generatedStory}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {illustrations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5 text-pink-600" />
                Story Illustrations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {illustrations.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border-4 border-purple-200 shadow-lg">
                    <img
                      src={img}
                      alt={`Illustration ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="text-white text-sm font-medium text-center">
                        Scene {idx + 1}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

