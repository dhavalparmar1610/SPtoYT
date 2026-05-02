import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Get an anonymous Spotify token — same one spotify.com uses in its web player.
 * Does NOT require client credentials or a Premium subscription.
 */
async function getAnonymousToken() {
  const res = await axios.get('https://open.spotify.com/get_access_token', {
    params: {
      reason: 'transport',
      productType: 'web_player',
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en',
      'spotify-app-version': '1.2.46.424.g1ef04de4',
      'app-platform': 'WebPlayer',
      'Referer': 'https://open.spotify.com/',
    },
  });

  if (!res.data?.accessToken) {
    throw new Error('Failed to obtain anonymous Spotify token');
  }

  return res.data.accessToken;
}

/**
 * Extract playlist ID from various Spotify URL formats.
 */
function extractPlaylistId(input) {
  if (!input) return null;
  input = input.trim();

  // Spotify URI format: spotify:playlist:ID
  const uriMatch = input.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (uriMatch) return uriMatch[1];

  // URL format: https://open.spotify.com/playlist/ID
  const urlMatch = input.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];

  // Bare ID (alphanumeric, 15+ chars)
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
  const playlistId = extractPlaylistId(decodedInput);

  if (!playlistId) {
    return NextResponse.json({ error: 'Could not extract a valid playlist ID from the provided URL.' }, { status: 400 });
  }

  try {
    const token = await getAnonymousToken();

    // Fetch playlist metadata
    const playlistRes = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { fields: 'id,name,description,images,tracks.total' },
    });

    const playlist = playlistRes.data;

    // Fetch all tracks with pagination
    const allTracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=items(track(name,artists(name),album(name,images),duration_ms)),next`;

    while (nextUrl) {
      const tracksRes = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const items = tracksRes.data.items || [];
      for (const item of items) {
        if (item?.track?.name) {
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
    const status = err.response?.status || 500;
    const spotifyMsg = err.response?.data?.error?.message || err.message;
    console.error(`Spotify anonymous API error [${status}]:`, spotifyMsg);

    let message;
    if (status === 404) {
      message = 'Playlist not found. Make sure the URL is correct and the playlist is set to Public.';
    } else if (status === 401 || status === 403) {
      message = 'Could not access this playlist. Make sure it is set to Public on Spotify.';
    } else {
      message = `Failed to fetch playlist (${status}): ${spotifyMsg}`;
    }

    return NextResponse.json({ error: message }, { status });
  }
}


