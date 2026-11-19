
import { NextResponse } from "next/server";
import { anilistQuery } from "@/lib/anilist";
import {
  getAnimeTitle,
  getCanonicalAnime,
  type FranchiseMedia,
} from "@/lib/anime-franchise";

type AnimeCandidate = FranchiseMedia & {
  averageScore: number | null;
  startDate: {
    year: number | null;
  } | null;
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
  source: string | null;
};

type RoundResponse = {
  Page: {
    media: AnimeCandidate[];
  };
};

type AnimeQuestion = {
  id: number;
  title: string;
  year: number | null;
  studio: string | null;
  source: string | null;
  score: number | null;
  genres: string[];
  tags: string[];
};

let poolCache: {
  anime: AnimeCandidate[];
  expiresAt: number;
} | null = null;

const CACHE_DURATION = 10 * 60 * 1000;

const ROUND_QUERY = `
  query AnimeCluesRound {
    Page(page: 1, perPage: 50) {
      media(
        type: ANIME
        format_in: [TV, TV_SHORT]
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

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function cleanTags(
  tags: AnimeCandidate["tags"]
): string[] {
  return tags
    .filter((tag) => tag.rank >= 50)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 8)
    .map((tag) => tag.name);
}

function buildPool(
  data: RoundResponse
): AnimeCandidate[] {
  const unique = new Map<number, AnimeCandidate>();

  for (const anime of data.Page.media) {
    if (
      anime.type !== "ANIME" ||
      (anime.format !== "TV" && anime.format !== "TV_SHORT")
    ) {
      continue;
    }

    // Keep main-series entries instead of sequel seasons
    // whenever the franchise resolver identifies a prequel.
    const canonical = getCanonicalAnime(anime);

    if (canonical.id !== anime.id) {
      continue;
    }

    unique.set(anime.id, anime);
  }

  return [...unique.values()];
}

function toQuestion(
  anime: AnimeCandidate
): AnimeQuestion {
  return {
    id: anime.id,
    title: getAnimeTitle(anime),
    year: anime.startDate?.year ?? null,
    studio: anime.studios?.nodes?.[0]?.name ?? null,
    source: anime.source ?? null,
    score:
      anime.averageScore == null
        ? null
        : anime.averageScore / 10,
    genres: anime.genres ?? [],
    tags: cleanTags(anime.tags ?? []),
  };
}

export async function GET() {
  try {
    let pool: AnimeCandidate[];

    if (poolCache && poolCache.expiresAt > Date.now()) {
      pool = poolCache.anime;
    } else {
      const data = await anilistQuery<RoundResponse>(
        null,
        ROUND_QUERY
      );

      pool = buildPool(data);

      poolCache = {
        anime: pool,
        expiresAt: Date.now() + CACHE_DURATION,
      };
    }

    if (pool.length === 0) {
      return NextResponse.json(
        { error: "Could not find anime for this round." },
        { status: 503 }
      );
    }

    const selected = shuffle(pool)[0];

    return NextResponse.json(
      { question: toQuestion(selected) },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    console.error("Anime Clues round error:", message);

    const rateLimited = message.includes(
      "AniList HTTP error: 429"
    );

    return NextResponse.json(
      {
        error: rateLimited
          ? "AniList is rate-limiting requests. Wait a minute and try again."
          : "Could not load an anime for this round.",
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
