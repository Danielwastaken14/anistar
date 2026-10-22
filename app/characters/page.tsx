
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Question = {
  id: number;
  image: string;
  answerName: string;
  animeId: number;
  animeTitle: string;
};

type Suggestion = {
  id: number;
  label: string;
  image: string | null;
};

type Guess = {
  characterText: string;
  characterId: number | null;
  animeText: string;
  animeId: number | null;
  solved: boolean;
  checked: boolean;
  characterCorrect: boolean | null;
  animeCorrect: boolean | null;
};

function emptyGuess(): Guess {
  return {
    characterText: "",
    characterId: null,
    animeText: "",
    animeId: null,
    solved: false,
    checked: false,
    characterCorrect: null,
    animeCorrect: null,
  };
}

function Autocomplete({
  type,
  value,
  disabled,
  placeholder,
  onChange,
  onSelect,
}: {
  type: "character" | "anime";
  value: string;
  disabled: boolean;
  placeholder: string;
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

    // Don't search again for a value the user just selected.
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
        const params = new URLSearchParams({ type, q: query });

        const response = await fetch(
          `/api/characters/search?${params.toString()}`,
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
          setHighlightedIndex(-1);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, type, disabled, selectedValue]);

  function selectSuggestion(suggestion: Suggestion) {
    setSelectedValue(suggestion.label);
    setShowResults(false);
    setResults([]);
    setLoading(false);
    setHighlightedIndex(-1);

    onSelect(suggestion);
  }

  return (
    <div className="relative min-w-0">
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          if (
            value.trim().length >= 3 &&
            value.trim() !== selectedValue &&
            !disabled &&
            results.length > 0
          ) {
            setShowResults(true);
          }
        }}
        onChange={(event) => {
          const nextValue = event.target.value;

          // A new edit should be searchable again.
          setSelectedValue("");
          setShowResults(nextValue.trim().length >= 3);
          setResults([]);
          setHighlightedIndex(-1);

          onChange(nextValue);
        }}
        onKeyDown={(event) => {
          if (disabled) return;

          if (!showResults || results.length === 0) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();

            setHighlightedIndex((current) =>
              current < results.length - 1 ? current + 1 : 0
            );

            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();

            setHighlightedIndex((current) =>
              current > 0 ? current - 1 : results.length - 1
            );

            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();

            if (highlightedIndex >= 0) {
              const suggestion = results[highlightedIndex];

              if (suggestion) {
                selectSuggestion(suggestion);
              }
            }

            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();

            setShowResults(false);
            setHighlightedIndex(-1);

            return;
          }
        }}
        onBlur={() => {
          // Allow a suggestion click to register before hiding the list.
          setTimeout(() => {
            setShowResults(false);
            setResults([]);
            setHighlightedIndex(-1);
          }, 150);
        }}
        className="w-full rounded-xl border border-white/10 bg-[#101426] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#68718F] focus:border-[#73E8F4]/60 disabled:opacity-50"
      />

      {loading && showResults && (
        <p className="mt-1 text-xs text-[#AAB3D1]">
          Searching AniList...
        </p>
      )}

      {showResults && results.length > 0 && !disabled && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#151A30] p-1 shadow-2xl">
          {results.map((result, index) => (
            <button
              key={result.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => {
                setHighlightedIndex(index);
              }}
              onClick={() => {
                selectSuggestion(result);
              }}
              className={`w-full rounded-lg px-3 py-3 text-left text-sm text-white transition ${
                index === highlightedIndex
                  ? "border border-[#73E8F4]/30 bg-[#73E8F4]/10"
                  : "hover:bg-[#73E8F4]/10"
              }`}
            >
              <span className="block truncate">{result.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CharactersPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [round, setRound] = useState(1);
  const [roundChecked, setRoundChecked] = useState(false);

  const initialLoadStarted = useRef(false);

  const loadRound = useCallback(async () => {
    setLoading(true);
    setError("");
    setRoundChecked(false);

    try {
      const response = await fetch("/api/characters/round", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load the round.");
      }

      setQuestions(data.questions);
      setGuesses(data.questions.map(() => emptyGuess()));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
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

  function updateGuess(index: number, changes: Partial<Guess>) {
    setGuesses((current) =>
      current.map((guess, i) =>
        i === index ? { ...guess, ...changes } : guess
      )
    );
  }

  function checkAllAnswers() {
    setGuesses((current) =>
      current.map((guess, index) => {
        const question = questions[index];

        if (!question || guess.solved) return guess;

        const normalize = (value: string) =>
        value.trim().toLowerCase().replace(/\s+/g, " ");
        const characterCorrect = guess.characterId === question.id || normalize(guess.characterText) === normalize(question.answerName);
        const animeCorrect =guess.animeId === question.animeId || normalize(guess.animeText) === normalize(question.animeTitle);
        const solved = characterCorrect && animeCorrect;

        return {
          ...guess,
          checked: true,
          solved,
          characterCorrect,
          animeCorrect,
        };
      })
    );

    setRoundChecked(true);
  }

  const solvedCount = guesses.filter((guess) => guess.solved).length;
  const allSolved =
    questions.length > 0 && solvedCount === questions.length;

  const canCheck =
    !loading &&
    questions.length > 0 &&
    guesses.some(
      (guess) =>
        !guess.solved &&
        guess.characterId !== null &&
        guess.animeId !== null
    );

  return (
    <main className="min-h-screen bg-[#080B18] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-[1800px]">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <a href="/" className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF4FA3] to-[#8C5BFF] shadow-lg shadow-pink-500/20">
                <span className="text-xl">✦</span>
              </div>
              <div>
                <div className="text-lg font-black tracking-[0.14em] sm:text-xl">
                  ANI<span className="text-[#FF70B7]">*</span>STAR
                </div>
                <div className="hidden text-[10px] font-semibold tracking-[0.2em] text-[#8993B8] sm:block">
                  YOUR ANIME. YOUR STAGE.
                </div>
              </div>
            </a>

            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              Character <span className="text-[#73E8F4]">Guess</span>
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-[#AAB3D1] sm:text-base">
              Name the character and the anime they appear in.
              Five characters. Two answers each. How many can you get right?
            </p>
          </div>

          <div className="rounded-2xl border border-[#73E8F4]/20 bg-[#73E8F4]/5 px-5 py-3">
            <p className="text-xs uppercase tracking-widest text-[#AAB3D1]">
              Round {round}
            </p>
            <p className="mt-1 text-xl font-bold text-[#73E8F4]">
              {solvedCount} / {questions.length || 5} solved
            </p>
          </div>
        </header>

        <div className="mb-8 h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#73E8F4] to-[#FF70B7] transition-all duration-500"
            style={{
              width: `${
                questions.length
                  ? (solvedCount / questions.length) * 100
                  : 0
              }%`,
            }}
          />
        </div>

        {loading && (
          <div className="flex min-h-80 items-center justify-center text-[#73E8F4]">
            Loading your five characters...
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

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {questions.map((question, index) => {
                const guess = guesses[index];
                if (!guess) return null;

                return (
                  <article
                    key={`${round}-${question.id}`}
                    className={`flex min-w-0 flex-col overflow-visible rounded-2xl border bg-[#101426] p-4 transition ${
                      guess.solved
                        ? "border-[#73E8F4]/60 shadow-[0_0_24px_rgba(115,232,244,0.08)]"
                        : "border-white/10"
                    }`}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#AAB3D1]">
                        Character {index + 1}
                      </span>

                      {guess.solved ? (
                        <span className="text-xs font-bold text-[#73E8F4]">
                          ✓ Solved
                        </span>
                      ) : (
                        <span className="text-xs text-[#68718F]">
                          2 answers
                        </span>
                      )}
                    </div>

                    <div className="mb-5 overflow-hidden rounded-xl bg-[#080B18]">
                      <img
                        src={question.image}
                        alt={`Mystery character ${index + 1}`}
                        className="h-64 w-full object-contain sm:h-72 xl:h-64 2xl:h-72"
                      />
                    </div>

                    <div className="flex flex-1 flex-col gap-4">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#73E8F4]">
                          Character name
                        </label>

                        <Autocomplete
                          type="character"
                          value={guess.characterText}
                          disabled={guess.solved}
                          placeholder="First and last name..."
                          onChange={(value) =>
                            updateGuess(index, {
                              characterText: value,
                              characterId: null,
                              checked: false,
                            })
                          }
                          onSelect={(result) =>
                            updateGuess(index, {
                              characterText: result.label,
                              characterId: result.id,
                              checked: false,
                            })
                          }
                        />

                        {roundChecked && !guess.solved && (
                          <p
                            className={`mt-2 text-xs ${
                              guess.characterCorrect
                                ? "text-[#73E8F4]"
                                : "text-[#FF70B7]"
                            }`}
                          >
                            {guess.characterCorrect
                              ? "Character correct!"
                              : `Correct answer: ${question.answerName}`}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#FF70B7]">
                          Anime title
                        </label>

                        <Autocomplete
                          type="anime"
                          value={guess.animeText}
                          disabled={guess.solved}
                          placeholder="Name of the anime..."
                          onChange={(value) =>
                            updateGuess(index, {
                              animeText: value,
                              animeId: null,
                              checked: false,
                            })
                          }
                          onSelect={(result) =>
                            updateGuess(index, {
                              animeText: result.label,
                              animeId: result.id,
                              checked: false,
                            })
                          }
                        />

                        {roundChecked && !guess.solved && (
                          <p
                            className={`mt-2 text-xs ${
                              guess.animeCorrect
                                ? "text-[#73E8F4]"
                                : "text-[#FF70B7]"
                            }`}
                          >
                            {guess.animeCorrect
                              ? "Anime correct!"
                              : `Correct answer: ${question.animeTitle}`}
                          </p>
                        )}
                      </div>

                      {guess.solved && (
                        <p className="text-sm font-semibold text-[#73E8F4]">
                          Both answers are correct!
                        </p>
                      )}

                      {guess.checked && !guess.solved && (
                        <p className="text-sm text-[#FF70B7]">
                          Not quite! Update your answers and check again.
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {!allSolved && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={checkAllAnswers}
                  className="w-full max-w-xl rounded-2xl bg-gradient-to-r from-[#73E8F4] to-[#62C8E8] px-8 py-4 text-lg font-black text-[#080B18] shadow-lg shadow-cyan-500/10 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Check all answers
                </button>
              </div>
            )}

            {allSolved && (
              <div className="mt-8 rounded-2xl border border-[#73E8F4]/30 bg-[#73E8F4]/5 p-6 text-center">
                <h2 className="text-2xl font-black">
                  Perfect round! ✨
                </h2>
                <p className="mt-2 text-[#AAB3D1]">
                  You identified all five characters and their anime.
                </p>
              </div>
            )}

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setRound((current) => current + 1);
                  void loadRound();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="rounded-xl border border-[#FF70B7]/30 px-6 py-3 font-bold text-[#FF70B7] transition hover:bg-[#FF70B7]/10 disabled:opacity-50"
              >
                {allSolved ? "Play next round →" : "Skip to next round →"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
