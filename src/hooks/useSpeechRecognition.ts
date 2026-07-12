import { useCallback, useEffect, useRef, useState } from "react";

interface UseSpeechRecognitionOptions {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was denied.",
  "permission-denied": "Microphone access was denied.",
  "no-speech": "No speech detected — try again.",
  "audio-capture": "No microphone was found.",
};

export function useSpeechRecognition({ onTranscript, onError }: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const SpeechRecognitionCtor =
    typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;
  const isSupported = !!SpeechRecognitionCtor;

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionCtor || isListening) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onTranscript(transcript);
    };
    recognition.onerror = (event) => {
      onError?.(ERROR_MESSAGES[event.error] ?? "Voice search failed — try again.");
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [SpeechRecognitionCtor, isListening, onTranscript, onError]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isSupported, isListening, start, stop };
}
