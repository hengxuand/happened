import {serve} from "https://deno.land/std@0.177.0/http/server.ts";
import {parse} from "https://deno.land/x/xml@2.1.3/mod.ts";
import {createSupabaseServiceClient} from "shared/supabaseClient.ts";
import type {GoogleNewsRssInsert} from "shared/types.ts";

/* =======================
   Constants
======================= */

const RSS_URL = "https://news.google.com/rss/headlines/section/topic/";
const CN_RSS_URL_PATH = "?hl=zh-CN&gl=CN&ceid=CN:zh-Hans";
const EN_RSS_URL_PATH = "?hl=en-US&gl=US&ceid=US:en";

/* =======================
   Supabase
======================= */

const supabase = createSupabaseServiceClient();

/* =======================
   Edge Function
   ─────────────────────
   Called by a single cron job every minute.

   Each invocation:
     1. Atomically claims the most-overdue language/topic pair
        (claim_next_due_rss_topic sets last_run_at = NOW() so a
        second concurrent caller can never pick the same row).
     2. Fetches the Google News RSS feed for that pair.
     3. Upserts results into google_news_rss.
     4. Exits.

   No sleep, no queue, no lock table – sequential by design
   because only one topic is processed per invocation.
======================= */

serve(async (req) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const start = Date.now();

    const log = (msg: string) => console.log(`[${requestId}] ${msg}`);
    const error = (msg: string, err?: unknown) =>
        console.error(`[${requestId}] ERROR: ${msg}`, err);

    if (req.method !== "POST") {
        return new Response("Only POST allowed", {status: 405});
    }

    log("Invocation started");

    // ── Step 1: Atomically claim the most-overdue topic ───────────────────────
    const {data: claimed, error: claimErr} = await supabase.rpc(
        "claim_next_due_rss_topic",
    );

    if (claimErr) {
        error("Failed to claim next topic", claimErr);
        return new Response("Failed to claim next topic", {status: 500});
    }

    if (!claimed || (claimed as unknown[]).length === 0) {
        log(`Nothing due right now – exiting in ${Date.now() - start}ms`);
        return new Response("Nothing to process", {status: 200});
    }

    type ClaimedTopic = { schedule_id: number; schedule_language: string; schedule_topic: string };
    const {schedule_id, schedule_language: language, schedule_topic: topic} =
        (claimed as ClaimedTopic[])[0];

    log(`Claimed: ${language}/${topic} (schedule #${schedule_id})`);

    // ── Step 2: Fetch + save ──────────────────────────────────────────────────
    // last_run_at is already stamped to NOW() by the SQL claim above.
    // On failure we simply leave last_run_at as-is; the topic will be
    // retried naturally once its interval elapses again.
    try {
        await processTopic(language as "en" | "zh", topic, log);
        log(`✓ Completed ${language}/${topic} in ${Date.now() - start}ms`);
        return new Response("OK", {status: 200});
    } catch (err) {
        error(`✗ Failed ${language}/${topic} after ${Date.now() - start}ms`, err);
        return new Response("Processing failed", {status: 500});
    }
});

/* =======================
   Core Logic
======================= */

async function processTopic(
    language: "en" | "zh",
    topic: string,
    log: (msg: string) => void,
) {
    const tag = `${language}/${topic}`;
    const url =
        language === "zh"
            ? `${RSS_URL}${topic}${CN_RSS_URL_PATH}`
            : `${RSS_URL}${topic}${EN_RSS_URL_PATH}`;

    // ── Fetch ──────────────────────────────────────────────────────────────────
    log(`[${tag}] Fetching RSS…`);
    const fetchStart = Date.now();
    const xml = await fetchRssXml(url);
    log(`[${tag}] Fetched ${xml.length} bytes in ${Date.now() - fetchStart}ms`);

    // ── Parse ─────────────────────────────────────────────────────────────────
    const parsed = parseGoogleNewsRss(xml);
    log(`[${tag}] Parsed ${parsed.length} item(s)`);

    if (!parsed.length) {
        log(`[${tag}] No items in feed, skipping DB write`);
        return;
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    const dbStart = Date.now();
    await insertGoogleNewsRssItems(topic, language, parsed, log);
    log(`[${tag}] DB write done in ${Date.now() - dbStart}ms`);
}

/* =======================
   RSS Fetch
======================= */

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function fetchRssXml(url: string): Promise<string> {
    let lastStatus = 0;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
            // Exponential backoff: 500ms, 1000ms, 2000ms
            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, delay));
        }

        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                Accept: "application/rss+xml, application/xml",
            },
        });

        if (res.ok) {
            return await res.text();
        }

        lastStatus = res.status;

        if (!RETRYABLE_STATUSES.has(res.status)) {
            // Non-transient error – fail immediately
            throw new Error(`RSS fetch failed: ${res.status}`);
        }

        // Transient error – consume body to free the connection before retrying
        await res.text().catch(() => {});
    }

    throw new Error(`RSS fetch failed after ${MAX_RETRIES} retries: ${lastStatus}`);
}

