import { createSupabaseServiceClient } from "../_shared/supabaseClient.ts";
import type { GoogleNewsRss } from "../_shared/types.ts";

const supabase = createSupabaseServiceClient();

const GOOGLE_NEWS_HOST = "news.google.com";
const GOOGLE_BATCH_EXECUTE_URL =
  "https://news.google.com/_/DotsSplashUi/data/batchexecute";
const LINK_HREF_REGEX = /href="([^"]+)"/g;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_GOOGLE_LINKS_PER_INVOCATION = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const BATCH_DECODE_RETRY_DELAYS_MS = [3_000, 8_000, 15_000];
const GOOGLE_NEWS_PAGE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "max-age=0",
  "Sec-Ch-Ua":
    '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};
const GOOGLE_NEWS_BATCH_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Accept": "*/*",
  "Origin": "https://news.google.com",
  "Referer": "https://news.google.com/",
  "Sec-Ch-Ua":
    '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

type DecodeParams = {
  signature: string;
  timestamp: string;
  base64Str: string;
};

type BatchDecodeResult = {
  decodedMap: Map<string, string>;
  failedCount: number;
};

type DescriptionGoogleLinkEntry = {
  href: string;
  title: string;
  source: string;
};

function parseDecodedUrl(rawInner: string): string | null {
  try {
    const parsedInner = JSON.parse(rawInner) as unknown[];
    const decodedUrl = parsedInner?.[1];
    return typeof decodedUrl === "string" && decodedUrl.length > 0
      ? decodedUrl
      : null;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([\da-fA-F]+);/g, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

function stripTagsAndNormalize(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGoogleLinkEntriesFromDescription(
  html: string,
): DescriptionGoogleLinkEntry[] {
  const entries: DescriptionGoogleLinkEntry[] = [];
  const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

  for (const liMatch of html.matchAll(liRegex)) {
    const liHtml = liMatch[1] ?? "";
    const anchorMatch = liHtml.match(
      /<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!anchorMatch) continue;

    const href = anchorMatch[1] ?? "";
    if (!extractBase64Token(href)) continue;

    const title = stripTagsAndNormalize(anchorMatch[2] ?? "");
    const sourceMatch = liHtml.match(/<font\b[^>]*>([\s\S]*?)<\/font>/i);
    const source = stripTagsAndNormalize(sourceMatch?.[1] ?? "");

    entries.push({
      href,
      title: title || "unknown",
      source: source || "unknown",
    });
  }

  return entries;
}

function collectDecodedPayloads(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const payloads: string[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry)) continue;

    for (let i = 1; i < entry.length; i += 1) {
      const candidate = entry[i];
      if (typeof candidate === "string" && parseDecodedUrl(candidate)) {
        payloads.push(candidate);
        break;
      }
    }

    payloads.push(...collectDecodedPayloads(entry));
  }

  return payloads;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function humanDelay(): Promise<void> {
  return sleep(Math.floor(Math.random() * 500) + 200);
}

function getRetryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const retryAfterSeconds = Number(retryAfter);
    if (Number.isFinite(retryAfterSeconds)) return retryAfterSeconds * 1_000;

    const retryAfterDate = Date.parse(retryAfter);
    if (Number.isFinite(retryAfterDate)) {
      return Math.max(0, retryAfterDate - Date.now());
    }
  }

  return BATCH_DECODE_RETRY_DELAYS_MS[attempt - 1] ??
    BATCH_DECODE_RETRY_DELAYS_MS[BATCH_DECODE_RETRY_DELAYS_MS.length - 1];
}

async function cancelResponseBody(response: Response): Promise<void> {
  if (response.bodyUsed) return;

  try {
    await response.body?.cancel();
  } catch {
    // Best effort only. The response is already unusable for this decoder.
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function extractBase64Token(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    if (url.hostname !== GOOGLE_NEWS_HOST) return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;

    const parent = parts[parts.length - 2];
    if (parent !== "articles" && parent !== "read") return null;

    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

async function getDecodingParams(base64Str: string): Promise<DecodeParams> {
  const url = `https://news.google.com/rss/articles/${base64Str}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response: Response | undefined;
    try {
      response = await fetchWithTimeout(url, {
        headers: GOOGLE_NEWS_PAGE_HEADERS,
      });

      if (!response.ok) {
        const message = `Failed to fetch decoding params (${response.status})`;
        await cancelResponseBody(response);
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < 3) {
          lastError = new Error(`${message}; retrying`);
          await sleep(400 * attempt + Math.floor(Math.random() * 200));
          continue;
        }

        throw new Error(message);
      }

      const html = await response.text();
      const dataElementMatch = html.match(
        /<c-wiz\b[\s\S]*?<div\b(?=[^>]*\bjscontroller=)([^>]*)>/i,
      );
      const dataAttrs = dataElementMatch?.[1] ?? "";
      const signatureMatch = dataAttrs.match(/\bdata-n-a-sg="([^"]+)"/);
      const timestampMatch = dataAttrs.match(/\bdata-n-a-ts="([^"]+)"/);

      const signature = signatureMatch?.[1];
      const timestamp = timestampMatch?.[1];

      if (!signature || !timestamp) {
        throw new Error("Missing signature or timestamp in Google response");
      }

      return { signature, timestamp, base64Str };
    } catch (err) {
      lastError = err;
      if (response) await cancelResponseBody(response);
      if (attempt < 3) {
        await sleep(400 * attempt + Math.floor(Math.random() * 200));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function decodeGoogleNewsUrlsBatch(
  sourceUrls: string[],
  onError?: (msg: string, err?: unknown) => void,
): Promise<BatchDecodeResult> {
  const decodedMap = new Map<string, string>();
  let failedCount = 0;

  if (sourceUrls.length === 0) {
    return { decodedMap, failedCount };
  }

  const decodeRequests: Array<DecodeParams & { sourceUrl: string }> = [];

  for (const sourceUrl of sourceUrls) {
    const base64Str = extractBase64Token(sourceUrl);
    if (!base64Str) {
      failedCount += 1;
      onError?.(
        "Skipped non-google or invalid google link",
        new Error(sourceUrl),
      );
      continue;
    }

    try {
      await humanDelay();
      const params = await getDecodingParams(base64Str);
      decodeRequests.push({ sourceUrl, ...params });
    } catch (err) {
      failedCount += 1;
      onError?.("Failed to fetch decoding params", err);
    }
  }

  if (decodeRequests.length === 0) {
    return { decodedMap, failedCount };
  }

  for (const request of decodeRequests) {
    const payload = [
      "Fbv4je",
      `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${request.base64Str}",${request.timestamp},"${request.signature}"]`,
    ];
    const requestBody = `f.req=${encodeURIComponent(JSON.stringify([[payload]]))}`;

    let text = "";
    let lastDecodeError: unknown;

    for (
      let attempt = 1;
      attempt <= BATCH_DECODE_RETRY_DELAYS_MS.length + 1;
      attempt += 1
    ) {
      let response: Response | undefined;
      try {
        await humanDelay();
        response = await fetchWithTimeout(GOOGLE_BATCH_EXECUTE_URL, {
          method: "POST",
          headers: GOOGLE_NEWS_BATCH_HEADERS,
          body: requestBody,
        });

        if (!response.ok) {
          const retryable = RETRYABLE_STATUS_CODES.has(response.status);
          const delayMs = getRetryDelayMs(response, attempt);
          const err = new Error(
            `Failed to decode URL (${response.status})`,
          );
          await cancelResponseBody(response);

          if (
            retryable &&
            attempt <= BATCH_DECODE_RETRY_DELAYS_MS.length
          ) {
            lastDecodeError = err;
            onError?.(
              `Decode request rate limited for link; retrying in ${delayMs}ms`,
              err,
            );
            await sleep(delayMs + Math.floor(Math.random() * 500));
            continue;
          }

          throw err;
        }

        text = await response.text();
        break;
      } catch (err) {
        lastDecodeError = err;
        if (response) await cancelResponseBody(response);
        if (attempt <= BATCH_DECODE_RETRY_DELAYS_MS.length) {
          const delayMs = BATCH_DECODE_RETRY_DELAYS_MS[attempt - 1];
          await sleep(delayMs + Math.floor(Math.random() * 500));
          continue;
        }
      }
    }

    if (!text) {
      failedCount += 1;
      onError?.(`Decode request failed for link: ${request.sourceUrl}`, lastDecodeError);
      continue;
    }

    const splitParts = text.split("\n\n");
    const outerJson = splitParts.find((part, index) =>
      index > 0 && part.trim().startsWith("[")
    );
    if (!outerJson) {
      failedCount += 1;
      onError?.(`Unexpected batchexecute response format for link: ${request.sourceUrl}`);
      continue;
    }

    let parsedOuter: Array<unknown> = [];
    try {
      parsedOuter = JSON.parse(outerJson) as Array<unknown>;
    } catch (err) {
      failedCount += 1;
      onError?.(`Failed to parse batchexecute payload for link: ${request.sourceUrl}`, err);
      continue;
    }

    const rawInner = collectDecodedPayloads(parsedOuter).find((payload) =>
      parseDecodedUrl(payload)
    );
    const decodedUrl = rawInner ? parseDecodedUrl(rawInner) : null;

    if (!decodedUrl) {
      failedCount += 1;
      onError?.(`Decoded URL missing for link: ${request.sourceUrl}`);
      continue;
    }

    decodedMap.set(request.sourceUrl, decodedUrl);
  }

  return { decodedMap, failedCount };
}

function replaceGoogleLinksInDescription(
  html: string,
  decodedMap: Map<string, string>,
): { updatedHtml: string; totalGoogleLinks: number; successCount: number } {
  let totalGoogleLinks = 0;
  let successCount = 0;

  const updatedHtml = html.replace(LINK_HREF_REGEX, (full, href: string) => {
    const token = extractBase64Token(href);
    if (!token) return full;

    totalGoogleLinks += 1;
    const decoded = decodedMap.get(href);
    if (!decoded) return full;

    successCount += 1;
    return `href="${decoded}"`;
  });

  return { updatedHtml, totalGoogleLinks, successCount };
}

Deno.serve(async (_req: Request) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const start = Date.now();
  const log = (msg: string) => console.log(`[${requestId}] ${msg}`);
  const error = (msg: string, err?: unknown) =>
    console.error(
      `[${requestId}] ERROR: ${msg}${err ? ` - ${formatError(err)}` : ""}`,
    );

  try {
    log("Invocation started");

    log("Fetching rows that still need link decoding…");
    const { data: pendingNews, error: fetchError } = await supabase
      .from("google_news_rss")
      .select("id,description,links_decoded,pub_date")
      .or("links_decoded.is.null,links_decoded.eq.false")
      .gte(
        "pub_date",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .order("pub_date", { ascending: false })
      .limit(1)
      .returns<
        Pick<
          GoogleNewsRss,
          "id" | "description" | "links_decoded" | "pub_date"
        >[]
      >();

    if (fetchError) throw fetchError;

    if (!pendingNews || pendingNews.length === 0) {
      log("No rows to decode – exiting");
      return new Response(
        JSON.stringify({ success: true, processedCount: 0 }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    log(`Fetched ${pendingNews.length} row(s)`);

    let processedCount = 0;
    let decodedRowCount = 0;

    for (const row of pendingNews) {
      if (!row.description) {
        const { error: updateError } = await supabase
          .from("google_news_rss")
          .update({ links_decoded: true })
          .eq("id", row.id);

        if (updateError) {
          error(`Failed to update row ${row.id}`, updateError);
          continue;
        }

        processedCount += 1;
        decodedRowCount += 1;
        continue;
      }

      const googleLinkEntries = extractGoogleLinkEntriesFromDescription(
        row.description,
      );
      const googleLinks = googleLinkEntries.map((entry) => entry.href);
      const metadataByHref = new Map<string, DescriptionGoogleLinkEntry>();
      for (const entry of googleLinkEntries) {
        if (!metadataByHref.has(entry.href)) metadataByHref.set(entry.href, entry);
      }

      const uniqueGoogleLinks = [...new Set(googleLinks)].slice(
        0,
        MAX_GOOGLE_LINKS_PER_INVOCATION,
      );
      const { decodedMap, failedCount: failedGoogleLinks } =
        await decodeGoogleNewsUrlsBatch(
          uniqueGoogleLinks,
          (msg, err) => error(`Row ${row.id}: ${msg}`, err),
        );

      const { updatedHtml, totalGoogleLinks, successCount } =
        replaceGoogleLinksInDescription(
          row.description,
          decodedMap,
        );

      for (const [originalUrl, decodedUrl] of decodedMap.entries()) {
        const meta = metadataByHref.get(originalUrl);
        log(
          `Row ${row.id}: title=${meta?.title ?? "unknown"}, source=${meta?.source ?? "unknown"}, decoded_url=${decodedUrl}, original_url=${originalUrl}`,
        );
      }

      const allDecoded = totalGoogleLinks === successCount &&
        failedGoogleLinks === 0;

      const { error: updateError } = await supabase
        .from("google_news_rss")
        .update({
          description: updatedHtml,
          links_decoded: allDecoded,
        })
        .eq("id", row.id);

      if (updateError) {
        error(`Failed to update row ${row.id}`, updateError);
        continue;
      }

      processedCount += 1;
      if (allDecoded) decodedRowCount += 1;

      log(
        `Row ${row.id}: google_links=${totalGoogleLinks}, decoded=${successCount}, ` +
          `failed=${failedGoogleLinks}, links_decoded=${allDecoded}`,
      );
    }

    log(`Done in ${Date.now() - start}ms`);
    return new Response(
      JSON.stringify({
        success: true,
        processedCount,
        fullyDecodedRows: decodedRowCount,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    error(`decode-google-links failed after ${Date.now() - start}ms`, err);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
