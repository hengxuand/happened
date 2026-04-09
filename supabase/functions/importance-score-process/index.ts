import {serve} from "https://deno.land/std@0.168.0/http/server.ts";
import {createSupabaseServiceClient} from "../_shared/supabaseClient.ts";
import type {GoogleNewsRss} from "../_shared/types.ts";

const supabase = createSupabaseServiceClient();

serve(async (_req: Request) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const start = Date.now();
    const log = (msg: string) => console.log(`[${requestId}] ${msg}`);
    const error = (msg: string, err?: unknown) => console.error(`[${requestId}] ERROR: ${msg}`, err);

    try {
        log("Invocation started");

        // 1. 获取待打分新闻（最多40条）
        log("Fetching unscored news from DB…");
        const {data: pendingNews, error: fetchError} = await supabase
            .from('google_news_rss')
            .select('*')
            .is('importance_score', null)
            .order('pub_date', {ascending: false})
            .limit(5)
            .returns<GoogleNewsRss[]>();

        if (fetchError) throw fetchError;
        if (!pendingNews || pendingNews.length === 0) {
            log("No news to score – exiting");
            return new Response(JSON.stringify({message: "No news to score today."}), {
                headers: {"Content-Type": "application/json"},
            });
        }

        log(`Fetched ${pendingNews.length} unscored item(s)`);

        // ==================== Grok 配置 ====================
        const GROK_API_KEY = Deno.env.get("XAI_API_KEY");
        if (!GROK_API_KEY) throw new Error("XAI_API_KEY not set in Supabase secrets");

        const GROK_MODEL = "grok-4-1-fast-reasoning"; // 最强 reasoning + structured outputs

        const systemPrompt = `You are an expert news editor for a bilingual news platform (Happened.info). 

Your task is to score the importance of the provided news items from 1 to 100.

SCORING RULES:
1. Score the news strictly within its own 'topic' category. 
   (A major tech news can score 90+ in the TECHNOLOGY topic, even if it is not globally significant.)
2. Consider the source's credibility and influence within its specific field 
   (e.g., a well-known tech site vs. a small personal blog).
3. Evaluate the potential impact based on the 'language' audience 
   ('zh' for Chinese-speaking readers, 'en' for English-speaking readers).
4. Filter out clickbait, gossip, or low-value content (score them below 30).

You MUST perform the actions in the following exact order:
1. Check the 'description' field. If it contains a more eye-catching or better title than the current 'title', 
   replace the existing 'title' with the new one and also update the 'source' field accordingly. 
   If no better title is found, keep the original 'title' and 'source'.
2. Assign an importance_score (1-100) based on the rules above.

Strictly forbidden:
- Do not translate any text at any point. Keep everything in its original language.
- Do not add any explanations, comments, markdown, or extra text outside the JSON.
- Do not change any other fields except 'title', 'source', and 'importance_score'.

Return ONLY a valid JSON object with this exact structure (no other text whatsoever):

{
  "scored_news": [
    {
      "id": "...",
      "topic": "...",
      "language": "...",
      "title": "...",           // possibly updated
      "source": "...",          // possibly updated
      "pub_date": "...",
      "guid": "...",
      "link": "...",
      "description": "...",
      "importance_score": 85,   // MUST be an integer between 1 and 100
      "importance_scored_at": null,
      "updated_at": null,
      "created_at": "..."
    }
    // ... more items
  ]
}`;


        log("Sending request to Grok…");
        const aiStart = Date.now();

        const res = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${GROK_API_KEY}`,
            },
            body: JSON.stringify({
                model: GROK_MODEL,
                messages: [
                    {role: "system", content: systemPrompt},
                    {role: "user", content: `DATA TO SCORE:\n${JSON.stringify(pendingNews)}`},
                ],
                temperature: 0.1,           // 低温度 → 评分更稳定
                max_tokens: 8192,
                response_format: {type: "json_object"},   // 强制纯 JSON
            }),
        });

        if (!res.ok) {
            console.error("Grok API error:", res.status, res.statusText);
            const errText = await res.text();
            throw new Error(`Grok API error ${res.status}: ${errText}`);
        }
        console.log("Grok API response:", res.status, res.statusText);
        const data = await res.json();
        const responseText: string = data.choices?.[0]?.message?.content ?? "";
        log(`Grok responded in ${Date.now() - aiStart}ms`);

        // ==================== 解析 & 处理 ====================
        const parsed = JSON.parse(responseText) as { scored_news: GoogleNewsRss[] };
        const scoredItems = parsed.scored_news;

        log(`Parsed ${scoredItems.length} scored item(s) from Grok`);

        const newsMap = new Map<string, GoogleNewsRss>(
            (pendingNews as GoogleNewsRss[]).map((n) => [n.id, n])
        );

        const updates: GoogleNewsRss[] = scoredItems
            .map((item): GoogleNewsRss | null => {
                const row = newsMap.get(item.id);
                if (!row) {
                    log(`[skip] id=${item.id} – not found in original batch`);
                    return null;
                }

                const titleChanged = item.title !== row.title;
                const sourceChanged = item.source !== row.source;

                log(
                    `[score] id=${item.id} score=${item.importance_score}` +
                    (titleChanged ? ` | title: "${row.title}" → "${item.title}"` : "") +
                    (sourceChanged ? ` | source: "${row.source}" → "${item.source}"` : "")
                );

                return {
                    ...row,
                    importance_score: item.importance_score,
                    title: item.title,
                    source: item.source,
                    importance_scored_at: new Date().toISOString(),
                };
            })
            .filter((item): item is GoogleNewsRss => item !== null);

        // ==================== 写回数据库 ====================
        log(`Writing ${updates.length} score(s) to DB…`);
        const dbStart = Date.now();
        const {error: updateError} = await supabase
            .from('google_news_rss')
            .upsert(updates, {onConflict: 'id'});

        if (updateError) throw updateError;

        log(`DB updated in ${Date.now() - dbStart}ms`);
        log(`✓ Done – ${updates.length} item(s) scored in ${Date.now() - start}ms`);

        return new Response(
            JSON.stringify({success: true, processedCount: updates.length}),
            {headers: {"Content-Type": "application/json"}}
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Scoring failed after ${Date.now() - start}ms`, err);
        return new Response(JSON.stringify({error: message}), {
            status: 500,
            headers: {"Content-Type": "application/json"},
        });
    }
});