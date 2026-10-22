import { NextResponse } from "next/server";
import { anilistQuery } from "@/lib/anilist";
import {
  getAnimeTitle,
  getCanonicalAnime,
  type FranchiseMedia,
} from "@/lib/anime-franchise";

type Candidate = {
  id: number;
  name: { full: string };
  image: { large: string };
  media: {
    nodes: FranchiseMedia[];
  };
};

type ResponseData = {
  popular: {
    characters: Candidate[];
  };
  medium: {
    characters: Candidate[];
  };
  lessPopular: {
    characters: Candidate[];
  };
};

type CachedCharacter = Candidate & {
  popularityTier: "popular" | "medium" | "lessPopular";
};

let characterPoolCache: {
  characters: CachedCharacter[];
  expiresAt: number;
} | null = null;

const CACHE_DURATION = 10 * 60 * 1000;

const CHARACTER_PAGE = (page: number) => `
  Page(page: ${page}, perPage: 50) {
    characters(sort: FAVOURITES_DESC) {
      id
      name {
        full
      }
      image {
        large
      }
      media(type: ANIME, sort: POPULARITY_DESC) {
        nodes {
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
  }
`;

const CHARACTER_ROUND_QUERY = `
  query CharacterRound {
    popular: ${CHARACTER_PAGE(1)}
    medium: ${CHARACTER_PAGE(2)}
    lessPopular: ${CHARACTER_PAGE(3)}
  }
`;

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildCharacterPool(data: ResponseData): CachedCharacter[] {
  const popular = data.popular.characters.map((character) => ({
    ...character,
    popularityTier: "popular" as const,
  }));

  const medium = data.medium.characters.map((character) => ({
    ...character,
    popularityTier: "medium" as const,
  }));

  const lessPopular = data.lessPopular.characters.map((character) => ({
    ...character,
    popularityTier: "lessPopular" as const,
  }));

  const all = [...popular, ...medium, ...lessPopular];

  // Remove duplicate characters just in case AniList returns one
  // in more than one page.
  const unique = new Map<number, CachedCharacter>();

  for (const character of all) {
    if (!unique.has(character.id)) {
      unique.set(character.id, character);
    }
  }

  return [...unique.values()].filter(
    (character) =>
      Boolean(character.image?.large) &&
      character.media.nodes.length > 0
  );
}

function chooseCharacters(
  pool: CachedCharacter[],
  amount: number
): CachedCharacter[] {
  const popular = shuffle(
    pool.filter((character) => character.popularityTier === "popular")
  );

  const medium = shuffle(
    pool.filter((character) => character.popularityTier === "medium")
  );

  const lessPopular = shuffle(
    pool.filter((character) => character.popularityTier === "lessPopular")
  );

  /*
   * Aim for:
   * 2 popular
   * 2 medium
   * 1 less popular
   *
   * This keeps rounds recognizable while still adding variety.
   */
  const selected = [
    ...popular.slice(0, 2),
    ...medium.slice(0, 2),
    ...lessPopular.slice(0, 1),
  ];

  // In case one tier doesn't have enough valid characters.
  if (selected.length < amount) {
    const alreadySelected = new Set(selected.map((character) => character.id));

    const remaining = shuffle(
      pool.filter((character) => !alreadySelected.has(character.id))
    );

    selected.push(...remaining.slice(0, amount - selected.length));
  }

  return shuffle(selected).slice(0, amount);
}

export async function GET() {
  try {
    let pool: CachedCharacter[];

    if (
      characterPoolCache &&
      characterPoolCache.expiresAt > Date.now()
    ) {
      pool = characterPoolCache.characters;
    } else {
      const data = await anilistQuery<ResponseData>(
        null,
        CHARACTER_ROUND_QUERY
      );

      pool = buildCharacterPool(data);

      characterPoolCache = {
        characters: pool,
        expiresAt: Date.now() + CACHE_DURATION,
      };
    }

    if (pool.length < 5) {
      return NextResponse.json(
        {
          error: "Not enough characters were found. Try again.",
        },
        { status: 503 }
      );
    }

    const selected = chooseCharacters(pool, 5);

    const questions = selected.map((character) => {
      const options = character.media.nodes;

      // Prefer actual TV/TV_SHORT entries.
      const mainSeries = options.filter(
        (anime) =>
          anime.type === "ANIME" &&
          (anime.format === "TV" || anime.format === "TV_SHORT")
      );

      const poolToChooseFrom =
        mainSeries.length > 0 ? mainSeries : options;

      const chosen =
        poolToChooseFrom[
          Math.floor(Math.random() * poolToChooseFrom.length)
        ];

      const canonical = getCanonicalAnime(chosen);

      return {
        id: character.id,
        image: character.image.large,
        answerName: character.name.full,
        animeId: canonical.id,
        animeTitle: getAnimeTitle(canonical),
      };
    });

    return NextResponse.json(
      { questions },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    console.error("Character round error:", message);

    const rateLimited = message.includes(
      "AniList HTTP error: 429"
    );

    return NextResponse.json(
      {
        error: rateLimited
          ? "AniList is rate-limiting requests. Wait a minute and try again."
          : "Could not load characters from AniList.",
      },
      {
        status: rateLimited ? 429 : 502,
        ...(rateLimited
          ? {
              headers: {
                "Retry-After": "60",
              },
            }
          : {}),
      }
    );
  }
}