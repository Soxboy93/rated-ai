import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Eye, Brain, Heart, Type, Volume2, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

export default function AccessibilitySettings() {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState({
    dyslexiaMode: false,
    adhdMode: false,
    autismMode: false,
    fontSize: "medium",
    highContrast: false,
    textToSpeech: false,
    reducedMotion: false,
  });

  const { data: savedSettings } = trpc.accessibility.getSettings.useQuery();
  const saveSettings = trpc.accessibility.updateSettings.useMutation({
    onSuccess: () => {
      alert("Settings saved successfully!");
    },
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings({
        dyslexiaMode: !!savedSettings.dyslexiaMode,
        adhdMode: !!savedSettings.adhdMode,
        autismMode: !!savedSettings.autismMode,
        fontSize: savedSettings.fontSize || "medium",
        highContrast: !!savedSettings.highContrast,
        textToSpeech: !!savedSettings.textToSpeech,
        reducedMotion: !!savedSettings.reducedMotion,
      });
    }
  }, [savedSettings]);

  const handleSave = async () => {
    await saveSettings.mutateAsync(settings);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-blue-50">
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
            <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              Accessibility Settings
            </h1>
          </div>
          <Button
            onClick={handleSave}
            disabled={saveSettings.isPending}
            className="bg-gradient-to-r from-green-500 to-blue-500"
          >
            {saveSettings.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <Card className="p-8 mb-8 bg-gradient-to-r from-green-500 to-blue-500 text-white text-center">
          <div className="text-6xl mb-4">♿</div>
          <h2 className="text-3xl font-bold mb-3">Learning for Everyone</h2>
          <p className="text-lg opacity-90">
            Customize your experience to match your learning style and needs
          </p>
        </Card>

        {/* Special Needs Modes */}
        <div className="space-y-6 mb-8">
          <h2 className="text-2xl font-bold">Special Needs Support</h2>
          
          {/* Dyslexia Mode */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Type className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">Dyslexia-Friendly Mode</h3>
                <p className="text-gray-600 mb-4">
                  Uses OpenDyslexic font, increased letter spacing, and line height for easier reading
                </p>
                <Button
                  variant={settings.dyslexiaMode ? "default" : "outline"}
                  onClick={() => setSettings({ ...settings, dyslexiaMode: !settings.dyslexiaMode })}
                >
                  {settings.dyslexiaMode ? "✓ Enabled" : "Enable"}
                </Button>
              </div>
            </div>
          </Card>

          {/* ADHD Mode */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Brain className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">ADHD Focus Mode</h3>
                <p className="text-gray-600 mb-4">
                  Reduces distractions, adds focus timers, and breaks content into smaller chunks
                </p>
                <Button
                  variant={settings.adhdMode ? "default" : "outline"}
                  onClick={() => setSettings({ ...settings, adhdMode: !settings.adhdMode })}
                >
                  {settings.adhdMode ? "✓ Enabled" : "Enable"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Autism Mode */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Heart className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">Autism-Friendly Mode</h3>
                <p className="text-gray-600 mb-4">
                  Predictable patterns, clear structure, visual schedules, and reduced sensory input
                </p>
                <Button
                  variant={settings.autismMode ? "default" : "outline"}
                  onClick={() => setSettings({ ...settings, autismMode: !settings.autismMode })}
                >
                  {settings.autismMode ? "✓ Enabled" : "Enable"}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Visual Settings */}
        <div className="space-y-6 mb-8">
          <h2 className="text-2xl font-bold">Visual Settings</h2>
          
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Eye className="w-6 h-6 text-gray-600" />
                <div>
                  <h3 className="font-bold">Font Size</h3>
                  <p className="text-sm text-gray-600">Adjust text size for comfortable reading</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {["small", "medium", "large", "xlarge"].map((size) => (
                <Button
                  key={size}
                  variant={settings.fontSize === size ? "default" : "outline"}
                  onClick={() => setSettings({ ...settings, fontSize: size })}
                  className="capitalize"
                >
                  {size}
                </Button>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-gray-600" />
                <div>
                  <h3 className="font-bold">High Contrast Mode</h3>
                  <p className="text-sm text-gray-600">Increase contrast for better visibility</p>
                </div>
              </div>
              <Button
                variant={settings.highContrast ? "default" : "outline"}
                onClick={() => setSettings({ ...settings, highContrast: !settings.highContrast })}
              >
                {settings.highContrast ? "✓ On" : "Off"}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="w-6 h-6 text-gray-600" />
                <div>
                  <h3 className="font-bold">Text-to-Speech</h3>
                  <p className="text-sm text-gray-600">Have text read aloud to you</p>
                </div>
              </div>
              <Button
                variant={settings.textToSpeech ? "default" : "outline"}
                onClick={() => setSettings({ ...settings, textToSpeech: !settings.textToSpeech })}
              >
                {settings.textToSpeech ? "✓ On" : "Off"}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-gray-600" />
                <div>
                  <h3 className="font-bold">Reduced Motion</h3>
                  <p className="text-sm text-gray-600">Minimize animations and transitions</p>
                </div>
              </div>
              <Button
                variant={settings.reducedMotion ? "default" : "outline"}
                onClick={() => setSettings({ ...settings, reducedMotion: !settings.reducedMotion })}
              >
                {settings.reducedMotion ? "✓ On" : "Off"}
              </Button>
            </div>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-bold mb-2">💙 Inclusive Learning</h3>
          <p className="text-sm text-gray-700">
            We believe every child deserves access to quality education. Our accessibility features are designed
            to support diverse learning needs and ensure everyone can learn at their own pace.
          </p>
        </Card>
      </div>
    </div>
  );
}

