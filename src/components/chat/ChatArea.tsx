import { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { WelcomeScreen } from './WelcomeScreen';
import { Message } from '@/hooks/useChat';
import { Menu } from 'lucide-react';

type Props = {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  onSendMessage: (msg: string) => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  language: string;
  onLanguageChange: (lang: string) => void;
  voice: any;
  activeSessionId: string | null;
  hasSession: boolean;
};

export function ChatArea({
  messages,
  isLoading,
  isStreaming,
  onSendMessage,
  onToggleSidebar,
  sidebarOpen,
  language,
  onLanguageChange,
  voice,
  activeSessionId,
  hasSession,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const showWelcome = !hasSession || messages.length === 0;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <header className="h-14 flex items-center px-4 border-b border-border bg-card shrink-0">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-muted transition-colors mr-2"
          >
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
        <div className="flex-1">
          <h2 className="text-sm font-display font-semibold text-foreground">Pragati</h2>
          <p className="text-xs text-muted-foreground">Ambit Finvest AI Assistant</p>
        </div>

        {/* Language selector */}
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="en">English</option>
          <option value="hi">हिंदी</option>
          <option value="mr">मराठी</option>
          <option value="ta">தமிழ்</option>
          <option value="te">తెలుగు</option>
          <option value="kn">ಕನ್ನಡ</option>
          <option value="ml">മലയാളം</option>
          <option value="bn">বাংলা</option>
          <option value="gu">ગુજરાતી</option>
          <option value="pa">ਪੰਜਾਬੀ</option>
        </select>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <WelcomeScreen language={language} onSuggestionClick={onSendMessage} />
        ) : (
          <div className="max-w-3xl mx-auto py-6 px-4 space-y-1">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onSpeak={() => voice.speak(msg.content, language)}
                isSpeaking={voice.isSpeaking}
              />
            ))}
            {isLoading && !isStreaming && (
              <div className="flex items-center gap-2 py-4 px-4">
                <div className="flex gap-1">
                  <span className="typing-dot w-2 h-2 rounded-full bg-primary" />
                  <span className="typing-dot w-2 h-2 rounded-full bg-primary" />
                  <span className="typing-dot w-2 h-2 rounded-full bg-primary" />
                </div>
                <span className="text-xs text-muted-foreground">Pragati is thinking...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        isLoading={isLoading}
        voice={voice}
        language={language}
      />
    </div>
  );
}
