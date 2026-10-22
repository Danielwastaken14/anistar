import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.ANILIST_CLIENT_ID;
  const redirectUri = process.env.ANILIST_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return new Response(
      "AniList environment variables are missing.",
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
  });

  const url =
    `https://anilist.co/api/v2/oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(url);
}