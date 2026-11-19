
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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

type Suggestion = {
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

type Guess = {
  id: number;
  title: string;
  year: number | null;
  studio: string | null;
  source: string | null;
  score: number | null;
  genres: string[];
  tags: string[];
  correct: boolean;
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatSource(source: string | null) {
  if (!source) return "Unknown";

  return source
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ValueChip({
  value,
  correct,
}: {
  value: string;
  correct: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${
        correct
          ? "border-[#73E8F4]/30 bg-[#73E8F4]/10 text-[#73E8F4]"
          : "border-[#FF70B7]/20 bg-[#FF70B7]/5 text-[#FF70B7]"
      }`}
    >
      {value}
    </span>
  );
}

function NumberChip({
  value,
  target,
  decimals = 0,
}: {
  value: number | null;
  target: number | null;
  decimals?: number;
}) {
  if (value === null || target === null) {
    return <span className="text-[#68718F]">—</span>;
  }

  const correct = value === target;
  const arrow =
    correct ? "" : value < target ? " ↑" : " ↓";

  return (
    <span
      className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${
        correct
          ? "border-[#73E8F4]/30 bg-[#73E8F4]/10 text-[#73E8F4]"
          : "border-[#FF70B7]/20 bg-[#FF70B7]/5 text-[#FF70B7]"
      }`}
    >
      {value.toFixed(decimals)}
      {arrow}
    </span>
  );
}

function AnimeSearch({
  value,
  disabled,
  onChange,
  onSelect,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSelect: (suggestion: Suggestion) => void;
}) {
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedValue, setSelectedValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    const query = value.trim();

    if (selectedValue !== "" && query === selectedValue) {
      setShowResults(false);
      setResults([]);
      setLoading(false);
      setHighlightedIndex(-1);
      return;
    }

    if (query.length < 3 || disabled) {
      setResults([]);
      setLoading(false);
      setShowResults(false);
      setHighlightedIndex(-1);
      return;
    }

    setShowResults(true);
    setHighlightedIndex(-1);

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          q: query,
        });

        const response = await fetch(
          `/api/anime-clues/search?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setResults(data.results ?? []);
          setHighlightedIndex(-1);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, disabled, selectedValue]);

  function selectSuggestion(result: Suggestion) {
    setSelectedValue(result.label);
    setShowResults(false);
    setResults([]);
    setLoading(false);
    setHighlightedIndex(-1);
    onSelect(result);
  }

  return (
    <div className="relative w-full">
      <input
        value={value}
        disabled={disabled}
        autoComplete="off"
        placeholder="Search for an anime..."
        onFocus={() => {
          if (
            value.trim().length >= 3 &&
            value.trim() !== selectedValue &&
            !disabled
          ) {
            setShowResults(true);
          }
        }}
        onChange={(event) => {
          const nextValue = event.target.value;

          setSelectedValue("");
          setResults([]);
          setShowResults(nextValue.trim().length >= 3);
          setHighlightedIndex(-1);
          onChange(nextValue);
        }}
        onKeyDown={(event) => {
          if (!showResults || results.length === 0) {
            if (event.key === "Escape") {
              setShowResults(false);
            }
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((current) =>
              current >= results.length - 1 ? 0 : current + 1
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((current) =>
              current <= 0 ? results.length - 1 : current - 1
            );
          } else if (
            event.key === "Enter" &&
            highlightedIndex >= 0
          ) {
            event.preventDefault();
            selectSuggestion(results[highlightedIndex]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setShowResults(false);
            setHighlightedIndex(-1);
          }
        }}
        onBlur={() => {
          setTimeout(() => {
            setShowResults(false);
            setResults([]);
            setHighlightedIndex(-1);
          }, 150);
        }}
        className="w-full rounded-2xl border border-white/10 bg-[#101426] px-5 py-4 text-base text-white outline-none transition placeholder:text-[#68718F] focus:border-[#73E8F4]/60 disabled:opacity-50"
      />

      {loading && showResults && (
        <p className="mt-2 text-xs text-[#AAB3D1]">
          Searching AniList...
        </p>
      )}

      {showResults && results.length > 0 && !disabled && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-[#151A30] p-1 shadow-2xl">
          {results.map((result, index) => (
            <button
              key={result.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => selectSuggestion(result)}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm text-white transition ${
                highlightedIndex === index
                  ? "border-[#73E8F4]/30 bg-[#73E8F4]/10"
                  : "border-transparent hover:bg-[#73E8F4]/10"
              }`}
            >
              <span className="block truncate font-semibold">
                {result.label}
              </span>

              {result.canonicalLabel !== result.label && (
                <span className="mt-1 block truncate text-xs text-[#8993B8]">
                  Franchise: {result.canonicalLabel}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnimeCluesPage() {
  const [question, setQuestion] = useState<AnimeQuestion | null>(null);
  const [guessText, setGuessText] = useState("");
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [round, setRound] = useState(1);
  const [won, setWon] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const initialLoadStarted = useRef(false);

  const loadRound = useCallback(async () => {
    setLoading(true);
    setError("");
    setGuessText("");
    setGuesses([]);
    setWon(false);
    setGaveUp(false);
    setQuestion(null);

    try {
      const response = await fetch("/api/anime-clues/round", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load the round.");
      }

      setQuestion(data.question);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialLoadStarted.current) return;

    initialLoadStarted.current = true;
    void loadRound();
  }, [loadRound]);

  function submitGuess(result: Suggestion) {
    if (!question || won || gaveUp || guesses.length >= 8) return;

    const alreadyGuessed = guesses.some(
      (guess) => guess.id === result.id
    );

    if (alreadyGuessed) {
      setGuessText("");
      return;
    }

    const correct =
      result.canonicalId === question.id ||
      normalize(result.canonicalLabel) === normalize(question.title);

    const guess: Guess = {
      id: result.id,
      title: result.label,
      year: result.year,
      studio: result.studio,
      source: result.source,
      score: result.score,
      genres: result.genres,
      tags: result.tags,
      correct,
    };

    setGuesses((current) => [...current, guess]);
    setGuessText("");

    if (correct) {
      setWon(true);
    }
  }

  function nextRound() {
    setRound((current) => current + 1);
    void loadRound();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  const guessesLeft = Math.max(0, 8 - guesses.length);
  const roundFinished = won || gaveUp || guesses.length >= 8;

  // Build a compact summary from clues the player has uncovered so far.
  const exactYearGuess = guesses.find(
    (guess) => guess.year !== null && guess.year === question?.year,
  );
  const lowerYearGuesses = guesses
    .filter((guess) => guess.year !== null && question !== null && question.year !== null && guess.year < question.year)
    .map((guess) => guess.year as number);
  const upperYearGuesses = guesses
    .filter((guess) => guess.year !== null && question !== null && question.year !== null && guess.year > question.year)
    .map((guess) => guess.year as number);
  const nearestLowerYear = lowerYearGuesses.length ? Math.max(...lowerYearGuesses) : null;
  const nearestUpperYear = upperYearGuesses.length ? Math.min(...upperYearGuesses) : null;

  const exactScoreGuess = guesses.find(
    (guess) => guess.score !== null && guess.score === question?.score,
  );
  const lowerScoreGuesses = guesses
    .filter((guess) => guess.score !== null && question !== null && question.score !== null && guess.score < question.score)
    .map((guess) => guess.score as number);
  const upperScoreGuesses = guesses
    .filter((guess) => guess.score !== null && question !== null && question.score !== null && guess.score > question.score)
    .map((guess) => guess.score as number);
  const nearestLowerScore = lowerScoreGuesses.length ? Math.max(...lowerScoreGuesses) : null;
  const nearestUpperScore = upperScoreGuesses.length ? Math.min(...upperScoreGuesses) : null;

  const confirmedStudio = guesses.find(
    (guess) => guess.studio && question?.studio && guess.studio === question.studio,
  )?.studio;
  const confirmedSource = guesses.find(
    (guess) => guess.source && question?.source && guess.source === question.source,
  )?.source;
  const gatheredGenres = [...new Set(
    guesses.flatMap((guess) => guess.genres.filter((genre) => question?.genres.includes(genre))),
  )];
  const gatheredTags = [...new Set(
    guesses.flatMap((guess) => guess.tags.filter((tag) => question?.tags.includes(tag))),
  )];

  const yearClue = exactYearGuess
    ? String(exactYearGuess.year)
    : nearestLowerYear !== null && nearestUpperYear !== null
      ? `Between ${nearestLowerYear} and ${nearestUpperYear}`
      : nearestLowerYear !== null
        ? `After ${nearestLowerYear}`
        : nearestUpperYear !== null
          ? `Before ${nearestUpperYear}`
          : "Not discovered yet";
  const scoreClue = exactScoreGuess
    ? exactScoreGuess.score!.toFixed(2)
    : nearestLowerScore !== null && nearestUpperScore !== null
      ? `Between ${nearestLowerScore.toFixed(2)} and ${nearestUpperScore.toFixed(2)}`
      : nearestLowerScore !== null
        ? `Above ${nearestLowerScore.toFixed(2)}`
        : nearestUpperScore !== null
          ? `Below ${nearestUpperScore.toFixed(2)}`
          : "Not discovered yet";

  return (
    <main className="min-h-screen bg-[#080B18] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-[1800px]">
        <header className="mb-8">
          <a href="/" className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF4FA3] to-[#8C5BFF] shadow-lg shadow-pink-500/20">
              <span className="text-xl">✦</span>
            </div>

            <div>
              <div className="text-lg font-black tracking-[0.14em] sm:text-xl">
                ANI<span className="text-[#FF70B7]">★</span>STAR
              </div>
              <div className="hidden text-[10px] font-semibold tracking-[0.2em] text-[#8993B8] sm:block">
                YOUR ANIME. YOUR STAGE.
              </div>
            </div>
          </a>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Anime <span className="text-[#73E8F4]">Clues</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[#AAB3D1] sm:text-base">
                Guess the anime from the clues revealed by each guess.
              </p>
            </div>

            <div className="rounded-2xl border border-[#73E8F4]/20 bg-[#73E8F4]/5 px-5 py-3">
              <p className="text-xs uppercase tracking-widest text-[#AAB3D1]">
                Round {round}
              </p>
              <p className="mt-1 text-xl font-bold text-[#73E8F4]">
                {guesses.length} / 8 guesses
              </p>
            </div>
          </div>
        </header>

        <div className="mb-8 h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#73E8F4] to-[#FF70B7] transition-all duration-500"
            style={{
              width: `${Math.min((guesses.length / 8) * 100, 100)}%`,
            }}
          />
        </div>

        {loading && (
          <div className="flex min-h-80 items-center justify-center text-[#73E8F4]">
            Loading an anime...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-[#FF70B7]/30 bg-[#FF70B7]/5 p-6">
            <p className="text-[#FF70B7]">{error}</p>
            <button
              type="button"
              onClick={() => void loadRound()}
              className="mt-4 rounded-xl bg-[#73E8F4] px-5 py-3 font-bold text-[#080B18]"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && question && (
          <>
            <section className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-[#101426]">
              <div className="flex items-center justify-end border-b border-white/5 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setShowSummary((current) => !current)}
                  aria-pressed={showSummary}
                  className="flex items-center gap-2 text-xs font-medium text-[#AAB3D1] transition hover:text-white"
                >
                  Show summary
                  <span
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                      showSummary ? "bg-[#FF70B7]" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition ${
                        showSummary ? "translate-x-[18px]" : "translate-x-1"
                      }`}
                    />
                  </span>
                </button>
              </div>

              
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#101426] p-5 shadow-2xl sm:p-7">
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#73E8F4]">
                  Guess the anime
                </p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                  What anime is this?
                </h2>
                <p className="mt-2 text-sm text-[#8993B8]">
                  Select an anime to reveal its clues.
                </p>
              </div>

              <AnimeSearch
                value={guessText}
                disabled={roundFinished}
                onChange={setGuessText}
                onSelect={submitGuess}
              />

              <div className="mt-3 flex justify-between text-xs text-[#68718F]">
                <span>{guessesLeft} guesses remaining</span>
                <span>↑ ↓ to navigate · Enter to select</span>
              </div>
            </section>

             {guesses.length > 0 && (
              <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-[#101426]">
                <div className="max-h-[70vh] overflow-auto">
                  <table className="w-full min-w-[1100px] border-collapse">
                    <thead className="sticky top-0 z-30">
                      <tr className="border-b border-white/10 bg-[#151A30] text-left">
                        <th className="px-5 py-4 text-sm font-bold">Anime</th>
                        <th className="px-5 py-4 text-sm font-bold">Year</th>
                        <th className="px-5 py-4 text-sm font-bold">Studio</th>
                        <th className="px-5 py-4 text-sm font-bold">Source</th>
                        <th className="px-5 py-4 text-sm font-bold">Score</th>
                        <th className="px-5 py-4 text-sm font-bold">Genres</th>
                        <th className="px-5 py-4 text-sm font-bold">Tags</th>
                      </tr>
                    </thead>

                    <tbody>
                     <tr className="sticky top-[52px] z-20 border-b border-white/5 bg-[#101426] text-xs shadow-[0_4px_12px_rgba(0,0,0,0.35)] sm:text-sm">
  <td className="px-5 py-5">
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#73E8F4]/15 text-xs font-black text-[#73E8F4]">
        ★
      </span>
      <span className="max-w-[240px] font-semibold text-white">
        Current clues
      </span>
    </div>
  </td>

  <td className="px-5 py-5">
    <span className="font-medium text-[#AAB3D1]">
      {yearClue === "Not discovered yet"
        ? "—"
        : yearClue
            .replace(/^Before (\d{4})$/, (_, year) => `≤${Number(year) - 1}`)
            .replace(/^After (\d{4})$/, (_, year) => `≥${Number(year) + 1}`)}
    </span>
  </td>

  <td className="px-5 py-5">
    {confirmedStudio ? (
      <ValueChip value={confirmedStudio} correct />
    ) : <span className="text-[#68718F]">—</span>}
  </td>

  <td className="px-5 py-5">
    {confirmedSource ? (
      <ValueChip value={formatSource(confirmedSource)} correct />
    ) : <span className="text-[#68718F]">—</span>}
  </td>

  <td className="px-5 py-5">
    <span className="font-medium text-[#AAB3D1]">
      {scoreClue === "Not discovered yet"
        ? "—"
        : scoreClue
            .replace(/^Below (\d+\.\d{2})$/, (_, score) => `≤${(Number(score) - 0.01).toFixed(2)}`)
            .replace(/^Above (\d+\.\d{2})$/, (_, score) => `≥${(Number(score) + 0.01).toFixed(2)}`)}
    </span>
  </td>

  <td className="max-w-[280px] px-5 py-5">
    <div className="flex flex-wrap gap-1.5">
      {gatheredGenres.length
        ? gatheredGenres.map((genre) => (
            <ValueChip key={genre} value={genre} correct />
          ))
        : <span className="text-[#68718F]">—</span>}
    </div>
  </td>

  <td className="max-w-[340px] px-5 py-5">
    <div className="flex flex-wrap gap-1.5">
      {gatheredTags.length
        ? gatheredTags.map((tag) => (
            <ValueChip key={tag} value={tag} correct />
          ))
        : <span className="text-[#68718F]">—</span>}
    </div>
  </td>
</tr>
                      {guesses.map((guess, index) => {
                        const genreMatches = guess.genres.filter(
                          (genre) => question.genres.includes(genre)
                        );

                        const tagMatches = guess.tags.filter(
                          (tag) => question.tags.includes(tag)
                        );

                        const studioCorrect = Boolean(
                          guess.studio &&
                          question.studio &&
                          guess.studio === question.studio
                        );

                        const sourceCorrect = Boolean(
                          guess.source &&
                          question.source &&
                          guess.source === question.source
                        );

                        return (
                          <tr
                            key={`${round}-${guess.id}-${index}`}
                            className={`border-b border-white/5 ${
                              guess.correct ? "bg-[#73E8F4]/5" : ""
                            }`}
                             >
                            <td className="px-5 py-5">
                              <div className="flex items-center gap-3">
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                                    guess.correct
                                      ? "bg-[#73E8F4]/15 text-[#73E8F4]"
                                      : "bg-[#FF70B7]/10 text-[#FF70B7]"
                                  }`}
                                >
                                  {index + 1}
                                </span>
                                <span className="max-w-[240px] font-semibold">
                                  {guess.title}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-5">
                              <NumberChip
                                value={guess.year}
                                target={question.year}
                              />
                            </td>

                            <td className="px-5 py-5">
                              {guess.studio ? (
                                <ValueChip
                                  value={guess.studio}
                                  correct={studioCorrect}
                                />
                              ) : (
                                <span className="text-[#68718F]">—</span>
                              )}
                            </td>

                            <td className="px-5 py-5">
                              {guess.source ? (
                                <ValueChip
                                  value={formatSource(guess.source)}
                                  correct={sourceCorrect}
                                />
                              ) : (
                                <span className="text-[#68718F]">—</span>
                              )}
                            </td>

                            <td className="px-5 py-5">
                              <NumberChip
                                value={guess.score}
                                target={question.score}
                                decimals={2}
                              />
                            </td>

                            <td className="max-w-[280px] px-5 py-5">
                              <div className="flex flex-wrap gap-1.5">
                                {guess.genres.map((genre) => (
                                  <ValueChip
                                    key={genre}
                                    value={genre}
                                    correct={genreMatches.includes(genre)}
                                  />
                                ))}
                              </div>
                            </td>

                            <td className="max-w-[340px] px-5 py-5">
                              <div className="flex flex-wrap gap-1.5">
                                {guess.tags.map((tag) => (
                                  <ValueChip
                                    key={tag}
                                    value={tag}
                                    correct={tagMatches.includes(tag)}
                                  />
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {guesses.length === 0 && (
              <section className="mt-8 rounded-3xl border border-white/10 bg-[#101426] p-7 text-center">
                <p className="mx-auto max-w-2xl text-[#AAB3D1]">
                  Make your first guess to reveal clues. Compare the year,
                  studio, score, genres, and tags to narrow down the answer.
                </p>
              </section>
            )}

            {won && (
              <section className="mt-8 rounded-3xl border border-[#73E8F4]/30 bg-[#73E8F4]/5 p-7 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#73E8F4]">
                  Correct!
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  {question.title} ✨
                </h2>
                <p className="mt-2 text-[#AAB3D1]">
                  You got it in {guesses.length}{" "}
                  {guesses.length === 1 ? "guess" : "guesses"}.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {question.year !== null && (
                    <ValueChip value={String(question.year)} correct />
                  )}
                  {question.studio && (
                    <ValueChip value={question.studio} correct />
                  )}
                  {question.source && (
                    <ValueChip
                      value={formatSource(question.source)}
                      correct
                    />
                  )}
                  {question.score !== null && (
                    <ValueChip
                      value={`Score ${question.score.toFixed(2)}`}
                      correct
                    />
                  )}
                  {question.genres.map((genre) => (
                    <ValueChip key={genre} value={genre} correct />
                  ))}
                </div>
              </section>
            )}

            {!won && (gaveUp || guesses.length >= 8) && (
              <section className="mt-8 rounded-3xl border border-[#FF70B7]/30 bg-[#FF70B7]/5 p-7 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF70B7]">
                  {gaveUp ? "You gave up" : "Round over"}
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  The answer was
                </h2>
                <p className="mt-2 text-2xl font-bold text-[#73E8F4]">
                  {question.title}
                </p>
              </section>
            )}

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {!roundFinished && (
                <button
                  type="button"
                  onClick={() => setGaveUp(true)}
                  className="rounded-xl border border-white/15 px-6 py-3 font-bold text-[#AAB3D1] transition hover:border-[#FF70B7]/40 hover:bg-[#FF70B7]/10 hover:text-[#FF70B7]"
                >
                  Give up
                </button>
              )}
              <button
                type="button"
                onClick={nextRound}
                disabled={loading}
                className="rounded-xl border border-[#FF70B7]/30 px-6 py-3 font-bold text-[#FF70B7] transition hover:bg-[#FF70B7]/10 disabled:opacity-50"
              >
                {roundFinished ? "Play next round →" : "Skip to next round →"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
