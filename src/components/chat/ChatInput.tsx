import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Square } from 'lucide-react';

type Props = {
  onSend: (message: string) => void;
  isLoading: boolean;
  voice: any;
  language: string;
};

export function ChatInput({ onSend, isLoading, voice, language }: Props) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-fill from voice transcript
  useEffect(() => {
    if (voice.transcript && !voice.isListening) {
      setInput(voice.transcript);
      voice.setTranscript('');
    }
  }, [voice.transcript, voice.isListening]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    onSend(text);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const handleVoice = () => {
    if (voice.isListening) {
      voice.stopListening();
    } else {
      voice.startListening(voice.getRecognitionLang(language));
    }
  };

  return (
    <div className="border-t border-border bg-card p-4 shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 bg-muted rounded-2xl px-4 py-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask Apex AI anything about Apex Financial Services..."
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-[120px]"
            disabled={isLoading}
          />

          {/* Voice button */}
          <button
            onClick={handleVoice}
            className={`p-2 rounded-xl transition-all ${
              voice.isListening
                ? 'bg-destructive text-destructive-foreground voice-active'
                : 'hover:bg-background text-muted-foreground hover:text-foreground'
            }`}
            title={voice.isListening ? 'Stop recording' : 'Start voice input'}
          >
            {voice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* Stop speaking */}
          {voice.isSpeaking && (
            <button
              onClick={voice.stopSpeaking}
              className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              title="Stop speaking"
            >
              <Square className="h-4 w-4" />
            </button>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {voice.isListening && (
          <p className="text-xs text-primary mt-2 text-center animate-pulse">
            🎙️ Listening... {voice.transcript && `"${voice.transcript}"`}
          </p>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Apex AI provides information from the Finvest website only. Not financial advice.
        </p>
      </div>
    </div>
  );
}
