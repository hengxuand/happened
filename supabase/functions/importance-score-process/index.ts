import {serve} from "https://deno.land/std@0.168.0/http/server.ts"
import {createSupabaseServiceClient} from "../_shared/supabaseClient.ts";
import {createGeminiModel} from "../_shared/geminiClient.ts";
import type {GoogleNewsRss} from "../_shared/types.ts";


const supabase = createSupabaseServiceClient();
const model = createGeminiModel();

serve(async (_req: Request) => {
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
            .order('pub_date', {ascending: false})
            .limit(40)
            .returns<GoogleNewsRss[]>();

        if (fetchError) throw fetchError;
        if (!pendingNews || pendingNews.length === 0) {
            log("No news to score – exiting");
            return new Response(JSON.stringify({message: "No news to score today."}), {
                headers: {"Content-Type": "application/json"}
            });
        }

        log(`Fetched ${pendingNews.length} unscored item(s)`);

        const systemPrompt = `
      You are an expert news editor for a bilingual news platform (Happened.info). 
      Your task is to score the importance of the provided news headlines from 1 to 100.
      
      SCORING RULES:
      1. Score the news strictly within its own 'topic' category. (A major tech news should get 90+ in TECHNOLOGY, even if it's not globally important).
      2. Consider the source's credibility and influence in its field (e.g., a well-known tech blog vs. a small personal blog).
      3. Evaluate the impact based on the 'language' audience ('zh' for Chinese readers, 'en' for English readers).
      4. Filter out clickbait or gossip (score them below 30).
      
      Actions must be performed in the following order:
      1. There are different titles in the description field, compare them with the existing title of each news item. If the description contains a more eye-catching title, replace the existing title with the new one and the source as well. If not, keep the original title and source.
      2. Score the news based on the above rules.
      
      Forbid the following actions:
      1. Don't perform any translation at any place(Keep the original language).
      
      Return ONLY a JSON array of objects in the same format as the input data. set the importance_score field with the score you give, and if you change the title, also update the title field and the source field.
    `;

        log("Sending request to Gemini…");
        const aiStart = Date.now();
        const prompt = `${systemPrompt}\n\nDATA TO SCORE:\n${JSON.stringify(pendingNews)}`;

        const result = await model.generateContent(prompt);
        log(`Gemini responded in ${Date.now() - aiStart}ms`);

        const responseText: string = result.response.text();
        const scoredItems = JSON.parse(responseText) as GoogleNewsRss[];
        log(`Parsed ${scoredItems.length} scored item(s) from Gemini`);

        const newsMap = new Map<string, GoogleNewsRss>(
            (pendingNews as GoogleNewsRss[]).map(n => [n.id, n])
        );
        const updates: GoogleNewsRss[] = scoredItems
            .map((item: GoogleNewsRss): GoogleNewsRss | null => {
                const row: GoogleNewsRss | undefined = newsMap.get(item.id);
                if (!row) {
                    log(`  [skip] id=${item.id} – not found in original batch`);
                    return null;
                }

                const titleChanged: boolean = item.title !== row.title;
                const sourceChanged: boolean = item.source !== row.source;
                log(
                    `  [score] id=${item.id} score=${item.importance_score}` +
                    (titleChanged ? ` | title: "${row.title}" → "${item.title}"` : '') +
                    (sourceChanged ? ` | source: "${row.source}" → "${item.source}"` : '')
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

        log(`Writing ${updates.length} score(s) to DB…`);
        const dbStart = Date.now();
        const {error: updateError} = await supabase
            .from('google_news_rss')
            .upsert(updates, {onConflict: 'id'});

        if (updateError) throw updateError;
        log(`DB updated in ${Date.now() - dbStart}ms`);

        log(`✓ Done – ${updates.length} item(s) scored in ${Date.now() - start}ms`);
        return new Response(JSON.stringify({
            success: true,
            processedCount: updates.length
        }), {headers: {"Content-Type": "application/json"}});

    } catch (err: unknown) {
        const message: string = err instanceof Error ? err.message : String(err);
        error(`Scoring failed after ${Date.now() - start}ms`, err);
        return new Response(JSON.stringify({error: message}), {
            status: 500, headers: {"Content-Type": "application/json"}
        });
    }
})