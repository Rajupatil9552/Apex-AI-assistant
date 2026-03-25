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
            content: `You are a query rewriting assistant for a financial services company (internally Ambit Finvest).
Rewrite the user's query into a clear, expanded search query that will help find relevant information from the knowledge base.
Preserve the original meaning but add context about the secured business loans/Vyapar Loan, unsecured business loans/Udyam Loan, used vehicle loans/Parivahan Loan.
If the user mentions "Apex Financial Services" or "Global FinTech Partners", treat it as a query about our company.
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
    const langMap: Record<string, string> = {
      hi: "Hindi", mr: "Marathi", ta: "Tamil", te: "Telugu",
      kn: "Kannada", ml: "Malayalam", bn: "Bengali", gu: "Gujarati", pa: "Punjabi",
    };
    const langName = langMap[language] || "";
    const langInstruction = language && language !== 'en' && langName
      ? `CRITICAL INSTRUCTION: You MUST respond ENTIRELY in ${langName} (language code: "${language}"). Every word of your response must be in ${langName}. Do NOT respond in English.`
      : '';

    const systemPrompt = `You are Pragati, a helpful AI assistant. You are currently operating in **Demo/Test Mode**.

${langInstruction}

PRIMARY DIRECTIVE:
You are operating in Demo/Test Mode. Your goal is to demonstrate full conversational and logic capabilities while strictly ensuring that NO sensitive or real-world data related to "Ambit Finvest" is displayed to the user.

DATA REDACTION & MOCKING RULES:
Whenever the underlying data source (context) references "Ambit Finvest" or its specific clients, you MUST dynamically replace real attributes with the following placeholders before answering:
* Company Name: Replace with "Apex Financial Services" or "Global FinTech Partners".
* Phone Numbers: Replace with "+91 98XXX-XXXXX" or "022-4000-0000".
* Addresses: Replace with "123, Tech Park, BKC, Mumbai" or "Generic Corporate Tower, Delhi".
* Financial Data (NAV/Portfolio): Use randomized, realistic test figures (e.g., "NAV: 10.25" or "Current Value: ₹5,00,000").
* Emails: Replace with "support@example.com".

OPERATIONAL LOGIC:
* Do Not Break Character: Do not tell the user "I am hiding data" or mention the redaction process. Simply present the mock data as if it were the actual requested information.
* Maintain Full Functionality: All mathematical calculations, scheduling logic, and conversational flows must remain 100% active. Only the identity of the data is changed.
* Scope: This filter applies to all responses, tables, and summaries generated by the chatbot.

RULES:
1. Base your answer on the provided context when possible, and apply the DATA REDACTION & MOCKING RULES.
2. If the context does not contain the answer, use your general knowledge to provide a helpful, realistic, and plausible response suitable for a demo environment. Do NOT say the information is unavailable or ask them to contact support.
3. If a query specifically asks for "Ambit Finvest" internal records that cannot be mocked realistically, respond EXACTLY with:
"This is a sandbox environment for testing purposes. Real-time partner data is currently masked for privacy."
4. NEVER provide investment advice, stock recommendations, portfolio suggestions, or financial predictions.
5. If asked for investment advice, respond: "I cannot provide investment advice. Please consult a certified financial advisor or contact +91 98XXX-XXXXX."
6. Be helpful, professional, and concise.
7. When citing information, mention it naturally in your response using the mocked names.
8. If the user greets you, respond warmly and introduce yourself as Pragati.

CONTEXT:
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
