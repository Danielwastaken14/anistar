import Link from "next/link";
import { getSession } from "@/lib/auth";

export const instant = false;

export default async function HomePage() {
  const session = await getSession();

  // Keep the rest of your existing page unchanged.
  // Redirect unauthenticated users to the welcome screen,
  // not straight into a game.
  return (
    <main className="min-h-dvh overflow-hidden bg-[#090B1D] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#FF4FA3]/10 blur-[110px]" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-[#73E8F4]/10 blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link href="/" className="text-xl font-black tracking-widest">
            ANI<span className="text-[#FF70B7]">*</span>STAR
          </Link>

          

{session ? (
  <div className="flex items-center gap-3">
    <img
      src={session.avatar}
      alt={`${session.username}'s avatar`}
      className="h-9 w-9 rounded-full border border-[#73E8F4]/40 object-cover"
    />

    <span className="rounded-full border border-[#73E8F4]/20 bg-[#73E8F4]/5 px-3 py-2 text-xs text-[#73E8F4]">
      {session.username}
    </span>

    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-[#AAB3D1] transition hover:border-[#FF70B7]/50 hover:bg-[#FF70B7]/10 hover:text-white"
      >
        Log out
      </button>
    </form>
  </div>
) : (
  <Link
    href="/login"
    className="rounded-xl border border-[#73E8F4]/30 px-4 py-2 text-sm font-semibold text-[#73E8F4] transition hover:bg-[#73E8F4]/10"
  >
    Connect AniList
  </Link>
)}


        </header>

        <section className="flex flex-1 flex-col justify-center py-12">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-[#FF70B7]">
            ✦ Your personal anime arcade
          </p>

          <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
            How well do you know{" "}
            <span className="bg-gradient-to-r from-[#FF70B7] to-[#73E8F4] bg-clip-text text-transparent">
              your anime?
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-7 text-[#AAB3D1] sm:text-base">
            Test your memory with covers, characters, and series from your
            own AniList collection.
          </p>

          {session ? (
            <p className="mt-5 text-sm text-[#73E8F4]">
              Welcome back, {session.username}. Pick a mode and play.
            </p>
          ) : (
            <p className="mt-5 text-sm text-[#929CBD]">
              Connect AniList once to personalize your questions.
            </p>
          )}

          <div className="mt-9 grid gap-4 md:grid-cols-2">
            <Link
              href="/game"
              className="group rounded-3xl border border-[#FF70B7]/20 bg-[#151329]/90 p-6 transition hover:-translate-y-1 hover:border-[#FF70B7]/60 hover:bg-[#1A1732]"
            >
              <div className="text-3xl">🎴</div>
              <h2 className="mt-4 text-xl font-extrabold">Cover Challenge</h2>
              <p className="mt-2 text-sm leading-6 text-[#AAB3D1]">
                Identify an anime from its cover artwork.
              </p>
              <div className="mt-6 font-bold text-[#FF70B7]">
                Play cover mode <span className="inline-block transition group-hover:translate-x-1">→</span>
              </div>
            </Link>

            <Link
              href="/characters"
              className="group rounded-3xl border border-[#73E8F4]/20 bg-[#101A2B]/90 p-6 transition hover:-translate-y-1 hover:border-[#73E8F4]/60 hover:bg-[#142035]"
            >
              <div className="text-3xl">🌟</div>
              <h2 className="mt-4 text-xl font-extrabold">Character Quiz</h2>
              <p className="mt-2 text-sm leading-6 text-[#AAB3D1]">
                Name the character and the anime they come from.
              </p>
              <div className="mt-6 font-bold text-[#73E8F4]">
                Explore characters <span className="inline-block transition group-hover:translate-x-1">→</span>
              </div>
            </Link>
          </div>

          {!session && (
            <div className="mt-6">
              <Link
                href="/login"
                className="inline-flex rounded-xl bg-gradient-to-r from-[#FF4FA3] to-[#A66CFF] px-6 py-3 font-bold shadow-lg shadow-pink-500/15 transition hover:brightness-110"
              >
                Connect AniList to start →
              </Link>
            </div>
          )}
        </section>

        <footer className="border-t border-white/10 pt-4 text-xs text-[#707B9F]">
          Your anime list. Your challenges. Your stage.
        </footer>
      </div>
    </main>
  );
}
