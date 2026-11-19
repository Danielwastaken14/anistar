import { NextRequest, NextResponse } from "next/server";
import { anilistQuery } from "@/lib/anilist";
import { getScreenshotSeries, screenshotRelationFields, type ScreenshotFranchiseAnime } from "@/lib/screenshot-franchise";

type Episode = { title: string | null; thumbnail: string | null; site: string | null };
type Anime = ScreenshotFranchiseAnime & {
  streamingEpisodes: (Episode | null)[] | null;
  startDate: { year: number | null } | null;
  genres: string[] | null;
};
type QueryData = Record<string, { media: (Anime | null)[] } | undefined>;
type Candidate = { id: number; seriesId: number; seriesAliases: string[]; title: string; aliases: string[]; year: number | null; genres: string[]; screenshots: string[] };

const CACHE_MS = 60 * 60 * 1000;
let cachedPool: { entries: Candidate[]; expires: number } | null = null;
let inFlight: Promise<Candidate[]> | null = null;

// Search a wider range of anime using three moderate-sized GraphQL requests.
// Two batches contain 200 non-adult anime, while the final batch explicitly
// includes up to 50 adult-rated anime. Entries without episode images are skipped.
// Keeping the requests separate avoids one extremely large GraphQL response.
const MEDIA_FIELDS = `
  ${screenshotRelationFields(4)}
  startDate { year }
  genres
  streamingEpisodes { title thumbnail site }
`;

function makePoolQuery(pages: number[], adult: boolean): string {
  const queries = pages.map((page, index) => `
    group${index}: Page(page: ${page}, perPage: 25) {
      media(type: ANIME, isAdult: ${adult}, sort: POPULARITY_DESC) {
        ${MEDIA_FIELDS}
      }
    }
  `).join("\n");

  return `query ScreenshotGuesserPool { ${queries} }`;
}

const POOL_QUERIES = [
  makePoolQuery([1, 2, 3, 4], false),
  makePoolQuery([5, 6, 7, 8], false),
  makePoolQuery([1, 2], true),
];

function validImageUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function buildPool(data: QueryData): Candidate[] {
  const unique = new Map<number, Candidate>();
  const all = Object.values(data).flatMap((page) => page?.media ?? []);
  for (const anime of all) {
    if (!anime || unique.has(anime.id)) continue;
    const aliases = Array.from(new Set([anime.title.english, anime.title.romaji, anime.title.userPreferred]
      .filter((title): title is string => Boolean(title?.trim()))));
    const screenshots = Array.from(new Set((anime.streamingEpisodes ?? [])
      .map((episode) => episode?.thumbnail)
      .filter(validImageUrl)));
    if (!aliases.length || screenshots.length < 2) continue;
    const series = getScreenshotSeries(anime);
    unique.set(anime.id, {
      id: anime.id,
      seriesId: series.id,
      seriesAliases: series.aliases,
      title: anime.title.english || anime.title.romaji || anime.title.userPreferred || "Unknown anime",
      aliases,
      year: anime.startDate?.year ?? null,
      genres: anime.genres ?? [],
      screenshots,
    });
  }
  return [...unique.values()];
}

async function getPool(): Promise<Candidate[]> {
  if (cachedPool && cachedPool.expires > Date.now()) return cachedPool.entries;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const unique = new Map<number, Candidate>();
    let lastError: unknown = null;

    // Sequential requests are gentler on AniList than concurrent large queries.
    for (const query of POOL_QUERIES) {
      try {
        const data = await anilistQuery<QueryData>(null, query);
        for (const entry of buildPool(data)) unique.set(entry.id, entry);
      } catch (error) {
        lastError = error;
        console.error("Screenshot pool batch failed:", error);
        // Stop on rate limiting rather than issuing more requests.
        if (error instanceof Error && error.message.includes("429")) break;
      }
    }

    const entries = [...unique.values()];
    if (entries.length) {
      cachedPool = { entries, expires: Date.now() + CACHE_MS };
      return entries;
    }
    if (lastError) throw lastError;
    return [];
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const pool = await getPool();
    if (!pool.length) {
      return NextResponse.json(
        { error: "No episode screenshots are available right now. Please try again later." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Exclude a small list of recently played anime, when possible.
    const recentIds = new Set((request.nextUrl.searchParams.get("exclude") || "")
      .split(",").slice(0, 20).map(Number).filter(Number.isInteger));
    const available = pool.filter((anime) => !recentIds.has(anime.id));
    const choices = available.length ? available : pool;
    // Every eligible title has an equal chance, including anime with fewer
    // than six episode thumbnails. Screenshot navigation handles short lists.
    const chosen = choices[Math.floor(Math.random() * choices.length)];
    const screenshots = [...chosen.screenshots];
    // Fisher-Yates shuffle so each round shows screenshots in random order.
    for (let i = screenshots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [screenshots[i], screenshots[j]] = [screenshots[j], screenshots[i]];
    }

    return NextResponse.json({
      question: {
        id: chosen.id,
        seriesId: chosen.seriesId,
        seriesAliases: chosen.seriesAliases,
        title: chosen.title,
        aliases: chosen.aliases,
        year: chosen.year,
        genres: chosen.genres,
        screenshot: screenshots[0],
        screenshots: screenshots.slice(0, 6),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Screenshot round error:", message);
    const rateLimited = message.includes("AniList HTTP error: 429");
    return NextResponse.json(
      { error: rateLimited ? "AniList is rate-limiting requests. Please try again in a minute." : "Unable to load a screenshot round." },
      { status: rateLimited ? 429 : 502, headers: { "Cache-Control": "no-store", ...(rateLimited ? { "Retry-After": "60" } : {}) } }
    );
  }
}
