import { NextRequest, NextResponse } from "next/server";
import { jwtDecrypt } from "jose";

import { getSession } from "@/lib/auth";

function getSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET!
  );
}

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const body = await request.json();

  const {
    questionToken,
    answerId,
  }: {
    questionToken?: string;
    answerId?: number;
  } = body;

  if (!questionToken || typeof answerId !== "number") {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }

  try {
    const { payload } = await jwtDecrypt(
      questionToken,
      getSecret()
    );

    const correctAnswerId = payload.answerId;

    if (typeof correctAnswerId !== "number") {
      throw new Error("Invalid question token");
    }

    const correct = answerId === correctAnswerId;

    return NextResponse.json({
      correct,
      correctAnswerId,
    });
  } catch {
    return NextResponse.json(
      { error: "Question expired or invalid" },
      { status: 400 }
    );
  }
}