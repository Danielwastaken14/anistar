export type FranchiseMedia = {
  id: number;
  type?: string | null;
  format?: string | null;
  title: {
    romaji: string | null;
    english: string | null;
    userPreferred: string | null;
  };
  relations?: {
    edges: Array<{
      relationType: string | null;
      node: FranchiseMedia | null;
    }>;
  } | null;
};

export function getAnimeTitle(media: FranchiseMedia): string {
  return (
    media.title.english ||
    media.title.romaji ||
    media.title.userPreferred ||
    "Unknown anime"
  );
}

const MAIN_SERIES_FORMATS = new Set(["TV", "TV_SHORT"]);

export function getCanonicalAnime(
  media: FranchiseMedia
): FranchiseMedia {
  let current = media;
  const visited = new Set<number>([media.id]);

  for (let depth = 0; depth < 5; depth++) {
    const prequel = current.relations?.edges.find(
      ({ relationType, node }) =>
        relationType === "PREQUEL" &&
        node?.type === "ANIME" &&
        !visited.has(node.id)
    )?.node;

    if (!prequel) {
      break;
    }

    visited.add(prequel.id);
    current = prequel;
  }

  // If we ended up at a main TV series, use it.
  if (
    current.type === "ANIME" &&
    MAIN_SERIES_FORMATS.has(current.format ?? "")
  ) {
    return current;
  }

  // Otherwise, walk backward through the chain again looking
  // for the first main TV/TV_SHORT entry.
  let fallback: FranchiseMedia | null = null;

  const queue: FranchiseMedia[] = [media];
  const searched = new Set<number>([media.id]);

  while (queue.length > 0) {
    const item = queue.shift()!;

    for (const edge of item.relations?.edges ?? []) {
      if (edge.relationType !== "PREQUEL" || !edge.node) {
        continue;
      }

      const node = edge.node;

      if (searched.has(node.id)) {
        continue;
      }

      searched.add(node.id);

      if (
        node.type === "ANIME" &&
        MAIN_SERIES_FORMATS.has(node.format ?? "")
      ) {
        fallback = node;
        queue.length = 0;
        break;
      }

      queue.push(node);
    }
  }

  return fallback ?? current;
}