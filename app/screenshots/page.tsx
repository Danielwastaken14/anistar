"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Question = {
  id: number;
  seriesId: number;
  seriesAliases: string[];
  title: string;
  aliases: string[];
  screenshot: string;
  screenshots: string[];
  year: number | null;
  genres: string[];
};
type Suggestion = { id: number; seriesId: number; label: string; image: string | null };
type Guess = { id: number | null; label: string; correct: boolean; skipped?: boolean };

const MAX_GUESSES = 6;

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize("NFKC")
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim().replace(/\s+/g, " ");
}

function AnimeAutocomplete({
  value, selected, disabled, onChange, onSelect, onEnter,
}: {
  value: string;
  selected: Suggestion | null;
  disabled: boolean;
  onChange: (value: string) => void;
  onSelect: (suggestion: Suggestion) => void;
  onEnter: () => void;
}) {
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");
  const listId = "screenshot-anime-results";

  useEffect(() => {
    const q = value.trim();
    if (disabled || q.length < 3 || (selected && selected.label === value)) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/screenshots/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(response.status === 429 ? "Search is rate-limited. Try again shortly." : "Search is temporarily unavailable.");
        const json: { results: Suggestion[] } = await response.json();
        if (!controller.signal.aborted) {
          setResults(json.results ?? []);
          setOpen(true);
          setActive(-1);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setResults([]);
          setError(e instanceof Error ? e.message : "Search failed.");
          setOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 450);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [value, selected, disabled]);

  function keyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open && results.length && e.key === "ArrowDown") {
      e.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (open && results.length && e.key === "ArrowUp") {
      e.preventDefault();
      setActive((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && active >= 0 && results[active]) {
        onSelect(results[active]);
        setOpen(false);
      } else {
        onEnter();
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="text"
        id="screenshot-anime-title"
        value={value}
        disabled={disabled}
        placeholder="Type an anime title..."
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onFocus={() => { if (results.length) setOpen(true); }}
        onChange={(event) => { onChange(event.target.value); setActive(-1); }}
        onKeyDown={keyDown}
        className="w-full rounded-xl border border-white/15 bg-[#0C1022] px-4 py-3.5 text-sm font-medium text-white outline-none transition placeholder:text-[#7480A4] focus:border-[#73E8F4] focus:ring-2 focus:ring-[#73E8F4]/15 disabled:opacity-50"
      />
      {loading && <span className="pointer-events-none absolute right-4 top-4 text-xs text-[#73E8F4]">Searching…</span>}
      {open && !disabled && (results.length > 0 || error) && (
        <div id={listId} role="listbox" className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-[min(18rem,42vh)] overflow-y-auto overscroll-contain rounded-xl border border-white/15 bg-[#171C33] p-1.5 shadow-2xl">
          {error && <p className="px-3 py-3 text-sm text-[#FF70B7]">{error}</p>}
          {results.map((result, index) => (
            <button
              key={result.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onSelect(result); setOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${index === active ? "bg-[#73E8F4]/15 text-[#73E8F4]" : "text-white hover:bg-white/10"}`}
            >
              {result.image ? (
                // AniList cover images are only used for search suggestions, never as the screenshot clue.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.image} alt="" className="h-11 w-8 shrink-0 rounded object-cover" />
              ) : <span className="h-11 w-8 shrink-0 rounded bg-white/10" />}
              <span>{result.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScreenshotGuesserPage() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [screenshotIndex, setScreenshotIndex] = useState(0);
  const [maxUnlockedIndex, setMaxUnlockedIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [gaveUp, setGaveUp] = useState(false);
  const [message, setMessage] = useState("");
  const [wins, setWins] = useState(0);
  const [played, setPlayed] = useState(0);
  const recentIds = useRef<number[]>([]);
  const submitRef = useRef<() => void>(() => {});

  useEffect(() => {
    const controller = new AbortController();
    async function loadRound() {
      setLoading(true);
      setLoadError("");
      setImageFailed(false);
      setScreenshotIndex(0);
      setMaxUnlockedIndex(0);
      setQuestion(null);
      setGuesses([]);
      setInput("");
      setSelected(null);
      setGaveUp(false);
      setMessage("");
      try {
        const exclude = recentIds.current.join(",");
        const response = await fetch(`/api/screenshots/round?exclude=${encodeURIComponent(exclude)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.question) throw new Error(data.error || "Couldn't load a screenshot.");
        if (controller.signal.aborted) return;
        const next: Question = data.question;
        setQuestion(next);
        recentIds.current = [...recentIds.current.filter((id) => id !== next.id), next.id].slice(-20);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Could not load a round.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadRound();
    return () => controller.abort();
  }, [round]);

  const won = guesses.some((guess) => guess.correct);
  const finished = won || gaveUp || guesses.length >= MAX_GUESSES;
  const remaining = MAX_GUESSES - guesses.length;
  const screenshots = question?.screenshots ?? [];
  const canGoBack = screenshotIndex > 0;
  const canGoForward = screenshotIndex < Math.min(maxUnlockedIndex, screenshots.length - 1);
  const canRevealNext = maxUnlockedIndex + 1 < screenshots.length;

  const goToScreenshot = (index: number) => {
    if (index < 0 || index > maxUnlockedIndex || index >= screenshots.length) return;
    setScreenshotIndex(index);
    setImageFailed(false);
  };

  const revealNextScreenshot = () => {
    if (!question || maxUnlockedIndex + 1 >= question.screenshots.length) return false;
    const next = maxUnlockedIndex + 1;
    setMaxUnlockedIndex(next);
    setScreenshotIndex(next);
    setImageFailed(false);
    return true;
  };

  const submitGuess = useCallback(() => {
    const label = input.trim();
    if (!question || loading || finished || !label) return;
    if (label.length < 2) { setMessage("Enter an anime title to guess."); return; }
    const id = selected?.label === input ? selected.id : null;
    const normalized = normalize(label);
    if (guesses.some((guess) => !guess.skipped && ((id !== null && guess.id === id) || normalize(guess.label) === normalized))) {
      setMessage("You've already guessed that anime.");
      return;
    }
    const correct =
      id === question.id ||
      (selected?.label === input && selected.seriesId === question.seriesId) ||
      [...question.aliases, ...(question.seriesAliases ?? [])].some((alias) => normalize(alias) === normalized);
    const nextGuess: Guess = { id, label: selected?.label === input ? selected.label : label, correct };
    const nextGuesses = [...guesses, nextGuess];
    setGuesses(nextGuesses);
    setInput("");
    setSelected(null);
    if (!correct && nextGuesses.length < MAX_GUESSES) {
      if (maxUnlockedIndex + 1 < question.screenshots.length) {
        revealNextScreenshot();
        setMessage("Not quite — here's another screenshot from the same anime!");
      } else {
        setMessage("Not quite! No additional screenshots are available for this anime.");
      }
    } else {
      setMessage(correct ? "You got it!" : "Out of turns!");
    }
    if (correct) {
      setWins((n) => n + 1);
      setPlayed((n) => n + 1);
    } else if (nextGuesses.length >= MAX_GUESSES) {
      setPlayed((n) => n + 1);
    }
  }, [input, selected, question, loading, finished, guesses, maxUnlockedIndex]);

  useEffect(() => { submitRef.current = submitGuess; }, [submitGuess]);
  const skipTurn = () => {
    if (finished || loading || !question) return;
    if (!canRevealNext) {
      setMessage("There are no more screenshots to reveal for this anime.");
      return;
    }
    const nextGuesses = [...guesses, { id: null, label: "Skipped turn", correct: false, skipped: true }];
    setGuesses(nextGuesses);
    revealNextScreenshot();
    setInput("");
    setSelected(null);
    setImageFailed(false);
    setMessage(nextGuesses.length >= MAX_GUESSES ? "Out of turns!" : "Turn skipped — here's a new screenshot!");
    if (nextGuesses.length >= MAX_GUESSES) setPlayed((count) => count + 1);
  };

  const giveUp = () => {
    if (finished || !question) return;
    setGaveUp(true);
    setPlayed((n) => n + 1);
    setMessage("");
  };

  return (
    <main className="min-h-screen bg-[#080B18] px-3 py-3 text-white sm:px-5 sm:py-4 lg:px-8">
      <div className="mx-auto w-full max-w-[1120px]">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <a href="/" className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF4FA3] to-[#8C5BFF] shadow-lg shadow-pink-500/20">
                <span className="text-lg">✦</span>
              </div>
              <div>
                <div className="text-base font-black tracking-[0.14em] sm:text-lg">
                  ANI<span className="text-[#FF70B7]">*</span>STAR
                </div>
                <div className="hidden text-[10px] font-semibold tracking-[0.2em] text-[#8993B8] sm:block">
                  YOUR ANIME. YOUR STAGE.
                </div>
              </div>
            </a>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Screenshot <span className="text-[#73E8F4]">Guess</span>
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#AAB3D1] sm:text-sm">
              Recognize the anime from episode screenshots. Each wrong guess unlocks another image.
              Browse unlocked screenshots freely; you have {MAX_GUESSES} turns, including skips.
            </p>
          </div>
          <div className="rounded-xl border border-[#73E8F4]/20 bg-[#73E8F4]/5 px-4 py-2">
            <p className="text-xs uppercase tracking-widest text-[#AAB3D1]">Round {round + 1}</p>
            <p className="mt-0.5 text-base font-bold text-[#73E8F4]">
              {question ? `${remaining} / ${MAX_GUESSES} turns left` : "Loading…"}
            </p>
          </div>
        </header>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#73E8F4] to-[#FF70B7] transition-all duration-500"
            style={{ width: `${(guesses.length / MAX_GUESSES) * 100}%` }}
          />
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-[#111629] px-3 py-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8692B5]">Played</p>
            <p className="mt-0.5 text-lg font-black text-white">{played}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111629] px-3 py-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8692B5]">Won</p>
            <p className="mt-0.5 text-lg font-black text-[#73E8F4]">{wins}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111629] px-3 py-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8692B5]">Turns left</p>
            <p className="mt-0.5 text-lg font-black text-[#FF70B7]">{question ? remaining : "—"}</p>
          </div>
        </div>

        <section className="relative z-10 overflow-visible rounded-2xl border border-white/10 bg-[#101426] shadow-[0_20px_80px_rgba(0,0,0,0.22)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5 sm:px-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.17em] text-[#73E8F4]">Screenshot challenge</p>
              <p className="mt-1 text-xs text-[#8E9BBC]">Episode thumbnails provided through AniList</p>
            </div>
            <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#AAB3D1]">{finished ? "Round complete" : question ? `Viewing ${screenshotIndex + 1} · ${Math.min(maxUnlockedIndex + 1, question.screenshots.length)} unlocked of ${question.screenshots.length}` : "Identify the anime"}</span>
          </div>

          <div className="p-3 sm:p-4">
            <div className="relative mx-auto flex aspect-video h-auto max-h-[42vh] w-full max-w-[min(780px,74.667vh)] items-center justify-center overflow-hidden rounded-xl border border-[#73E8F4]/15 bg-[#080C17]">
              {loading ? (
                <div className="text-center text-[#AAB3D1]"><p className="text-3xl">✦</p><p className="mt-3 text-sm">Loading screenshot…</p></div>
              ) : loadError ? (
                <div className="px-5 text-center"><p className="font-semibold text-[#FF70B7]">{loadError}</p><button type="button" onClick={() => setRound((n) => n + 1)} className="mt-4 rounded-xl bg-[#73E8F4] px-5 py-2.5 text-sm font-bold text-[#09101F]">Try again</button></div>
              ) : imageFailed ? (
                <div className="px-5 text-center">
                  <p className="font-semibold text-[#FF70B7]">The image host isn't allowing this screenshot to load.</p>
                  {question && (canGoBack || canGoForward || canRevealNext) ? (
                    <button type="button" onClick={() => { if (canGoForward) goToScreenshot(screenshotIndex + 1); else if (canGoBack) goToScreenshot(screenshotIndex - 1); else revealNextScreenshot(); }} className="mt-4 rounded-xl bg-[#73E8F4] px-5 py-2.5 text-sm font-bold text-[#09101F]">Try another screenshot</button>
                  ) : (
                    <button type="button" onClick={() => setRound((n) => n + 1)} className="mt-4 rounded-xl bg-[#73E8F4] px-5 py-2.5 text-sm font-bold text-[#09101F]">Try another anime</button>
                  )}
                </div>
              ) : question ? (
                // The source may be hosted by a streaming partner. Using a native img avoids configuring remotePatterns.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={question.screenshots[screenshotIndex]} src={question.screenshots[screenshotIndex]} alt={`Mystery anime screenshot ${screenshotIndex + 1}`} referrerPolicy="no-referrer" onError={() => setImageFailed(true)} className="h-full w-full object-contain" />
              ) : null}
            </div>
            {question && !loading && !loadError && (
              <nav aria-label="Browse unlocked screenshots" className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                <button type="button" onClick={() => goToScreenshot(screenshotIndex - 1)} disabled={!canGoBack} aria-label="Previous screenshot" className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:border-[#73E8F4]/40 hover:text-[#73E8F4] disabled:cursor-not-allowed disabled:opacity-30">← Previous</button>
                <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5">
                  {question.screenshots.map((_, index) => {
                    const unlocked = index <= maxUnlockedIndex;
                    return (
                      <button key={index} type="button" onClick={() => goToScreenshot(index)} disabled={!unlocked} aria-label={`Screenshot ${index + 1}${unlocked ? "" : " (locked)"}`} aria-current={index === screenshotIndex ? "true" : undefined} title={unlocked ? `View screenshot ${index + 1}` : "Unlock by guessing or skipping"} className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-xs font-black transition ${index === screenshotIndex ? "border-[#73E8F4] bg-[#73E8F4]/15 text-[#73E8F4]" : unlocked ? "border-white/15 bg-white/5 text-[#AAB3D1] hover:border-[#73E8F4]/40 hover:text-white" : "cursor-not-allowed border-white/5 bg-white/[0.02] text-[#58617D]"}`}>
                        {unlocked ? index + 1 : "🔒"}
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => goToScreenshot(screenshotIndex + 1)} disabled={!canGoForward} aria-label="Next unlocked screenshot" className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:border-[#73E8F4]/40 hover:text-[#73E8F4] disabled:cursor-not-allowed disabled:opacity-30">Next →</button>
              </nav>
            )}
            <p className="mt-2 text-center text-[11px] text-[#7985A7]">Browse unlocked screenshots for free. Unlock new ones by guessing or skipping a turn.</p>
          </div>

          {question && !loading && !imageFailed && (
            <div className="border-t border-white/10 px-4 py-3 sm:px-5 sm:py-4">
              {guesses.length >= 2 && !finished && (
                <div className="mb-4 flex flex-wrap gap-2 text-xs">
                  {question.year && <span className="rounded-lg border border-[#73E8F4]/20 bg-[#73E8F4]/10 px-3 py-2 font-semibold text-[#73E8F4]">Year: {question.year}</span>}
                  {guesses.length >= 4 && question.genres[0] && <span className="rounded-lg border border-[#73E8F4]/20 bg-[#73E8F4]/10 px-3 py-2 font-semibold text-[#73E8F4]">Genre: {question.genres[0]}</span>}
                </div>
              )}
              {!finished ? (
                <>
                  <label htmlFor="screenshot-anime-title" className="mb-2 block text-sm font-bold">Which anime is this?</label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <AnimeAutocomplete
                      value={input}
                      selected={selected}
                      disabled={finished}
                      onChange={(value) => { setInput(value); setSelected(null); setMessage(""); }}
                      onSelect={(suggestion) => { setInput(suggestion.label); setSelected(suggestion); setMessage(""); }}
                      onEnter={() => submitRef.current()}
                    />
                    <button type="button" onClick={submitGuess} disabled={!input.trim()} className="rounded-xl bg-[#73E8F4] px-7 py-3.5 text-sm font-black text-[#09101F] transition hover:bg-[#A9F7FF] disabled:cursor-not-allowed disabled:opacity-40">Guess anime</button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p role="status" className="text-xs text-[#AAB3D1]">{message || "Wrong guess = next screenshot. Skipping also costs one turn."}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={skipTurn} disabled={!canRevealNext} title={!canRevealNext ? "No additional screenshots available" : "Use one turn to reveal a new screenshot"} className="rounded-lg border border-[#73E8F4]/30 bg-[#73E8F4]/5 px-4 py-2 text-xs font-bold text-[#73E8F4] transition hover:bg-[#73E8F4]/10 disabled:cursor-not-allowed disabled:opacity-40">Skip turn →</button>
                      <button type="button" onClick={giveUp} className="rounded-lg border border-[#FF70B7]/30 px-4 py-2 text-xs font-bold text-[#FF70B7] transition hover:bg-[#FF70B7]/10">Give up</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className={`rounded-2xl border p-5 text-center ${won ? "border-[#73E8F4]/30 bg-[#73E8F4]/10" : "border-[#FF70B7]/25 bg-[#FF70B7]/5"}`}>
                  <p className={`text-sm font-black ${won ? "text-[#73E8F4]" : "text-[#FF70B7]"}`}>{won ? "Correct! You recognized the series!" : gaveUp ? "Answer revealed" : "Out of guesses"}</p>
                  <h2 className="mt-2 text-xl font-black sm:text-2xl">{question.title}</h2>
                  <p className="mt-2 text-xs text-[#AAB3D1]">{won ? `Solved in ${guesses.length} ${guesses.length === 1 ? "turn" : "turns"}. Screenshots from: ${question.title}` : "You'll get it next time."}</p>
                  <button type="button" onClick={() => setRound((n) => n + 1)} className="mt-5 rounded-xl bg-[#73E8F4] px-7 py-3 text-sm font-black text-[#09101F] transition hover:bg-[#A9F7FF]">Next screenshot →</button>
                </div>
              )}
            </div>
          )}
        </section>

        {guesses.length > 0 && (
          <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#101426]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 sm:px-5">
              <h2 className="font-black">Your turns</h2>
              <span className="text-xs font-semibold text-[#8692B5]">{guesses.length} / {MAX_GUESSES}</span>
            </div>
            <div className="divide-y divide-white/5">
              {guesses.map((guess, index) => (
                <div key={`${index}-${guess.label}`} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${guess.correct ? "bg-[#73E8F4]/15 text-[#73E8F4]" : guess.skipped ? "bg-white/10 text-[#AAB3D1]" : "bg-[#FF70B7]/10 text-[#FF70B7]"}`}>{index + 1}</span>
                  <span className="min-w-0 flex-1 break-words text-sm font-semibold">{guess.label}</span>
                  <span className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-black ${guess.correct ? "border-[#73E8F4]/30 bg-[#73E8F4]/10 text-[#73E8F4]" : guess.skipped ? "border-white/15 bg-white/5 text-[#AAB3D1]" : "border-[#FF70B7]/20 bg-[#FF70B7]/5 text-[#FF70B7]"}`}>{guess.correct ? "✓ Correct" : guess.skipped ? "↷ Skipped" : "✕ Wrong"}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-5 text-[#7480A4]">Episode thumbnails are supplied by third-party streaming services through AniList. Some images may be unavailable, contain text, or be blocked by the original host.</p>
      </div>
    </main>
  );
}
