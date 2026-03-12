import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Pages to scrape from finvest.ambit.co
const PAGES_TO_SCRAPE = [
  { url: "https://finvest.ambit.co", title: "Home" },
  { url: "https://finvest.ambit.co/about-us", title: "About Us" },
  { url: "https://finvest.ambit.co/secured-business-loan", title: "Secured Business Loan (Vyapar Loan)" },
  { url: "https://finvest.ambit.co/unsecured-business-loan", title: "Unsecured Business Loan (Udyam Loan)" },
  { url: "https://finvest.ambit.co/used-commercial-vehicle-loan", title: "Used Vehicle Loan (Parivahan Loan)" },
  { url: "https://finvest.ambit.co/blog", title: "Blogs" },
  { url: "https://finvest.ambit.co/regulatory-information", title: "Investors / Regulatory Information" },
  { url: "https://finvest.ambit.co/team", title: "Leadership Team" },
  { url: "https://finvest.ambit.co/news", title: "News and Media" },
  { url: "https://finvest.ambit.co/career", title: "Careers" },
  { url: "https://finvest.ambit.co/privacy-policy", title: "Privacy Policy" },
  { url: "https://finvest.ambit.co/qrc-form", title: "Lodge a Complaint" },
  { url: "https://finvest.ambit.co/payment-via-emi", title: "Pay EMI" },
  { url: "https://finvest.ambit.co/e-auction", title: "E-Auction" },
];

function cleanText(html: string): string {
  // Remove scripts, styles, and HTML tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

function chunkText(text: string, chunkSize: number = 600, overlap: number = 100): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim().length > 50) {
      chunks.push(chunk);
    }
    i += chunkSize - overlap;
  }

  return chunks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Create scrape log
    const logResponse = await fetch(`${SUPABASE_URL}/rest/v1/scrape_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ status: "in_progress" }),
    });
    const [scrapeLog] = await logResponse.json();
    const logId = scrapeLog?.id;

    let totalPages = 0;
    let totalChunks = 0;

    // Clear existing chunks
    await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks?id=not.is.null`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    for (const page of PAGES_TO_SCRAPE) {
      try {
        console.log(`Scraping: ${page.url}`);
        const response = await fetch(page.url, {
          headers: {
            "User-Agent": "PragatiBot/1.0 (Ambit Finvest Chatbot)",
          },
        });

        if (!response.ok) {
          console.error(`Failed to fetch ${page.url}: ${response.status}`);
          continue;
        }

        const html = await response.text();
        const text = cleanText(html);

        if (text.length < 100) {
          console.log(`Skipping ${page.url}: too little content`);
          continue;
        }

        const chunks = chunkText(text);
        console.log(`${page.title}: ${chunks.length} chunks created`);

        // Insert chunks in batches
        const batchSize = 10;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize).map((content, idx) => ({
            content,
            source_url: page.url,
            page_title: page.title,
            chunk_index: i + idx,
          }));

          await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify(batch),
          });
        }

        totalPages++;
        totalChunks += chunks.length;
      } catch (err) {
        console.error(`Error scraping ${page.url}:`, err);
      }
    }

    // Also add hardcoded knowledge about Ambit Finvest
    const additionalKnowledge = [
      {
        content: "Ambit Finvest is an RBI registered Non-Banking Financial Company (NBFC) that provides business loans to MSMEs in India. They are in partnership with Daiwa Securities Group Inc, with over 120 years of excellence. CIN: U65999MH2006PTC163257. They have 32500+ customers, 11 states, 78+ branches, and 936+ employees. Contact: +91 9115998000, customercare@ambit.co. Address: Kanakia Wall Street, 5th floor, A 506-510, Andheri-Kurla Road, Andheri East, Mumbai-400093.",
        source_url: "https://finvest.ambit.co",
        page_title: "Company Overview",
        chunk_index: 0,
      },
      {
        content: "Ambit Finvest offers three main loan products: 1) Secured Business Loan (Vyapar Loan) - Expand your business and unlock its true potential with loans up to ₹3 crores. 2) Unsecured Business Loan (Udyam Loan) - Power your business and multiply your profits with loans up to ₹50 lakhs. 3) Used Vehicle Loan (Parivahan Loan) - Drive your dream car or expand your fleet with quick loans. All loans feature Quick processing, Easy documentation, and Affordable interest rates.",
        source_url: "https://finvest.ambit.co",
        page_title: "Loan Products",
        chunk_index: 0,
      },
      {
        content: "Ambit Finvest has won several awards: NBFC Company of the year 2022 at BFSI Leadership Awards 2022 by Krypton group, Lending Finance Company of the year 2022 at NBFC & Fintech Excellence Awards 2022 by Quantic India, NBFC Company of the Year 2022 (Financial Inclusion) at Elets NBFC 100 Leader of Excellence Awards by Banking and Finance Post, Future Digital Leader 2022 at BFSI Leadership Summit 2022 by Elets.",
        source_url: "https://finvest.ambit.co",
        page_title: "Awards",
        chunk_index: 0,
      },
      {
        content: "In India's vibrant economy, MSMEs are unsung heroes, contributing 30% to the GDP while often struggling to secure the financial support they need. Whether it is for expansion, managing working capital for large orders, or navigating complex financial landscapes, these enterprises face significant challenges. At Ambit Finvest, we see immense potential in every MSME and are committed to empowering their journey. By leveraging innovative technology and advanced credit assessment methods, our solutions offer minimal hassle, high value, and speed, all backed by dedicated customer service.",
        source_url: "https://finvest.ambit.co",
        page_title: "Mission",
        chunk_index: 0,
      },
    ];

    await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(additionalKnowledge),
    });
    totalChunks += additionalKnowledge.length;

    // Update scrape log
    if (logId) {
      await fetch(`${SUPABASE_URL}/rest/v1/scrape_logs?id=eq.${logId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          status: "completed",
          pages_scraped: totalPages,
          chunks_created: totalChunks,
          completed_at: new Date().toISOString(),
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        pages_scraped: totalPages,
        chunks_created: totalChunks,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Scrape error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
