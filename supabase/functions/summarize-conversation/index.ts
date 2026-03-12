import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { session_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!session_id) throw new Error("session_id is required");

    // Fetch all messages for the session
    const messagesResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_messages?session_id=eq.${session_id}&order=created_at.asc`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    const messages = await messagesResponse.json();
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ summary: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const conversation = messages
      .map((m: any) => `${m.role}: ${m.content}`)
      .join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Analyze this conversation and generate a structured summary. Return ONLY valid JSON with this structure:
{
  "questions": ["list of main questions asked by the user"],
  "answers": ["key answers provided"],
  "topics": ["topics discussed"],
  "intent": "overall user intent",
  "interest_category": "e.g., business loans, vehicle loans, eligibility, etc.",
  "lead_intent": "e.g., high interest, exploring, casual inquiry",
  "follow_up_topics": ["recommended follow-up topics"]
}`
          },
          { role: "user", content: conversation }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const summaryText = data.choices?.[0]?.message?.content?.trim() || "{}";

    let summary;
    try {
      summary = JSON.parse(summaryText.replace(/```json?\n?/g, '').replace(/```/g, ''));
    } catch {
      summary = { questions: [], topics: [], intent: "unknown" };
    }

    // Update session with summary
    await fetch(`${SUPABASE_URL}/rest/v1/chat_sessions?id=eq.${session_id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ summary }),
    });

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
