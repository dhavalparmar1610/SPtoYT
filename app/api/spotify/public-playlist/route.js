import { NextResponse } from 'next/server';
import axios from 'axios';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

/**
 * Get a Client Credentials token from Spotify.
 * This does NOT require Premium — it only allows access to public data.
 */
async function getClientCredentialsToken() {
  const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    'grant_type=client_credentials',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`,
      },
    }
  );

  return res.data.access_token;
}

/**
 * Extract playlist ID from various Spotify URL formats:
 *  - https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
 *  - https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
 *  - spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
 *  - 37i9dQZF1DXcBWIGoYBM5M  (bare ID)
 */
function extractPlaylistId(input) {
  if (!input) return null;
  input = input.trim();

  // Spotify URI format
  const uriMatch = input.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (uriMatch) return uriMatch[1];

  // URL format
  const urlMatch = input.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];

  // Bare ID (alphanumeric, 22 chars typical)
  if (/^[a-zA-Z0-9]{15,}$/.test(input)) return input;

  return null;
}

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const urlInput = searchParams.get('url');

  if (!urlInput) {
    return NextResponse.json({ error: 'Missing "url" query parameter' }, { status: 400 });
  }

  // Decode in case the URL was double-encoded
  const decodedInput = decodeURIComponent(urlInput);

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error('Spotify credentials missing from environment variables!');
    return NextResponse.json({ 
      error: 'Server configuration error: Spotify credentials not set. Please add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to your environment variables.' 
    }, { status: 500 });
  }

  const playlistId = extractPlaylistId(decodedInput);
  if (!playlistId) {
    return NextResponse.json({ error: 'Could not extract a valid playlist ID from the provided URL' }, { status: 400 });
  }

  try {
    const token = await getClientCredentialsToken();

    // Fetch playlist metadata
    const playlistRes = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { fields: 'id,name,description,images,tracks.total' },
    });

    const playlist = playlistRes.data;

    // Fetch all tracks with pagination
    const allTracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=items(track(name,artists(name),album(name,images),duration_ms,external_ids)),next`;

    while (nextUrl) {
      const tracksRes = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const items = tracksRes.data.items || [];
      for (const item of items) {
        if (item.track) {
          allTracks.push({
            name: item.track.name,
            artist: item.track.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
            album: item.track.album?.name || '',
            albumArt: item.track.album?.images?.[0]?.url || null,
            duration_ms: item.track.duration_ms || 0,
          });
        }
      }

      nextUrl = tracksRes.data.next || null;
    }

    return NextResponse.json({
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description || '',
        image: playlist.images?.[0]?.url || null,
        totalTracks: playlist.tracks?.total || allTracks.length,
      },
      tracks: allTracks,
    });
  } catch (err) {
    const spotifyError = err.response?.data;
    const status = err.response?.status || 500;
    console.error(`Spotify API error [${status}]:`, JSON.stringify(spotifyError || err.message));

    let message;
    if (status === 401) {
      message = 'Spotify authentication failed. Check your SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET on Vercel.';
    } else if (status === 404) {
      message = 'Playlist not found. Make sure the URL is correct and the playlist is set to Public.';
    } else if (status === 403) {
      message = 'Access denied by Spotify. The playlist may be private, or your Spotify app credentials are invalid.';
    } else {
      message = `Failed to fetch playlist from Spotify (${status}).`;
    }

    return NextResponse.json({ error: message }, { status });
  }
}
