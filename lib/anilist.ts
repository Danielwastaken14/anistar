const ANILIST_API = "https://graphql.anilist.co";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{
    message: string;
  }>;
};

export async function anilistQuery<T>(
  accessToken: string | null,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(ANILIST_API, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
  const details = await response.text();

  console.error("AniList API error:", response.status, details);

  throw new Error(
    `AniList HTTP error: ${response.status} - ${details}`
  );
}

  const json = (await response.json()) as GraphQLResponse<T>;

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  if (!json.data) {
    throw new Error("AniList returned no data");
  }

  return json.data;
}

export type AniListAnime = {
  id: number;

  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
    userPreferred: string | null;
  };

  coverImage: {
    large: string;
  } | null;

  episodes: number | null;

  genres: string[];
};

export type AnimeListEntry = {
  id: number;
  status: string;
  progress: number;

  media: AniListAnime;
};

type MediaListCollectionResponse = {
  MediaListCollection: {
    lists: Array<{
      name: string;

      entries: AnimeListEntry[];
    }>;
  };
};

const USER_ANIME_QUERY = `
  query GetAnimeList($userId: Int!) {
    MediaListCollection(
      type: ANIME
      userId: $userId
    ) {
      lists {
        name

        entries {
          id
          status
          progress

          media {
            id

            title {
              romaji
              english
              native
              userPreferred
            }

            coverImage {
              large
            }

            episodes
            genres
          }
        }
      }
    }
  }
`;

export async function getUserAnime(
  accessToken: string,
  userId: number
): Promise<AnimeListEntry[]> {
  const data = await anilistQuery<MediaListCollectionResponse>(
    accessToken,
    USER_ANIME_QUERY,
    { userId }
  );

  const entries = data.MediaListCollection.lists.flatMap(
    (list) => list.entries
  );

  // A title can appear in multiple custom lists.
  // Keep only one copy.
  const unique = new Map<number, AnimeListEntry>();

  for (const entry of entries) {
    if (!unique.has(entry.media.id)) {
      unique.set(entry.media.id, entry);
    }
  }

  return [...unique.values()];
}