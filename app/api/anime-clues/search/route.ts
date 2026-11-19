
import { NextRequest, NextResponse } from "next/server";
import { anilistQuery } from "@/lib/anilist";
import {
  getAnimeTitle,
  getCanonicalAnime,
  type FranchiseMedia,
} from "@/lib/anime-franchise";

type AnimeSearchResult = FranchiseMedia & {
  coverImage: {
    medium: string | null;
  };
  startDate: {
    year: number | null;
  } | null;
  averageScore: number | null;
  source: string | null;
  genres: string[];
  tags: {
    name: string;
    rank: number;
  }[];
  studios: {
    nodes: {
      name: string;
    }[];
  };
};

type SearchResponse = {
  Page: {
    media: AnimeSearchResult[];
  };
};

type SearchSuggestion = {
  id: number;
  label: string;
  image: string | null;
  canonicalId: number;
  canonicalLabel: string;
  year: number | null;
  studio: string | null;
  source: string | null;
  score: number | null;
  genres: string[];
  tags: string[];
};

const cache = new Map<
  string,
  {
    results: SearchSuggestion[];
    expiresAt: number;
  }
>();

const CACHE_DURATION = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 300;

const SEARCH_QUERY = `
  query AnimeCluesSearch($search: String!) {
    Page(page: 1, perPage: 8) {
      media(
        search: $search
        type: ANIME
        sort: POPULARITY_DESC
      ) {
        id
        type
        format

        title {
          romaji
          english
          userPreferred
        }

        coverImage {
          medium
        }

        startDate {
          year
        }

        averageScore
        source
        genres

        tags {
          name
          rank
        }

        studios {
          nodes {
            name
          }
        }

        relations {
          edges {
            relationType
            node {
              id
              type
              format
              title {
                romaji
                english
                userPreferred
              }
              relations {
                edges {
                  relationType
                  node {
                    id
                    type
                    format
                    title {
                      romaji
                      english
                      userPreferred
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

function trimCache() {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;

    if (oldestKey === undefined) {
      break;
    }

    cache.delete(oldestKey);
  }
}

function getTags(
  tags: AnimeSearchResult["tags"]
): string[] {
  return tags
    .filter((tag) => tag.rank >= 50)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 8)
    .map((tag) => tag.name);
}

export async function GET(request: NextRequest) {
  const query =
    request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({
      results: cached.results,
    });
  }

  try {
    const data = await anilistQuery<SearchResponse>(
      null,
      SEARCH_QUERY,
      { search: query }
    );

    const results: SearchSuggestion[] =
      data.Page.media.map((anime) => {
        const canonical = getCanonicalAnime(anime);

        return {
          id: anime.id,
          label:
            anime.title.english ||
            anime.title.romaji ||
            anime.title.userPreferred ||
            "Unknown anime",
          image: anime.coverImage?.medium ?? null,

          canonicalId: canonical.id,
          canonicalLabel: getAnimeTitle(canonical),

          year: anime.startDate?.year ?? null,
          studio: anime.studios?.nodes?.[0]?.name ?? null,
          source: anime.source ?? null,
          score:
            anime.averageScore == null
              ? null
              : anime.averageScore / 10,
          genres: anime.genres ?? [],
          tags: getTags(anime.tags ?? []),
        };
      });

    cache.set(cacheKey, {
      results,
      expiresAt: Date.now() + CACHE_DURATION,
    });

    trimCache();

    return NextResponse.json({ results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    console.error("Anime Clues search error:", message);

    const rateLimited = message.includes(
      "AniList HTTP error: 429"
    );

    return NextResponse.json(
      {
        error: rateLimited
          ? "AniList is rate-limiting requests. Please wait a minute and try again."
          : "Could not search AniList.",
      },
      {
        status: rateLimited ? 429 : 502,
        ...(rateLimited
          ? { headers: { "Retry-After": "60" } }
          : {}),
      }
    );
  }
}
