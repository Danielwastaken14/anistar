
import { NextResponse } from "next/server";
import { anilistQuery } from "@/lib/anilist";

type AnimeAppearance = {
  id: number;
  type: string | null;
  title: {
    english: string | null;
    romaji: string | null;
    userPreferred: string | null;
  };
};

type Candidate = {
  id: number;
  name: { full: string };
  image: { large: string | null } | null;
  media: { nodes: (AnimeAppearance | null)[] } | null;
};

type ResponseData = Record<
  string,
  { characters: (Candidate | null)[] }
>;

let characterPoolCache: {
  characters: Candidate[];
  expiresAt: number;
} | null = null;

const CACHE_DURATION = 10 * 60 * 1000;

const TOTAL_PAGES = 10;
const CHARACTERS_PER_PAGE = 50;
const CHARACTERS_PER_ROUND = 5;

// AniList allows a maximum of 50 entries per page.
// Fetch 10 pages to build a pool of up to 500 characters.
const CHARACTER_PAGE = (page: number) => `
  page${page}: Page(page: ${page}, perPage: ${CHARACTERS_PER_PAGE}) {
    characters(sort: FAVOURITES_DESC) {
      id
      name {
        full
      }
      image {
        large
      }
      media(type: ANIME, sort: POPULARITY_DESC, perPage: 50) {
        nodes {
          id
          type
          title {
            english
            romaji
            userPreferred
          }
        }
      }
    }
  }
`;

const CHARACTER_ROUND_QUERY = `
  query CharacterRound {
    ${Array.from(
      { length: TOTAL_PAGES },
      (_, index) => CHARACTER_PAGE(index + 1)
    ).join("\n")}
  }
`;

// Fisher-Yates shuffle for unbiased random selection.
function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function getAppearances(
  character: Candidate
): AnimeAppearance[] {
  const unique = new Map<number, AnimeAppearance>();

  for (const anime of character.media?.nodes ?? []) {
    if (anime && anime.type === "ANIME") {
      unique.set(anime.id, anime);
    }
  }

  return [...unique.values()];
}

function getAnimeTitle(anime: AnimeAppearance): string {
  return (
    anime.title.english ||
    anime.title.romaji ||
    anime.title.userPreferred ||
    "Unknown anime"
  );
}

function buildCharacterPool(
  data: ResponseData
): Candidate[] {
  const unique = new Map<number, Candidate>();

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const characters = data[`page${page}`]?.characters ?? [];

    for (const character of characters) {
      if (!character) continue;

      if (!unique.has(character.id)) {
        unique.set(character.id, character);
      }
    }
  }

  // Only keep characters with an image and at least
  // one anime appearance.
  return [...unique.values()].filter(
    (character) =>
      Boolean(character.image?.large) &&
      getAppearances(character).length > 0
  );
}

// Choose any 5 unique characters uniformly from the pool.
function chooseCharacters(
  pool: Candidate[],
  amount: number
): Candidate[] {
  return shuffle(pool).slice(0, amount);
}

export async function GET() {
  try {
    let pool: Candidate[];

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

    if (pool.length < CHARACTERS_PER_ROUND) {
      return NextResponse.json(
        {
          error: "Not enough characters were found. Try again.",
        },
        { status: 503 }
      );
    }

    const selected = chooseCharacters(
      pool,
      CHARACTERS_PER_ROUND
    );

    const questions = selected.map((character) => {
      const appearances = getAppearances(character);

      // Use the most popular appearance for display only.
      // All returned appearances are accepted as answers.
      const primary = appearances[0];

      const acceptedAnimeTitles = Array.from(
        new Set(
          appearances.flatMap((anime) =>
            [
              anime.title.english,
              anime.title.romaji,
              anime.title.userPreferred,
            ].filter(
              (title): title is string =>
                Boolean(title?.trim())
            )
          )
        )
      );

      return {
        id: character.id,
        image: character.image!.large!,
        answerName: character.name.full,

        animeId: primary.id,
        animeTitle: getAnimeTitle(primary),

        acceptedAnimeIds: appearances.map(
          (anime) => anime.id
        ),
        acceptedAnimeTitles,
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
      error instanceof Error
        ? error.message
        : "Unknown error";

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
