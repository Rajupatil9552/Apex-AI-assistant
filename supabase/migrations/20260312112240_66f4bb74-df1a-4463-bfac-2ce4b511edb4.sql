-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge chunks table for RAG
CREATE TABLE public.knowledge_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  source_url TEXT NOT NULL,
  page_title TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  search_vector tsvector,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create GIN index for full-text search
CREATE INDEX idx_knowledge_chunks_search ON public.knowledge_chunks USING GIN(search_vector);
CREATE INDEX idx_knowledge_chunks_source ON public.knowledge_chunks(source_url);

-- Trigger to auto-update search_vector
CREATE OR REPLACE FUNCTION public.update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_knowledge_search_vector
BEFORE INSERT OR UPDATE ON public.knowledge_chunks
FOR EACH ROW
EXECUTE FUNCTION public.update_search_vector();

-- Chat sessions table
CREATE TABLE public.chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  language TEXT NOT NULL DEFAULT 'en',
  summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id, created_at);

-- Scrape logs
CREATE TABLE public.scrape_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  pages_scraped INTEGER DEFAULT 0,
  chunks_created INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for knowledge chunks
CREATE POLICY "Anyone can read knowledge chunks" ON public.knowledge_chunks FOR SELECT USING (true);

-- Public access for chat (no auth required for chatbot)
CREATE POLICY "Anyone can manage chat sessions" ON public.chat_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can manage chat messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can read scrape logs" ON public.scrape_logs FOR SELECT USING (true);

-- Full-text search function
CREATE OR REPLACE FUNCTION public.search_knowledge(
  search_query TEXT,
  match_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source_url TEXT,
  page_title TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.source_url,
    kc.page_title,
    ts_rank(kc.search_vector, websearch_to_tsquery('english', search_query))::REAL as rank
  FROM public.knowledge_chunks kc
  WHERE kc.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_knowledge_chunks_updated_at
BEFORE UPDATE ON public.knowledge_chunks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at
BEFORE UPDATE ON public.chat_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();