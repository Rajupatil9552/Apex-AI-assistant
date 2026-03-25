import ReactMarkdown from 'react-markdown';
import { Volume2, User, Bot, ExternalLink } from 'lucide-react';
import { Message } from '@/hooks/useChat';

type Props = {
  message: Message;
  onSpeak: () => void;
  isSpeaking: boolean;
};

export function ChatMessage({ message, onSpeak, isSpeaking }: Props) {
  const isUser = message.role === 'user';
  const sources = message.sources as { url: string; title: string }[] | null;

  return (
    <div className={`animate-fade-in-up py-4 ${isUser ? '' : ''}`}>
      <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-primary' : 'bg-card border border-border'
        }`}>
          {isUser ? (
            <User className="h-4 w-4 text-primary-foreground" />
          ) : (
            <Bot className="h-5 w-5 text-primary" />
          )}
        </div>

        {/* Message content */}
        <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
          <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-chat-user-bg text-chat-user-fg rounded-tr-md'
              : 'bg-chat-bot-bg text-chat-bot-fg border border-border rounded-tl-md shadow-sm'
          }`}>
            {isUser ? (
              <p>{message.content}</p>
            ) : (
              <div className="chat-markdown">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>

          {/* Sources */}
          {!isUser && sources && sources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sources.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  {source.title || 'Source'}
                </a>
              ))}
            </div>
          )}

          {/* Actions */}
          {!isUser && message.content && (
            <div className="mt-1.5 flex gap-1">
              <button
                onClick={onSpeak}
                className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${isSpeaking ? 'text-primary' : 'text-muted-foreground'}`}
                title="Listen"
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
