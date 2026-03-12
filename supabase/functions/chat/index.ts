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
    const { messages, session_id, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userMessage = messages[messages.length - 1]?.content || "";

    // Step 1: Query Rewriting - expand the user query for better retrieval
    const rewriteResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a query rewriting assistant for Ambit Finvest (finvest.ambit.co), an RBI-registered NBFC providing business loans and vehicle loans.
Rewrite the user's query into a clear, expanded search query that will help find relevant information from the Finvest website.
Preserve the original meaning but add context about Ambit Finvest's services (secured business loans/Vyapar Loan, unsecured business loans/Udyam Loan, used vehicle loans/Parivahan Loan).
Output ONLY the rewritten query, nothing else.`
          },
          { role: "user", content: userMessage }
        ],
      }),
    });

    let rewrittenQuery = userMessage;
    if (rewriteResponse.ok) {
      const rewriteData = await rewriteResponse.json();
      rewrittenQuery = rewriteData.choices?.[0]?.message?.content?.trim() || userMessage;
    }
    console.log("Rewritten query:", rewrittenQuery);

    // Step 2: Hybrid Search - full-text search from knowledge base
    const searchResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_knowledge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        search_query: rewrittenQuery,
        match_limit: 15,
      }),
    });

    let chunks: any[] = [];
    if (searchResponse.ok) {
      chunks = await searchResponse.json();
    }

    // Also do a simple keyword search for broader coverage
    const keywords = rewrittenQuery.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 5);
    if (keywords.length > 0) {
      const keywordSearch = await fetch(
        `${SUPABASE_URL}/rest/v1/knowledge_chunks?content=ilike.*${encodeURIComponent(keywords[0])}*&select=id,content,source_url,page_title&limit=10`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      if (keywordSearch.ok) {
        const keywordResults = await keywordSearch.json();
        const existingIds = new Set(chunks.map((c: any) => c.id));
        for (const r of keywordResults) {
          if (!existingIds.has(r.id)) {
            chunks.push({ ...r, rank: 0.1 });
          }
        }
      }
    }

    console.log(`Found ${chunks.length} chunks`);

    // Step 3: Re-ranking - use LLM to select most relevant chunks
    let context = "";
    let sources: { url: string; title: string }[] = [];

    if (chunks.length > 0) {
      // If we have many chunks, re-rank them
      if (chunks.length > 5) {
        const rerankResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: `You are a relevance ranker. Given a query and a list of text chunks, return the indices (0-based) of the top 5 most relevant chunks as a JSON array of numbers. Only output the JSON array, nothing else.`
              },
              {
                role: "user",
                content: `Query: "${userMessage}"\n\nChunks:\n${chunks.map((c: any, i: number) => `[${i}] ${c.content.substring(0, 200)}`).join("\n\n")}`
              }
            ],
          }),
        });

        if (rerankResponse.ok) {
          const rerankData = await rerankResponse.json();
          const rankText = rerankData.choices?.[0]?.message?.content?.trim() || "[]";
          try {
            const indices = JSON.parse(rankText.replace(/```json?\n?/g, '').replace(/```/g, ''));
            if (Array.isArray(indices)) {
              const topChunks = indices
                .filter((i: number) => i >= 0 && i < chunks.length)
                .map((i: number) => chunks[i]);
              if (topChunks.length > 0) {
                chunks = topChunks;
              }
            }
          } catch {
            // Use top 5 by rank
            chunks = chunks.slice(0, 5);
          }
        } else {
          chunks = chunks.slice(0, 5);
        }
      }

      context = chunks.map((c: any) => c.content).join("\n\n---\n\n");
      sources = chunks.map((c: any) => ({
        url: c.source_url,
        title: c.page_title,
      }));
      // Deduplicate sources
      sources = sources.filter((s, i, arr) => arr.findIndex(a => a.url === s.url) === i);
    }

    // Step 4: Generate answer with Gemini
    const langInstruction = language && language !== 'en'
      ? `IMPORTANT: Respond in the same language as the user. The user's language code is "${language}". Detect and match their language.`
      : '';

    const systemPrompt = `You are Pragati, the official AI assistant for Ambit Finvest (finvest.ambit.co), an RBI-registered NBFC providing business loans and vehicle loans to MSMEs in India.

${langInstruction}

RULES:
1. Answer STRICTLY from the provided context. Do not make up information.
2. If the answer is not in the context, say: "This information is not available on the Finvest website. Please contact Ambit Finvest at +91 9115998000 or customercare@ambit.co for more details."
3. NEVER provide investment advice, stock recommendations, portfolio suggestions, or financial predictions.
4. If asked for investment advice, respond: "I cannot provide investment advice. Please consult a certified financial advisor or contact the Finvest team at +91 9115998000."
5. Be helpful, professional, and concise.
6. When citing information, mention it naturally in your response.
7. If the user greets you, respond warmly and introduce yourself as Pragati.

CONTEXT FROM FINVEST WEBSITE:
${context || "No relevant context found in the knowledge base."}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-10), // Keep last 10 messages for context window
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Service credits exhausted. Please try later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    // Prepend sources as first SSE event
    const encoder = new TextEncoder();
    const sourcesEvent = `data: ${JSON.stringify({ sources })}\n\n`;

    const transformStream = new TransformStream({
      start(controller) {
        controller.enqueue(encoder.encode(sourcesEvent));
      },
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
    });

    const stream = response.body!.pipeThrough(transformStream);

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("Chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
