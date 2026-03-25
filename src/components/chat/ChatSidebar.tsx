import { useState } from 'react';
import { Plus, Search, Trash2, X, MessageSquare, FileText, Bot } from 'lucide-react';
import { ChatSession } from '@/hooks/useChat';
import { ConversationSummary } from './ConversationSummary';

type Props = {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onSearch: (query: string) => void;
  onClose: () => void;
  onGenerateSummary: (sessionId: string) => Promise<any>;
};

export function ChatSidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onSearch,
  onClose,
  onGenerateSummary,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [summarySessionId, setSummarySessionId] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const summarySession = summarySessionId ? sessions.find(s => s.id === summarySessionId) ?? null : null;

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    onSearch(q);
  };

  const handleSummary = async (session: ChatSession) => {
    setSummarySessionId(session.id);
    if (!session.summary) {
      setSummaryLoading(true);
      await onGenerateSummary(session.id);
      setSummaryLoading(false);
    }
  };

  return (
    <div className="w-72 h-full bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Logo & branding */}
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="h-10 w-10 rounded-lg bg-card text-foreground flex items-center justify-center p-1">
          <Bot className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-display font-bold text-sidebar-foreground truncate">Apex AI</h1>
          <p className="text-xs text-sidebar-foreground/60">by Apex Financial Services</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-sidebar-hover text-sidebar-foreground/60 md:hidden">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* New chat button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-sidebar-border text-sidebar-foreground hover:bg-sidebar-hover transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/40" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-sidebar-hover border-none text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-sidebar-active"
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
              session.id === activeSessionId
                ? 'bg-sidebar-active text-sidebar-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-hover'
            }`}
            onClick={() => onSelectSession(session.id)}
          >
            <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
            <span className="flex-1 truncate">{session.title}</span>
            <div className="hidden group-hover:flex items-center gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); handleSummary(session); }}
                className="p-1 rounded hover:bg-sidebar-foreground/10"
                title="View Summary"
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                className="p-1 rounded hover:bg-destructive/20 text-destructive"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="text-center text-sidebar-foreground/40 text-xs py-8">No conversations yet</p>
        )}
      </div>

      {/* Footer disclaimer */}
      <div className="p-3 border-t border-sidebar-border">
        <p className="text-[10px] text-sidebar-foreground/40 leading-tight">
          This chatbot provides information based on the Finvest website and does not offer financial or investment advice.
        </p>
      </div>

      {/* Summary modal */}
      {summarySession && (
        <ConversationSummary
          session={summarySession}
          isLoading={summaryLoading}
          onClose={() => setSummarySessionId(null)}
        />
      )}
    </div>
  );
}
