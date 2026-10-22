"use client";

import { useCallback, useEffect, useRef, useState } from "react";
type Choice = {
  id: number;
  title: string;
};

type Question = {
  questionToken: string;
  image: string;
  choices: Choice[];
};

export default function GamePage() {
  const initialLoadStarted = useRef(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadQuestion = useCallback(async () => {
    setLoading(true);
    setSelected(null);
    setCorrect(null);
    setQuestion(null);
    setError(null);

    try {
      const response = await fetch("/api/game/question", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Couldn't load an anime question.");
      }

      setQuestion(data);
      setRound((value) => (value === 0 ? 1 : value + 1));
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
  void loadQuestion();
}, [loadQuestion]);

  async function submitAnswer(id: number) {
    if (!question || selected !== null || submitting) return;

    setSelected(id);
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/game/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionToken: question.questionToken,
          answerId: id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Couldn't check your answer.");
      }

      setCorrect(result.correct);

      if (result.correct) {
        setScore((value) => value + 1);
      }
    } catch (err) {
      setSelected(null);
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const answered = selected !== null && correct !== null;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#090B1D] text-white selection:bg-[#FF4FA3]/40">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#FF4FA3]/10 blur-[110px]" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-[#73E8F4]/10 blur-[120px]" />
        <div className="absolute bottom-[-180px] left-1/3 h-80 w-80 rounded-full bg-violet-600/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <a href="/" className="group flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF4FA3] to-[#8C5BFF] shadow-lg shadow-pink-500/20">
              <span className="text-xl">✦</span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-black tracking-[0.14em] sm:text-xl">
                ANI<span className="text-[#FF70B7]">*</span>STAR
              </div>
              <div className="hidden text-[10px] font-semibold tracking-[0.2em] text-[#8993B8] sm:block">
                YOUR ANIME. YOUR STAGE.
              </div>
            </div>
          </a>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 sm:px-4">
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#929CBD]">
                Round
              </div>
              <div className="text-sm font-bold tabular-nums">{round}</div>
            </div>
            <div className="rounded-xl border border-[#FFD978]/20 bg-[#FFD978]/[0.07] px-3 py-2 sm:px-4">
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#FFD978]/70">
                Score
              </div>
              <div className="text-sm font-bold tabular-nums text-[#FFD978]">
                {score}
              </div>
            </div>
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-5 lg:py-6">
          <div className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
            <div>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#FF70B7]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF70B7] shadow-[0_0_10px_#FF70B7]" />
                AniList challenge
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                Cover <span className="text-[#73E8F4]">Challenge</span>
              </h1>
              <p className="mt-1 text-xs text-[#929CBD] sm:text-sm">
                One cover. Four choices. How well do you know your list?
              </p>
            </div>
            <div className="hidden rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] text-[#AAB3D1] sm:block">
              ✦ PERSONAL ANIME POOL
            </div>
          </div>

          {error ? (
            <div className="rounded-3xl border border-[#FF70B7]/20 bg-[#171329]/90 p-8 text-center sm:p-12">
              <div className="mb-4 text-4xl">✦</div>
              <h2 className="text-xl font-bold">A little plot twist...</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#AAB3D1]">
                {error}
              </p>
              <button
                onClick={() => void loadQuestion()}
                className="mt-6 rounded-xl bg-gradient-to-r from-[#FF4FA3] to-[#B56BFF] px-6 py-3 text-sm font-bold shadow-lg shadow-pink-500/20 transition hover:brightness-110"
              >
                Try again ↗
              </button>
            </div>
          ) : loading ? (
            <div className="flex min-h-[340px] flex-1 flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-[#11152B]/80">
              <div className="mb-5 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#FF70B7]" />
              <p className="font-semibold">Preparing your next challenge...</p>
              <p className="mt-2 text-xs text-[#929CBD]">
                Picking from your AniList
              </p>
            </div>
          ) : question ? (
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-6">
              <div className="relative flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/[0.09] bg-[#11152B]/90 p-3 shadow-2xl shadow-black/20 sm:p-4">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#929CBD]">
                    Mystery artwork
                  </span>
                  <span className="rounded-full border border-[#73E8F4]/20 bg-[#73E8F4]/[0.06] px-2.5 py-1 text-[9px] font-bold tracking-wider text-[#73E8F4]">
                    IDENTIFY
                  </span>
                </div>

                <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-[#090B1D]">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#FF4FA3]/[0.06] via-transparent to-[#73E8F4]/[0.06]" />
                  <img
                    src={question.image}
                    alt="Mystery anime cover"
                    className="relative h-full max-h-[36dvh] w-full object-contain sm:max-h-[43dvh] lg:max-h-[60dvh]"
                  />
                </div>

                <div className="mt-3 flex items-center justify-between px-1">
                  <span className="text-[10px] text-[#929CBD]">
                    Think you recognize it?
                  </span>
                  <span className="text-xs text-[#FF70B7]">✦ ✦ ✦</span>
                </div>
              </div>

              <div className="flex min-h-0 flex-col rounded-3xl border border-white/[0.09] bg-[#11152B]/90 p-4 sm:p-5 lg:p-6">
                <div className="mb-4 sm:mb-6">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#73E8F4]">
                    Choose your answer
                  </p>
                  <h2 className="text-xl font-extrabold leading-tight sm:text-2xl">
                    Which anime is this?
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-[#929CBD]">
                    Select the correct title from the options below.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {question.choices.map((choice, index) => {
                    const isSelected = selected === choice.id;

                    let style =
                      "border-white/[0.09] bg-white/[0.025] hover:border-[#FF70B7]/50 hover:bg-[#FF70B7]/[0.06]";

                    if (answered && isSelected && correct) {
                      style =
                        "border-emerald-400/60 bg-emerald-400/10 text-emerald-200";
                    } else if (answered && isSelected && !correct) {
                      style =
                        "border-rose-400/60 bg-rose-400/10 text-rose-200";
                    } else if (selected !== null && !isSelected) {
                      style = "border-white/[0.04] bg-white/[0.01] opacity-40";
                    } else if (isSelected) {
                      style = "border-[#FF70B7]/60 bg-[#FF70B7]/10";
                    }

                    return (
                      <button
                        key={choice.id}
                        disabled={selected !== null || submitting}
                        onClick={() => void submitAnswer(choice.id)}
                        className={`group flex min-h-[54px] items-center gap-3 rounded-2xl border p-3 text-left transition duration-200 disabled:cursor-default sm:min-h-[62px] sm:p-4 ${style}`}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/10 text-xs font-black text-[#AAB3D1] transition group-hover:border-[#FF70B7]/40 group-hover:text-[#FF70B7]">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="min-w-0 flex-1 text-xs font-semibold leading-snug sm:text-sm">
                          {choice.title}
                        </span>
                        {answered && isSelected && (
                          <span className="text-lg">
                            {correct ? "✓" : "×"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-auto pt-5">
                  {answered ? (
                    <div
                      className={`mb-3 rounded-xl border p-3 text-sm font-bold ${
                        correct
                          ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
                          : "border-rose-400/20 bg-rose-400/[0.06] text-rose-300"
                      }`}
                    >
                      {correct
                        ? "✦ Correct! Your anime knowledge shines."
                        : "Not quite! Ready for the next one?"}
                    </div>
                  ) : (
                    <div className="mb-3 flex items-center gap-2 text-[10px] text-[#929CBD]">
                      <span className="text-[#FFD978]">★</span>
                      One point for every correct answer
                    </div>
                  )}

                  <button
                    onClick={() => void loadQuestion()}
                    disabled={!answered || loading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF4FA3] via-[#E65DCE] to-[#9B75FF] p-3.5 text-sm font-extrabold shadow-lg shadow-pink-500/10 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30 sm:p-4"
                  >
                    Next anime <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.08] pt-3 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#707B9F] sm:text-[10px]">
          <span>Made for anime fans ✦</span>
          <span className="text-right">Powered by your AniList</span>
        </footer>
      </div>
    </main>
  );
}
