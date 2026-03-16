import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: any;
  created_at: string;
};

export type ChatSession = {
  id: string;
  title: string;
  language: string;
  summary: any;
  created_at: string;
  updated_at: string;
  browser_id?: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

function getBrowserId(): string {
  let id = localStorage.getItem('pragati_browser_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('pragati_browser_id', id);
  }
  return id;
}

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // Load sessions (filtered by browser_id)
  const loadSessions = useCallback(async () => {
    const browserId = getBrowserId();
    const { data } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('browser_id', browserId)
      .order('updated_at', { ascending: false });
    if (data) setSessions(data as ChatSession[]);
  }, []);

  // Load messages for a session
  const loadMessages = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as unknown as Message[]);
  }, []);

  // Create new session
  const createSession = useCallback(async (language: string = 'en') => {
    const { data } = await supabase
      .from('chat_sessions')
      .insert({ title: 'New Chat', language })
      .select()
      .single();
    if (data) {
      const session = data as ChatSession;
      setSessions(prev => [session, ...prev]);
      setActiveSessionId(session.id);
      setMessages([]);
      return session;
    }
    return null;
  }, []);

  // Select session
  const selectSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    await loadMessages(sessionId);
  }, [loadMessages]);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    await supabase.from('chat_sessions').delete().eq('id', sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  }, [activeSessionId]);

  // Send message with streaming
  const sendMessage = useCallback(async (content: string, language: string = 'en') => {
    let sessionId = activeSessionId;

    // Create session if needed
    if (!sessionId) {
      const session = await createSession(language);
      if (!session) return;
      sessionId = session.id;
    }

    // Save user message
    const { data: userMsg } = await supabase
      .from('chat_messages')
      .insert({ session_id: sessionId, role: 'user', content })
      .select()
      .single();

    if (userMsg) {
      setMessages(prev => [...prev, userMsg as unknown as Message]);
    }

    // Update session title from first message
    if (messages.length === 0) {
      const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
      await supabase.from('chat_sessions').update({ title, language }).eq('id', sessionId);
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title, language } : s));
    }

    setIsLoading(true);
    setIsStreaming(true);

    let assistantContent = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content }].map(m => ({
            role: m.role,
            content: m.content,
          })),
          session_id: sessionId,
          language,
        }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error('Failed to get response');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;
      let sources: any[] = [];

      // Add placeholder assistant message
      const tempId = crypto.randomUUID();
      setMessages(prev => [...prev, {
        id: tempId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            // Check for sources in metadata
            if (parsed.sources) {
              sources = parsed.sources;
            }
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: assistantContent } : m
              ));
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Save assistant message to DB
      const { data: savedMsg } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: 'assistant',
          content: assistantContent,
          sources: sources.length > 0 ? sources : null,
        })
        .select()
        .single();

      if (savedMsg) {
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 ? (savedMsg as unknown as Message) : m
        ));
      }
    } catch (error) {
      console.error('Chat error:', error);
      assistantContent = 'Sorry, I encountered an error. Please try again.';
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { ...m, content: assistantContent } : m
      ));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [activeSessionId, messages, createSession]);

  // Generate conversation summary
  const generateSummary = useCallback(async (sessionId: string) => {
    try {
      const { data } = await supabase.functions.invoke('summarize-conversation', {
        body: { session_id: sessionId },
      });
      if (data?.summary) {
        await supabase
          .from('chat_sessions')
          .update({ summary: data.summary })
          .eq('id', sessionId);
        setSessions(prev =>
          prev.map(s => s.id === sessionId ? { ...s, summary: data.summary } : s)
        );
        return data.summary;
      }
    } catch (error) {
      console.error('Summary error:', error);
    }
    return null;
  }, []);

  // Search sessions
  const searchSessions = useCallback(async (query: string) => {
    if (!query.trim()) {
      await loadSessions();
      return;
    }
    const { data } = await supabase
      .from('chat_sessions')
      .select('*')
      .ilike('title', `%${query}%`)
      .order('updated_at', { ascending: false });
    if (data) setSessions(data as ChatSession[]);
  }, [loadSessions]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    activeSessionId,
    messages,
    isLoading,
    isStreaming,
    sendMessage,
    createSession,
    selectSession,
    deleteSession,
    generateSummary,
    searchSessions,
    setActiveSessionId,
  };
}
