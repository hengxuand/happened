import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { parse } from "https://deno.land/x/xml@2.1.3/mod.ts";
import { createSupabaseServiceClient } from "shared/supabaseClient.ts";

/* =======================
   Constants
======================= */

const RSS_URL = "https://news.google.com/rss/headlines/section/topic/";

const CN_RSS_URL_PATH = "?hl=zh-CN&gl=CN&ceid=CN:zh-Hans";
const EN_RSS_URL_PATH = "?hl=en-US&gl=US&ceid=US:en";

// const CATEGORY_MAP_ZH: Record<string, string> = {
//   WORLD: "世界",
//   NATION: "国家",
//   BUSINESS: "商业",
//   TECHNOLOGY: "科技",
//   ENTERTAINMENT: "娱乐",
//   SCIENCE: "科学",
//   SPORTS: "体育",
//   HEALTH: "健康",
// };

/* =======================
   Supabase
======================= */

const supabase = createSupabaseServiceClient();

/* =======================
   Edge Function
======================= */

serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const start = Date.now();

  const log = (msg: string) => {
    console.log(`[${requestId}] ${msg}`);
  };

  const error = (msg: string, err?: unknown) => {
    console.error(`[${requestId}] ERROR: ${msg}`, err);
  };

  if (req.method !== "POST") {
    return new Response("Only POST allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { language, topic } = body;

  if (!language || !topic) {
    error("Missing required parameters: language, topic");
    return new Response("Missing required parameters: language, topic", { status: 400 });
  }

  if (language !== "en" && language !== "zh") {
    error("Invalid language: " + language);
    return new Response("Invalid language", { status: 400 });
  }

  log(`Request accepted: ${language}/${topic}`);

  EdgeRuntime.waitUntil(
    processTopic(language, topic, { log, error }),
  );

  log(`Response returned (${Date.now() - start}ms)`);

  return new Response("Accepted", { status: 202 });
});

/* =======================
   Core Logic
======================= */

async function processTopic(
  language: "en" | "zh",
  topic: string,
  ctx: {
    log: (msg: string) => void;
    error: (msg: string, err?: unknown) => void;
  },
) {
  const { log, error } = ctx;
  const start = Date.now();

  try {
    log(`Processing ${language}/${topic}`);

    const url =
      language === "zh"
        ? `${RSS_URL}${topic}${CN_RSS_URL_PATH}`
        : `${RSS_URL}${topic}${EN_RSS_URL_PATH}`;

    log(`Fetching RSS from: ${url}`);

    const fetchStart = Date.now();
    const xml = await fetchRssXml(url);
    log(`RSS fetched: ${xml.length} bytes (${Date.now() - fetchStart}ms)`);

    const parseStart = Date.now();
    const parsed = parseGoogleNewsRss(xml);
    log(`RSS parsed: ${parsed.length} items (${Date.now() - parseStart}ms)`);

    if (!parsed.length) {
      log("No items found, exiting");
      return;
    }

    log(`Inserting ${parsed.length} items into database`);
    const insertStart = Date.now();
    await insertGoogleNewsRssItems(topic, language, parsed, log);
    log(`Items processed: ${parsed.length} (${Date.now() - insertStart}ms)`);

    log(`Total time: ${Date.now() - start}ms`);
  } catch (err) {
    error("Processing failed", err);
  }
}

/* =======================
   RSS Fetch
======================= */

async function fetchRssXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/rss+xml, application/xml",
    },
  });

  if (!res.ok) {
    throw new Error(`RSS fetch failed: ${res.status}`);
  }

  return await res.text();
}

/* =======================
   DB Insert
======================= */

type GoogleNewsRssInsert = {
  topic: string;
  language: string;
  title: string;
  source: string;
  pub_date: string;
  guid: string;
  link?: string | null;
  description?: string | null;
};

async function insertGoogleNewsRssItems(
  topic: string,
  language: string,
  items: any[],
  log: (msg: string) => void,
) {
  let updatedCount = 0;
  let skippedCount = 0;
  let insertedCount = 0;

  for (const item of items) {
    const rssItem: GoogleNewsRssInsert = {
      topic,
      language,
      title: item.title || '',
      source: item.source || '',
      pub_date: item.pub_date || new Date().toISOString(),
      guid: item.guid,
      link: item.google_link,
      description: item.google_rss_description,
    };

    // Check if item with same guid exists
    const { data: existingByGuid } = await supabase
      .from('google_news_rss')
      .select('id')
      .eq('guid', rssItem.guid)
      .single();

    if (existingByGuid) {
      // Update title if guid exists
      await supabase
        .from('google_news_rss')
        .update({ title: rssItem.title })
        .eq('guid', rssItem.guid);
      updatedCount++;
      continue;
    }

    // Check if item with same title exists
    const { data: existingByTitle } = await supabase
      .from('google_news_rss')
      .select('id')
      .eq('title', rssItem.title)
      .single();

    if (existingByTitle) {
      // Do nothing if title exists
      skippedCount++;
      continue;
    }

    // Insert new record if neither guid nor title exists
    await supabase
      .from('google_news_rss')
      .insert(rssItem);
    insertedCount++;
  }

  log(`DB: ${updatedCount} updated, ${skippedCount} skipped, ${insertedCount} inserted`);
}

/* =======================
   RSS Parsing
======================= */

function parseGoogleNewsRss(xml: string) {
  const doc = parse(xml);
  const channel = doc?.rss?.channel;
  const items = Array.isArray(channel?.item) ? channel.item : [];

  return items.map((item: any) => ({
    guid: extractGuid(item.guid),
    title: extractTitle(item.title),
    source: extractSource(
      item.source,
      extractText(item.description),
    ),
    google_link: extractText(item.link),
    pub_date: extractText(item.pubDate),
    google_rss_description: extractRssDescription(item.description),
  }));
}

/* =======================
   Helpers
======================= */

function extractGuid(node: any): string {
  if (!node) return crypto.randomUUID();
  if (typeof node === "string") return node;
  if (typeof node?.["#text"] === "string") return node["#text"];
  return crypto.randomUUID();
}

function extractText(node: any): string | null {
  if (!node) return null;
  if (typeof node === "string") return node;
  if (typeof node?._text === "string") return node._text;
  if (typeof node?.["#text"] === "string") return node["#text"];
  return null;
}

function extractTitle(node: any): string | null {
  const title = extractText(node);
  if (!title) return null;
  const idx = title.lastIndexOf("-");
  return idx === -1 ? title : title.slice(0, idx).trim();
}

function extractSource(
  sourceNode: any,
  description: string | null,
) {
  if (typeof sourceNode === "string") return sourceNode;
  if (sourceNode?._text) return sourceNode._text;

  if (description) {
    const match = description.match(
      /<font[^>]*>(.*?)<\/font>/i,
    );
    if (match) return match[1];
  }

  return null;
}

function extractRssDescription(node: any) {
  let text = extractText(node);
  if (!text) return null;
  if (!text.includes("<strong")) return text;
  return text.replaceAll(
    /<strong\b[^>]*>[\s\S]*?<\/strong>/gi,
    "",
  );
}
