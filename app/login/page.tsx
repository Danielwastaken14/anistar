import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const instant = false;

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/");
  }

  // Keep your existing login-page JSX here.

  return (
    <main className="min-h-screen bg-[#090B1D] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <Link
          href="/"
          className="text-sm text-[#AAB3D1] transition hover:text-white"
        >
          ← Back to home
        </Link>

        <h1 className="mt-6 text-5xl font-black tracking-tight">
          STAR<span className="text-[#FF70B7]">//</span>GUESS
        </h1>

        <p className="mt-4 text-[#AAB3D1]">
          Guess anime from your own AniList history.
        </p>

        <a
          href="/api/auth/anilist/login"
          className="mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF4FA3] to-[#A66CFF] px-6 py-3 font-semibold transition hover:brightness-110"
        >
          Login with AniList
        </a>
      </div>
    </main>
  );
}