/* =======================
   DB Insert
======================= */


async function insertGoogleNewsRssItems(
    topic: string,
    language: string,
    items: ReturnType<typeof parseGoogleNewsRss>,
    log: (msg: string) => void,
) {
    const rows = items.map((i) => ({
        topic,
        language,
        title: i.title || "",
        source: i.source || "",
        pub_date: i.pub_date || new Date().toISOString(),
        guid: i.guid,
        description: i.google_rss_description,
    } satisfies GoogleNewsRssInsert));

    log(`Processing ${rows.length} item(s)…`);

    // INSERT ... ON CONFLICT (guid) DO NOTHING
    // – new rows are inserted, existing guids are silently skipped.
    // .select() uses RETURNING under the hood, which with DO NOTHING only
    // returns the rows that were actually inserted (not the skipped ones).
    // Requires a UNIQUE constraint on the guid column.
    const {data: inserted, error} = await supabase
        .from("google_news_rss")
        .upsert(rows, {onConflict: "guid", ignoreDuplicates: true})
        .select("guid");

    if (error) throw new Error(`DB upsert failed: ${error.message}`);

    const insertedCount = inserted?.length ?? 0;
    const skippedCount = rows.length - insertedCount;
    log(`DB: ${insertedCount} inserted, ${skippedCount} duplicate(s) ignored`);
}

/* =======================
   RSS Parsing
======================= */

function parseGoogleNewsRss(xml: string) {
    const doc = parse(xml);
    const channel = (doc as { rss?: { channel?: { item?: unknown } } })?.rss
        ?.channel;
    const items = Array.isArray(channel?.item) ? channel.item : [];

    return items.map((item: unknown) => {
        const i = item as Record<string, unknown>;
        return {
            guid: extractGuid(i.guid),
            title: extractTitle(i.title),
            source: extractSource(i.source, extractText(i.description)),
            pub_date: parseRssDate(i.pubDate),
            google_rss_description: extractRssDescription(i.description),
        };
    });
}

/* =======================
   Helpers
======================= */

function extractGuid(node: unknown): string {
    if (!node) return crypto.randomUUID();
    if (typeof node === "string") return node;
    const n = node as Record<string, unknown>;
    if (typeof n["#text"] === "string") return n["#text"];
    return crypto.randomUUID();
}

function extractText(node: unknown): string | null {
    if (!node) return null;
    if (typeof node === "string") return node;
    const n = node as Record<string, unknown>;
    if (typeof n._text === "string") return n._text;
    if (typeof n["#text"] === "string") return n["#text"];
    return null;
}

function extractTitle(node: unknown): string | null {
    const title = extractText(node);
    if (!title) return null;
    const idx = title.lastIndexOf("-");
    return idx === -1 ? title : title.slice(0, idx).trim();
}

function extractSource(sourceNode: unknown, description: string | null) {
    if (typeof sourceNode === "string") return sourceNode;
    const s = sourceNode as Record<string, unknown> | null;
    if (s?._text) return s._text as string;
    if (description) {
        const match = description.match(/<font[^>]*>(.*?)<\/font>/i);
        if (match) return match[1];
    }
    return null;
}

function parseRssDate(node: unknown): string | null {
    const text = extractText(node);
    if (!text) return null;
    const date = new Date(text);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
}

function extractRssDescription(node: unknown) {    const text = extractText(node);
    if (!text) return null;
    if (!text.includes("<strong")) return text;
    return text.replaceAll(/<strong\b[^>]*>[\s\S]*?<\/strong>/gi, "");
}

