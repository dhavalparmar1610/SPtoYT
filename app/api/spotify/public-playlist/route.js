import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Get an anonymous Spotify token — same one spotify.com uses in its web player.
 */
/**
 * Get an anonymous Spotify token.
 * Tries the official token endpoint first, then falls back to 'stealing' one from an embed page.
 */
async function getAnonymousToken(playlistId = '37i9dQZF1DXcBWIGoYBM5M') {
  try {
    const res = await axios.get('https://open.spotify.com/get_access_token', {
      params: { reason: 'transport', productType: 'web_player' },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://open.spotify.com/',
      },
      timeout: 5000,
    });
    if (res.data?.accessToken) return res.data.accessToken;
  } catch (e) {
    console.warn('Primary token method failed, trying Embed theft...');
  }

  // Fallback: Steal token from the specific playlist's embed page
  const embedRes = await axios.get(`https://open.spotify.com/embed/playlist/${playlistId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
  });
  const match = embedRes.data.match(/accessToken":"(.+?)"/);
  if (match) return match[1];

  throw new Error('Failed to obtain a valid Spotify session token');
}

/**
 * Extract playlist ID from various Spotify URL formats.
 */
function extractPlaylistId(input) {
  if (!input) return null;
  input = input.trim();
  const uriMatch = input.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (uriMatch) return uriMatch[1];
  const urlMatch = input.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9]{15,}$/.test(input)) return input;
  return null;
}

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const urlInput = searchParams.get('url');

  if (!urlInput) {
    return NextResponse.json({ error: 'Missing "url" query parameter' }, { status: 400 });
  }

  const decodedInput = decodeURIComponent(urlInput);
  const playlistId = extractPlaylistId(decodedInput);

  if (!playlistId) {
    return NextResponse.json({ error: 'Could not extract a valid playlist ID from the provided URL.' }, { status: 400 });
  }

  try {
    // 1. Get a token (either normally or stolen from embed)
    const token = await getAnonymousToken(playlistId);

    // 2. Fetch playlist metadata
    const playlistRes = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { fields: 'id,name,description,images,tracks.total' },
    });

    const playlist = playlistRes.data;
    const allTracks = [];
    
    // 3. Paginate through ALL tracks (not just the first 100)
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
    console.error(`Spotify Sync Error: ${err.message}`);
    
    // Final fallback: Use the basic scraper if the API method fails completely
    try {
      const { fetchPlaylistViaEmbed } = await import('./scraper_fallback'); // I'll move the scraper to a helper to keep this clean
      const result = await fetchPlaylistViaEmbed(playlistId);
      return NextResponse.json(result);
    } catch (fallbackErr) {
      return NextResponse.json({ 
        error: `Failed to load all tracks. Spotify might be blocking the request. (Error: ${err.message})` 
      }, { status: 500 });
    }
  }
}


