export type FranchiseMedia = {
  id: number;
  type?: string | null;
  format?: string | null;
  startDate?: { year?: number | null } | null;
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

const MAIN_SERIES_FORMATS = new Set(["TV", "TV_SHORT"]);

export function getAnimeTitle(media: FranchiseMedia): string {
  return (
    media.title.english ||
    media.title.romaji ||
    media.title.userPreferred ||
    "Unknown anime"
  );
}

function isMainSeries(media: FranchiseMedia): boolean {
  return (
    media.type === "ANIME" &&
    MAIN_SERIES_FORMATS.has(media.format ?? "")
  );
}

function yearOf(media: FranchiseMedia): number {
  return media.startDate?.year ?? Number.POSITIVE_INFINITY;
}

/**
 * Resolve a sequel to the earliest TV entry reachable through PREQUEL edges.
 * This deliberately does not traverse SPIN_OFF, SIDE_STORY, or OTHER:
 * those links can connect different shows or continuities.
 *
 * When provided with only a partial AniList relation graph, resolution is
 * necessarily partial. The character round route also checks ALL of the
 * character's available anime appearances to find the original TV series.
 */
export function getCanonicalAnime(media: FranchiseMedia): FranchiseMedia {
  const queue: FranchiseMedia[] = [media];
  const visited = new Set<number>();
  const candidates: FranchiseMedia[] = [];

  // Bound traversal to avoid surprisingly large/cyclic graphs.
  while (queue.length > 0 && visited.size < 100) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    if (isMainSeries(current)) candidates.push(current);

    for (const edge of current.relations?.edges ?? []) {
      if (
        edge.relationType === "PREQUEL" &&
        edge.node?.type === "ANIME" &&
        !visited.has(edge.node.id)
      ) {
        queue.push(edge.node);
      }
    }
  }

  if (candidates.length === 0) return media;

  // Prefer the oldest known TV series in the sequel chain. When years aren't
  // available, an entry with no visible prequel is the better root candidate.
  candidates.sort((a, b) => {
    const yearDifference = yearOf(a) - yearOf(b);
    if (yearDifference !== 0) return yearDifference;

    const aHasPrequel = (a.relations?.edges ?? []).some(
      (edge) => edge.relationType === "PREQUEL" && edge.node?.type === "ANIME"
    );
    const bHasPrequel = (b.relations?.edges ?? []).some(
      (edge) => edge.relationType === "PREQUEL" && edge.node?.type === "ANIME"
    );
    if (aHasPrequel !== bHasPrequel) return aHasPrequel ? 1 : -1;

    if (a.format !== b.format) return a.format === "TV" ? -1 : 1;
    return 0;
  });

  return candidates[0];
}
