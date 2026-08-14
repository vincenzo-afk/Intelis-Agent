import type { SourceCandidate } from "./contracts";

type TaskSourceConfig = {
  naturalLanguageRequest: string;
  sources: string[];
  keywords: string[];
  topics: string[];
  sourceFilters: { include?: string[]; exclude?: string[] };
};

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function nodeValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function parseDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp);
}

export function isSafePublicHttpUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (host === "localhost" || host === "::1" || host.endsWith(".localhost") || host === "metadata.google.internal") return false;
    if (/^(127\.|0\.0\.0\.0$|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function parseRss(xml: string, sourceName: string): SourceCandidate[] {
  return xml
    .split(/<item[\s>]/i)
    .slice(1)
    .map(item => {
      const title = nodeValue(item, "title");
      const url = nodeValue(item, "link");
      const text = nodeValue(item, "description") || nodeValue(item, "content:encoded");
      return {
        title: title || "Untitled RSS item",
        url,
        sourceName,
        text,
        publishedAt: parseDate(nodeValue(item, "pubDate")),
      };
    })
    .filter(item => item.url && item.text);
}

async function fetchText(url: string) {
  if (!isSafePublicHttpUrl(url)) throw new Error("Only public HTTP(S) source URLs are permitted");
  const response = await fetch(url, {
    headers: { "User-Agent": "Intelis-Agent/1.0 (responsible research monitoring)" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Source request failed (${response.status})`);
  return response.text();
}

async function collectWebSearch(query: string, limit: number) {
  const endpoint = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  endpoint.searchParams.set("query", query.slice(0, 512));
  endpoint.searchParams.set("mode", "artlist");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("maxrecords", String(Math.min(limit, 25)));
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Web discovery request failed (${response.status})`);
  const payload = (await response.json()) as {
    articles?: Array<{ title?: string; url?: string; domain?: string; seendate?: string }>;
  };
  const candidates = (payload.articles ?? [])
    .filter(article => Boolean(article.title && article.url && isSafePublicHttpUrl(article.url)))
    .slice(0, limit) as Array<{ title: string; url: string; domain?: string; seendate?: string }>;
  const materialized = await Promise.allSettled(candidates.map(async article => {
    const html = await fetchText(article.url);
    return {
      title: article.title,
      url: article.url,
      sourceName: article.domain || new URL(article.url).hostname,
      text: decodeHtml(html).slice(0, 15000),
      publishedAt: parseDate(article.seendate || ""),
    } satisfies SourceCandidate;
  }));
  return materialized.flatMap(result => result.status === "fulfilled" && result.value.text.length > 80 ? [result.value] : []);
}

async function collectRss(urls: string[]) {
  const items = await Promise.allSettled(
    urls.map(async url => parseRss(await fetchText(url), new URL(url).hostname))
  );
  return items.flatMap(item => (item.status === "fulfilled" ? item.value : []));
}

async function collectDirectPages(urls: string[]) {
  const items = await Promise.allSettled(
    urls.map(async url => {
      const html = await fetchText(url);
      const title = nodeValue(html, "title") || new URL(url).hostname;
      return {
        title,
        url,
        sourceName: new URL(url).hostname,
        text: decodeHtml(html).slice(0, 15000),
      } satisfies SourceCandidate;
    })
  );
  return items.flatMap(item => (item.status === "fulfilled" ? [item.value] : []));
}

async function collectNewsApi(query: string) {
  if (!process.env.NEWS_API_KEY) return [];
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", query);
  url.searchParams.set("pageSize", "20");
  url.searchParams.set("sortBy", "publishedAt");
  const response = await fetch(url, { headers: { "X-Api-Key": process.env.NEWS_API_KEY } });
  if (!response.ok) throw new Error(`News API request failed (${response.status})`);
  const payload = (await response.json()) as {
    articles?: Array<{ title?: string; url?: string; description?: string; content?: string; source?: { name?: string }; publishedAt?: string }>;
  };
  return (payload.articles ?? [])
    .filter(article => article.title && article.url && (article.content || article.description))
    .map(article => ({
      title: article.title!,
      url: article.url!,
      sourceName: article.source?.name || new URL(article.url!).hostname,
      text: article.content || article.description || "",
      publishedAt: parseDate(article.publishedAt || ""),
    }));
}

export async function crawlSourceCandidates(candidates: SourceCandidate[]) {
  const crawlResults = await Promise.allSettled(candidates.map(async candidate => {
    if (!isSafePublicHttpUrl(candidate.url)) return null;
    const response = await fetch(candidate.url, {
      method: "GET",
      headers: {
        "User-Agent": "Intelis-Agent/1.0 (responsible research monitoring)",
        Range: "bytes=0-1024",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok ? candidate : null;
  }));
  return crawlResults.flatMap(result => result.status === "fulfilled" && result.value ? [result.value] : []);
}

export async function collectSourceCandidates(task: TaskSourceConfig, limit: number) {
  const includeUrls = (task.sourceFilters.include ?? []).filter(isSafePublicHttpUrl);
  const excluded = new Set(task.sourceFilters.exclude ?? []);
  const query = [...task.keywords, ...task.topics, task.naturalLanguageRequest.slice(0, 250)].filter(Boolean).join(" OR ") || "technology";
  const sources = new Set(task.sources);
  const jobs: Promise<SourceCandidate[]>[] = [];
  if (sources.has("rss")) jobs.push(collectRss(includeUrls));
  if (sources.has("web")) jobs.push(collectWebSearch(query, Math.min(limit, 10)), collectDirectPages(includeUrls));
  if (sources.has("news_api")) jobs.push(collectNewsApi(query));
  const results = await Promise.allSettled(jobs);
  return results
    .flatMap(result => (result.status === "fulfilled" ? result.value : []))
    .filter(item => !Array.from(excluded).some(domain => item.url.includes(domain)))
    .slice(0, limit);
}
