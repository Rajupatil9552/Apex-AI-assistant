import { X, MessageSquare, Target, Lightbulb, TrendingUp } from 'lucide-react';
import { ChatSession } from '@/hooks/useChat';

type Props = {
  session: ChatSession;
  isLoading: boolean;
  onClose: () => void;
};

export function ConversationSummary({ session, isLoading, onClose }: Props) {
  const summary = session.summary as {
    questions?: string[];
    answers?: string[];
    topics?: string[];
    intent?: string;
    interest_category?: string;
    lead_intent?: string;
    follow_up_topics?: string[];
  } | null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-display font-semibold text-foreground">Conversation Summary</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="flex gap-1 justify-center mb-3">
                <span className="typing-dot w-2 h-2 rounded-full bg-primary" />
                <span className="typing-dot w-2 h-2 rounded-full bg-primary" />
                <span className="typing-dot w-2 h-2 rounded-full bg-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Generating summary...</p>
            </div>
          ) : summary ? (
            <>
              {summary.questions && summary.questions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">Questions Asked</h4>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground pl-6">
                    {summary.questions.map((q, i) => <li key={i} className="list-disc">{q}</li>)}
                  </ul>
                </div>
              )}

              {summary.topics && summary.topics.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">Topics Discussed</h4>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.topics.map((t, i) => (
                      <span key={i} className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {summary.interest_category && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">User Interest</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{summary.interest_category}</p>
                  {summary.lead_intent && (
                    <p className="text-xs text-muted-foreground/70 mt-1">Lead intent: {summary.lead_intent}</p>
                  )}
                </div>
              )}

              {summary.follow_up_topics && summary.follow_up_topics.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">Recommended Follow-ups</h4>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground pl-6">
                    {summary.follow_up_topics.map((t, i) => <li key={i} className="list-disc">{t}</li>)}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No summary available yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
