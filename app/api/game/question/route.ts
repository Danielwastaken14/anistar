import { NextResponse } from "next/server";
import { EncryptJWT } from "jose";

import { getSession } from "@/lib/auth";
import { getUserAnime } from "@/lib/anilist";
import {
  createQuestion,
  getPlayableAnime,
} from "@/lib/game";

function getSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET!
  );
}

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    const entries = await getUserAnime(
      session.accessToken,
      session.userId
    );

    const anime = getPlayableAnime(entries);

    if (anime.length < 4) {
      return NextResponse.json(
        {
          error:
            "You need at least 4 watched anime to play.",
        },
        { status: 400 }
      );
    }

    const question = createQuestion(anime);

    /*
     * Encrypt the answer instead of sending it to the browser.
     *
     * The browser gets the encrypted token but cannot read
     * the correct answer.
     */
    const questionToken = await new EncryptJWT({
      answerId: question.answer.id,
    })
      .setProtectedHeader({
        alg: "dir",
        enc: "A256GCM",
      })
      .setIssuedAt()
      .setExpirationTime("10m")
      .encrypt(getSecret());

    return NextResponse.json({
      questionToken,

      image: question.answer.cover,

      choices: question.choices.map((choice) => ({
        id: choice.id,
        title: choice.title,
      })),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to create question" },
      { status: 500 }
    );
  }
}