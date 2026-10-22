import type { AnimeListEntry } from "./anilist";

export type GameAnime = {
  id: number;
  title: string;
  cover: string;
};

export function getPlayableAnime(
  entries: AnimeListEntry[]
): GameAnime[] {
  return entries
    .filter((entry) => {
      // Completed = definitely watched.
      if (entry.status === "COMPLETED") {
        return true;
      }

      // Watching/paused only count if the user actually
      // watched at least one episode.
      if (
        (entry.status === "CURRENT" ||
          entry.status === "PAUSED") &&
        entry.progress > 0
      ) {
        return true;
      }

      return false;
    })
    .filter((entry) => entry.media.coverImage?.large)
    .map((entry) => ({
      id: entry.media.id,
      title:
        entry.media.title.userPreferred ??
        entry.media.title.english ??
        entry.media.title.romaji ??
        entry.media.title.native ??
        "Unknown",
      cover: entry.media.coverImage!.large,
    }));
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function createQuestion(
  anime: GameAnime[]
) {
  if (anime.length < 4) {
    throw new Error(
      "You need at least 4 playable anime."
    );
  }

  const answer = randomItem(anime);

  const wrongAnswers = anime
    .filter((item) => item.id !== answer.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const choices = [answer, ...wrongAnswers].sort(
    () => Math.random() - 0.5
  );

  return {
    answer,
    choices,
  };
}