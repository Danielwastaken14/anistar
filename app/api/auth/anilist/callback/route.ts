
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";

const ANILIST_TOKEN_URL = "https://anilist.co/api/v2/oauth/token";
const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/login?error=auth", origin));
  }

  const clientId = process.env.ANILIST_CLIENT_ID;
  const clientSecret = process.env.ANILIST_CLIENT_SECRET;
  const redirectUri = process.env.ANILIST_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("AniList OAuth environment variables are missing.");
    return NextResponse.redirect(new URL("/login?error=config", origin));
  }

  try {
    const tokenResponse = await fetch(ANILIST_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      console.error("AniList token exchange failed:", tokenResponse.status);
      return NextResponse.redirect(new URL("/login?error=token", origin));
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (typeof accessToken !== "string") {
      return NextResponse.redirect(new URL("/login?error=token", origin));
    }

    const viewerResponse = await fetch(ANILIST_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: `
          query {
            Viewer {
              id
              name
              avatar {
                large
              }
            }
          }
        `,
      }),
      cache: "no-store",
    });

    if (!viewerResponse.ok) {
      console.error("AniList profile request failed:", viewerResponse.status);
      return NextResponse.redirect(new URL("/login?error=profile", origin));
    }

    const viewerData = await viewerResponse.json();
    const viewer = viewerData.data?.Viewer;

    if (
      typeof viewer?.id !== "number" ||
      typeof viewer?.name !== "string"
    ) {
      return NextResponse.redirect(new URL("/login?error=profile", origin));
    }

    await createSession({
      accessToken,
      userId: viewer.id,
      username: viewer.name,
      avatar:
        typeof viewer.avatar?.large === "string"
          ? viewer.avatar.large
          : "",
    });

    return NextResponse.redirect(new URL("/", origin));
  } catch (err) {
    console.error("AniList OAuth callback failed:", err);
    return NextResponse.redirect(new URL("/login?error=auth", origin));
  }
}
