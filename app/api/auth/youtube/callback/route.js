import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { saveSession } from '@/lib/db';

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const YOUTUBE_REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${NEXT_PUBLIC_APP_URL}/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${NEXT_PUBLIC_APP_URL}/?error=no_code`);
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      YOUTUBE_CLIENT_ID,
      YOUTUBE_CLIENT_SECRET,
      YOUTUBE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    // Save tokens in SQLite / persistent server session
    saveSession({
      youtube_access_token: tokens.access_token || '',
      youtube_refresh_token: tokens.refresh_token || '',
      youtube_expiry_date: tokens.expiry_date || Date.now() + 3600 * 1000
    }, 'default');

    // Redirect back to frontend with tokens in URL
    const redirectUrl = new URL(NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.append('youtube_access_token', tokens.access_token || '');
    if (tokens.refresh_token) {
      redirectUrl.searchParams.append('youtube_refresh_token', tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      redirectUrl.searchParams.append('youtube_expiry_date', tokens.expiry_date.toString());
    }

    const response = NextResponse.redirect(redirectUrl.toString());
    
    // Set cookie as additional persistent backup
    response.cookies.set('yt_logged_in', '1', {
      maxAge: 365 * 24 * 3600,
      path: '/',
      sameSite: 'lax'
    });

    return response;

  } catch (error) {
    console.error('Error exchanging YouTube code for token:', error.message);
    return NextResponse.redirect(`${NEXT_PUBLIC_APP_URL}/?error=youtube_invalid_token`);
  }
}
