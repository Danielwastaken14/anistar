import { NextRequest, NextResponse } from "next/server";
import { anilistQuery } from "@/lib/anilist";
import { getScreenshotSeriesId, screenshotRelationFields, type ScreenshotFranchiseAnime } from "@/lib/screenshot-franchise";

type Anime = ScreenshotFranchiseAnime & {
  coverImage: { medium: string | null } | null;
};
type SearchData = { Page: { media: (Anime | null)[] } };
type Suggestion = { id: number; seriesId: number; label: string; image: string | null };

const QUERY = `
  query ScreenshotAnimeSearch($search: String!) {
    Page(page: 1, perPage: 8) {
      media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
        ${screenshotRelationFields(4)}
        coverImage { medium }
      }
    }
  }
`;

const cache = new Map<string, { expires: number; results: Suggestion[] }>();
const CACHE_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  if (query.length < 3) return NextResponse.json({ results: [] });
  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ results: cached.results });
  }

  try {
    const data = await anilistQuery<SearchData>(null, QUERY, { search: query });
    const results = (data.Page?.media ?? []).filter((anime): anime is Anime => anime !== null)
      .map((anime) => ({
        id: anime.id,
        seriesId: getScreenshotSeriesId(anime),
        label: anime.title.english || anime.title.romaji || anime.title.userPreferred || "Unknown anime",
        image: anime.coverImage?.medium ?? null,
      }));
    if (cache.size >= 300) cache.clear();
    cache.set(key, { expires: Date.now() + CACHE_MS, results });
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Screenshot search error:", message);
    const rateLimited = message.includes("AniList HTTP error: 429");
    return NextResponse.json(
      { error: rateLimited ? "Search is temporarily rate-limited." : "Search is unavailable." },
      { status: rateLimited ? 429 : 502, headers: rateLimited ? { "Retry-After": "60" } : {} }
    );
  }
}
