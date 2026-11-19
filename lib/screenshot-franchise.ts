/** Franchise matching used ONLY by Screenshot Guesser.
 * Accepts a sequel/prequel chain when the titles indicate the same series.
 * This intentionally doesn't merge alternate adaptations or spin-offs.
 */
export type ScreenshotFranchiseAnime = {
  id: number;
  type?: string | null;
  title: {
    english: string | null;
    romaji: string | null;
    userPreferred: string | null;
  };
  relations?: {
    edges: Array<{
      relationType: string | null;
      node: ScreenshotFranchiseAnime | null;
    }>;
  } | null;
};

export function screenshotRelationFields(depth: number): string {
  const nested = depth > 0
    ? `relations { edges { relationType node { ${screenshotRelationFields(depth - 1)} } } }`
    : "";
  return `id type title { english romaji userPreferred } ${nested}`;
}

function titleVariants(anime: ScreenshotFranchiseAnime): string[] {
  return [anime.title.english, anime.title.romaji, anime.title.userPreferred]
    .filter((title): title is string => Boolean(title?.trim()));
}

function seriesKey(title: string): string {
  let key = title.toLowerCase().normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ").trim();

  // Remove only *explicit* season/part labels, not arbitrary subtitles.
  for (let i = 0; i < 4; i++) {
    const next = key
      .replace(/\s+(?:the\s+)?final\s+season(?:\s+part\s+\d+)?$/u, "")
      .replace(/\s+(?:season|series|part|cour)\s+(?:\d+|[ivx]+)$/u, "")
      .replace(/\s+(?:\d+(?:st|nd|rd|th)|[ivx]+)\s+season$/u, "")
      .replace(/\s+(?:s\d+|\d+(?:st|nd|rd|th)\s+season)$/u, "")
      .replace(/\s+(?:2|3|4|5|6|7|8|9|ii|iii|iv|v|vi|vii|viii|ix)$/u, "")
      .trim();
    if (next === key) break;
    key = next;
  }
  return key;
}

function sameSeriesName(a: ScreenshotFranchiseAnime, b: ScreenshotFranchiseAnime): boolean {
  const aKeys = titleVariants(a).map(seriesKey);
  const bKeys = new Set(titleVariants(b).map(seriesKey));
  if (aKeys.some((key) => key.length >= 4 && bKeys.has(key))) return true;

  // Naruto and Naruto Shippuden are a genuine continuous sequel, despite the subtitle.
  const all = new Set([...aKeys, ...bKeys]);
  return all.has("naruto") && all.has("naruto shippuden");
}

/** Resolve a stable root for connected TV seasons that share a series name.
 * The query includes up to four levels of prequels; no additional API requests.
 */
export function getScreenshotSeries(anime: ScreenshotFranchiseAnime): { id: number; aliases: string[] } {
  let current = anime;
  const visited = new Set<number>([anime.id]);
  const aliases = new Set(titleVariants(anime));

  for (let depth = 0; depth < 4; depth++) {
    const parent = current.relations?.edges
      .filter((edge) => edge.relationType === "PREQUEL" && edge.node?.type === "ANIME")
      .map((edge) => edge.node!)
      .find((node) => !visited.has(node.id) && sameSeriesName(current, node));
    if (!parent) break;
    visited.add(parent.id);
    titleVariants(parent).forEach((title) => aliases.add(title));
    current = parent;
  }

  return { id: current.id, aliases: [...aliases] };
}

export function getScreenshotSeriesId(anime: ScreenshotFranchiseAnime): number {
  return getScreenshotSeries(anime).id;
}
