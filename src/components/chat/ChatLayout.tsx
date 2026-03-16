import { useState, useEffect } from 'react';
import { ChatSidebar } from './ChatSidebar';
import { ChatArea } from './ChatArea';
import { useChat } from '@/hooks/useChat';
import { useVoice } from '@/hooks/useVoice';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu } from 'lucide-react';

export function ChatLayout() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [language, setLanguage] = useState('en');
  const chat = useChat();
  const voice = useVoice();

  // Close sidebar on mobile, open on desktop when viewport changes
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile sidebar toggle */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-sidebar text-sidebar-foreground hover:bg-sidebar-hover transition-colors md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed md:relative z-40 transition-transform duration-300 ease-in-out h-full`}>
        <ChatSidebar
          sessions={chat.sessions}
          activeSessionId={chat.activeSessionId}
          onNewChat={() => chat.createSession(language)}
          onSelectSession={chat.selectSession}
          onDeleteSession={chat.deleteSession}
          onSearch={chat.searchSessions}
          onClose={() => setSidebarOpen(false)}
          onGenerateSummary={chat.generateSummary}
        />
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatArea
          messages={chat.messages}
          isLoading={chat.isLoading}
          isStreaming={chat.isStreaming}
          onSendMessage={(msg) => chat.sendMessage(msg, language)}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
          language={language}
          onLanguageChange={setLanguage}
          voice={voice}
          activeSessionId={chat.activeSessionId}
          hasSession={!!chat.activeSessionId}
        />
      </div>
    </div>
  );
}
