import {
  getAnimeTitle,
  getCanonicalAnime,
  type FranchiseMedia,
} from "@/lib/anime-franchise";
import { NextResponse } from "next/server";
import { anilistQuery } from "@/lib/anilist";

type SearchAnime = FranchiseMedia & {
  coverImage: { medium: string } | null;
};

type SearchResult = {
  Page: {
    characters?: Array<{
      id: number;
      name: { full: string };
      image: { large: string };
    }>;
    media?: Array<{
      id: number;
      title: {
        romaji: string | null;
        english: string | null;
        userPreferred: string | null;
      };
      coverImage: { medium: string } | null;
    }>;
  };
};

type AutocompleteResult = {
  id: number;
  label: string;
  image: string | null;
};

// Cache successful searches for five minutes.
// This cache is per server process, which is sufficient for local development.
const CACHE_TTL = 5 * 60 * 1000;

const searchCache = new Map<
  string,
  { results: AutocompleteResult[]; expiresAt: number }
>();

function getCachedResults(key: string) {
  const cached = searchCache.get(key);

  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(key);
    return null;
  }

  return cached.results;
}

function cacheResults(key: string, results: AutocompleteResult[]) {
  searchCache.set(key, {
    results,
    expiresAt: Date.now() + CACHE_TTL,
  });

  // Keep the cache from growing indefinitely.
  if (searchCache.size > 300) {
    const now = Date.now();

    for (const [cacheKey, value] of searchCache) {
      if (value.expiresAt <= now) {
        searchCache.delete(cacheKey);
      }
    }

    while (searchCache.size > 300) {
      const oldestKey = searchCache.keys().next().value;
      if (oldestKey === undefined) break;
      searchCache.delete(oldestKey);
    }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const type = searchParams.get("type");

  if (type !== "character" && type !== "anime") {
    return NextResponse.json(
      { error: "Invalid search type." },
      { status: 400 }
    );
  }

  if (q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = `${type}:${q.toLocaleLowerCase()}`;
  const cached = getCachedResults(cacheKey);

  if (cached) {
    return NextResponse.json({ results: cached });
  }

  try {
    let results: AutocompleteResult[];

    
if (type === "character") {
  const data = await anilistQuery<SearchResult>(
    null,
    `
      query CharacterSearch($search: String!) {
        Page(page: 1, perPage: 8) {
          characters(search: $search, sort: FAVOURITES_DESC) {
            id
            name {
              full
            }
            image {
              large
            }
          }
        }
      }
    `,
    { search: q }
  );

  results = (data.Page.characters ?? []).map((character) => ({
    id: character.id,
    label: character.name.full,
    image: character.image.large ?? null,
  }));
}
 else {
      const data = await anilistQuery<SearchResult>(
        null,
        `
          query AnimeSearch($search: String!) {
            Page(page: 1, perPage: 8) {
              media(
                search: $search
                type: ANIME
                sort: POPULARITY_DESC
              ) {
                id
                title {
                  romaji
                  english
                  userPreferred
                }
                coverImage {
                  medium
                }
              }
            }
          }
        `,
        { search: q }
      );

      results = (data.Page.media ?? []).map((anime) => ({
        id: anime.id,
        label:
          anime.title.english ||
          anime.title.romaji ||
          anime.title.userPreferred ||
          "Unknown anime",
        image: anime.coverImage?.medium ?? null,
      }));
    }

    cacheResults(cacheKey, results);

    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "private, max-age=30" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    console.error("AniList autocomplete error:", message);

    if (message.includes("AniList HTTP error: 429")) {
      return NextResponse.json(
        {
          error:
            "AniList is receiving too many requests. Please wait a little before searching again.",
        },
        {
          status: 429,
          headers: { "Retry-After": "60" },
        }
      );
    }

    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 502 }
    );
  }
}
