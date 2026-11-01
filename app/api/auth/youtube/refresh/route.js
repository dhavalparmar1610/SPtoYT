import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSession, saveSession } from '@/lib/db';

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const YOUTUBE_REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;

export async function POST(request) {
  try {
    let refreshToken = null;
    try {
      const body = await request.json();
      refreshToken = body?.refresh_token;
    } catch {
      // Body may be empty if reading from stored session
    }

    if (!refreshToken) {
      const session = getSession('default');
      refreshToken = session?.youtube_refresh_token;
    }

    if (!refreshToken) {
      return NextResponse.json({ success: false, error: 'No refresh token available' }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      YOUTUBE_CLIENT_ID,
      YOUTUBE_CLIENT_SECRET,
      YOUTUBE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    const newAccessToken = credentials.access_token;
    const newExpiry = credentials.expiry_date || Date.now() + 3600 * 1000;
    const finalRefreshToken = credentials.refresh_token || refreshToken;

    // Persist to SQLite
    saveSession({
      youtube_access_token: newAccessToken,
      youtube_refresh_token: finalRefreshToken,
      youtube_expiry_date: newExpiry
    }, 'default');

    return NextResponse.json({
      success: true,
      access_token: newAccessToken,
      refresh_token: finalRefreshToken,
      expiry_date: newExpiry
    });
  } catch (error) {
    console.error('Error refreshing YouTube access token:', error?.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to refresh token'
    }, { status: 500 });
  }
}

