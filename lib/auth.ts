import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "anime_guesser_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  return new TextEncoder().encode(secret);
}

export type Session = {
  accessToken: string;
  userId: number;
  username: string;
  avatar: string;
};

export async function createSession(session: Session) {
  const token = await new EncryptJWT(session)
    .setProtectedHeader({
      alg: "dir",
      enc: "A256GCM",
    })
    .setIssuedAt()
    .setExpirationTime("1y")
    .encrypt(getSecret());

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtDecrypt(token, getSecret());

    if (
  typeof payload.accessToken !== "string" ||
  typeof payload.userId !== "number" ||
  typeof payload.username !== "string" ||
  typeof payload.avatar !== "string"
) {
  return null;
}

return {
  accessToken: payload.accessToken,
  userId: payload.userId,
  username: payload.username,
  avatar: payload.avatar,
};
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE);
}