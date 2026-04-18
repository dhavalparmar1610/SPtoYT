import { NextResponse } from 'next/server';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

export async function GET() {
  const scopes = [
    'playlist-read-private',
    'user-read-email',
    'user-read-private'
  ].join(' ');

  const state = Math.random().toString(36).substring(7);

  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', SPOTIFY_CLIENT_ID || '');
  authUrl.searchParams.append('scope', scopes);
  authUrl.searchParams.append('redirect_uri', SPOTIFY_REDIRECT_URI || '');
  authUrl.searchParams.append('state', state);

  const response = NextResponse.redirect(authUrl.toString());
  // Store state in a cookie to verify in the callback
  response.cookies.set('spotify_auth_state', state, { maxAge: 3600, path: '/' });

  return response;
}
