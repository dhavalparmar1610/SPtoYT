import { NextResponse } from 'next/server';
import axios from 'axios';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const storedState = request.cookies.get('spotify_auth_state')?.value;

  if (error) {
    return NextResponse.redirect(`${NEXT_PUBLIC_APP_URL}/?error=${error}`);
  }

  if (state === null || state !== storedState) {
    return NextResponse.redirect(`${NEXT_PUBLIC_APP_URL}/?error=state_mismatch`);
  }

  try {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('redirect_uri', SPOTIFY_REDIRECT_URI);
    params.append('grant_type', 'authorization_code');

    const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`
      }
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Redirect back to frontend with tokens in URL
    const redirectUrl = new URL(NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.append('spotify_access_token', access_token);
    redirectUrl.searchParams.append('spotify_refresh_token', refresh_token);
    redirectUrl.searchParams.append('spotify_expires_in', expires_in);

    const response = NextResponse.redirect(redirectUrl.toString());
    response.cookies.delete('spotify_auth_state');
    return response;

  } catch (error) {
    console.error('Error exchanging Spotify code for token:', error.response?.data || error.message);
    return NextResponse.redirect(`${NEXT_PUBLIC_APP_URL}/?error=invalid_token`);
  }
}
