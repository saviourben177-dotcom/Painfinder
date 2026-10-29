import type {
  DiscussionCandidate,
  DiscussionSourceConnector,
  SourceScan,
} from "./types";

const API_BASE = "https://hacker-news.firebaseio.com/v0";
const CACHE_TTL_MS = 60_000;

type HackerNewsItem = {
  id: number;
  type?: string;
  deleted?: boolean;
  dead?: boolean;
  title?: string;
  text?: string;
  time?: number;
  score?: number;
  descendants?: number;
};

type CachedStories = {
  expiresAt: number;
  stories: DiscussionCandidate[];
  partialFailures: number;
};

let cachedStories: CachedStories | undefined;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "PainRadar/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Hacker News API returned ${response.status}`);
  }
  return (await response.json()) as T;
}

function htmlToText(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, digits: string) => {
      const codePoint = Number(digits);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => {
      const codePoint = Number.parseInt(digits, 16);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : " ";
    })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);
}

async function fetchStoryLists(): Promise<number[]> {
  const [newIds, askIds] = await Promise.all([
    fetchJson<number[]>(`${API_BASE}/newstories.json`),
    fetchJson<number[]>(`${API_BASE}/askstories.json`),
  ]);
  const unique = new Set<number>();
  const ids: number[] = [];
  const perGroup = 50;
  for (let index = 0; index < perGroup; index += 1) {
    for (const id of [newIds[index], askIds[index]]) {
      if (typeof id === "number" && !unique.has(id)) {
        unique.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

async function loadRecentStories(): Promise<CachedStories> {
  if (cachedStories && cachedStories.expiresAt > Date.now()) {
    return cachedStories;
  }

  const ids = await fetchStoryLists();
  const stories: DiscussionCandidate[] = [];
  let nextIndex = 0;
  let partialFailures = 0;

  const worker = async () => {
    while (nextIndex < ids.length) {
      const index = nextIndex;
      nextIndex += 1;
      const id = ids[index];
      try {
        const item = await fetchJson<HackerNewsItem>(
          `${API_BASE}/item/${id}.json`,
        );
        if (
          item.type !== "story" ||
          item.deleted ||
          item.dead ||
          !item.title ||
          typeof item.time !== "number"
        ) {
          continue;
        }

        const title = htmlToText(item.title);
        const excerpt = htmlToText(item.text);
        if (!title) continue;

        stories.push({
          externalId: String(item.id),
          title,
          excerpt: excerpt || title,
          url: `https://news.ycombinator.com/item?id=${item.id}`,
          publishedAt: new Date(item.time * 1000),
          engagementCount:
            typeof item.descendants === "number"
              ? item.descendants
              : typeof item.score === "number"
                ? item.score
                : null,
        });
      } catch {
        partialFailures += 1;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(8, ids.length) }, () => worker()),
  );

  const result = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    stories,
    partialFailures,
  };
  cachedStories = result;
  return result;
}

class HackerNewsConnector implements DiscussionSourceConnector {
  readonly id = "hacker_news" as const;
  readonly displayName = "Hacker News";

  async scan(maxStories: number): Promise<SourceScan> {
    const snapshot = await loadRecentStories();
    const candidates = snapshot.stories.slice(0, maxStories);
    if (candidates.length === 0 && snapshot.partialFailures > 0) {
      throw new Error("Hacker News returned no readable stories");
    }
    return {
      checkedCount: candidates.length,
      candidates,
      partialFailures: snapshot.partialFailures,
    };
  }
}

export const hackerNewsConnector = new HackerNewsConnector();
