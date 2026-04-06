import {serve} from "https://deno.land/std@0.168.0/http/server.ts"
import {createSupabaseServiceClient} from "../_shared/supabaseClient.ts";
import {createGeminiModel} from "../_shared/geminiClient.ts";


const supabase = createSupabaseServiceClient();
const model = createGeminiModel();

serve(async (req) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const start = Date.now();

    const log = (msg: string) => console.log(`[${requestId}] ${msg}`);
    const error = (msg: string, err?: unknown) =>
        console.error(`[${requestId}] ERROR: ${msg}`, err);

    try {
        log("Invocation started");

        // 2. 获取还没有打分的新闻 (每次最多处理 40 条，防止请求过大或超时)
        log("Fetching unscored news from DB…");
        const {data: pendingNews, error: fetchError} = await supabase
            .from('google_news_rss')
            .select('*')
            .is('importance_score', null)
            .order('published_at', {ascending: false})
            .limit(40);

        if (fetchError) throw fetchError;
        if (!pendingNews || pendingNews.length === 0) {
            log("No news to score – exiting");
            return new Response(JSON.stringify({message: "No news to score today."}), {
                headers: {"Content-Type": "application/json"}
            });
        }

        log(`Fetched ${pendingNews.length} unscored item(s)`);

        // 4. 构造发给 AI 的 System Prompt (结合了你的 topic 和 language)
        const systemPrompt = `
      You are an expert news editor for a bilingual news platform (Happened.info). 
      Your task is to score the importance of the provided news headlines from 1 to 100.
      
      SCORING RULES:
      1. Score the news strictly within its own 'topic' category. (A major tech news should get 90+ in TECHNOLOGY, even if it's not globally important).
      2. Evaluate the impact based on the 'language' audience ('zh' for Chinese readers, 'en' for English readers).
      3. Filter out clickbait or gossip (score them below 30).
      4. There are different titles in the description field, compare them with the existing title of each news item. If the description contains a more eye-catching title, replace the existing title with the new one.
      
      Return ONLY a JSON array of objects containing "id" and "score" (number).
    `;

        // 5. 组装最终的提示词并请求 Gemini
        log("Sending request to Gemini…");
        const aiStart = Date.now();
        const prompt = `${systemPrompt}\n\nDATA TO SCORE:\n${JSON.stringify(pendingNews)}`;
        log(`Prompt: ${prompt}`)
        const result = await model.generateContent(prompt);
        log(`Gemini responded in ${Date.now() - aiStart}ms`);

        // 6. 解析 AI 返回的 JSON 结果
        const responseText = result.response.text();
        const scoredItems = JSON.parse(responseText); // 形如: [{"id": "uuid-1", "score": 85}, ...]
        log(`Parsed ${scoredItems.length} scored item(s) from Gemini`);

        // 7. 批量更新分数回 Supabase 数据库
        const updates = scoredItems.map((item: any) => ({
            id: item.id,
            importance_score: item.score,
            updated_at: new Date().toISOString()
        }));

        log(`Writing scores to DB…`);
        const dbStart = Date.now();
        const {error: updateError} = await supabase
            .from('google_news_rss')
            .upsert(updates, {onConflict: 'id'});

        if (updateError) throw updateError;
        log(`DB updated in ${Date.now() - dbStart}ms`);

        // 8. 返回成功响应
        log(`✓ Done – ${updates.length} item(s) scored in ${Date.now() - start}ms`);
        return new Response(JSON.stringify({
            success: true,
            processedCount: updates.length
        }), {headers: {"Content-Type": "application/json"}});

    } catch (err: any) {
        error(`Scoring failed after ${Date.now() - start}ms`, err);
        return new Response(JSON.stringify({error: err.message}), {
            status: 500, headers: {"Content-Type": "application/json"}
        });
    }
})