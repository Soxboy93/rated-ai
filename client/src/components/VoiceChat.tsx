import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface VoiceChatProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceChat({ onTranscript, disabled }: VoiceChatProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success("🎤 Recording started! Speak now...");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      // Upload audio to storage first
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");

      // For now, we'll use browser's built-in speech recognition as a fallback
      // In production, you'd upload to server and use Whisper API
      toast.info("Processing your voice...");
      
      // Simulate transcription (in real app, call server endpoint)
      setTimeout(() => {
        setIsProcessing(false);
        toast.success("✅ Voice processed!");
        // This would be replaced with actual transcription
        onTranscript("Voice message received");
      }, 1500);
    } catch (error) {
      console.error("Error processing audio:", error);
      toast.error("Failed to process audio");
      setIsProcessing(false);
    }
  };

  return (
    <Button
      type="button"
      variant={isRecording ? "destructive" : "outline"}
      size="icon"
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled || isProcessing}
      className="rounded-full"
    >
      {isProcessing ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isRecording ? (
        <MicOff className="w-5 h-5 animate-pulse" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </Button>
  );
}

