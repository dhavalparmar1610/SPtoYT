import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Get an anonymous Spotify token — same one spotify.com uses in its web player.
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
      'Referer': 'https://open.spotify.com/',
    },
  });

  if (!res.data?.accessToken) {
    throw new Error('Failed to obtain anonymous Spotify token');
  }

  return res.data.accessToken;
}

/**
 * FALLBACK: Fetch playlist data by scraping the Spotify Embed page.
 * This is very reliable for public playlists and doesn't require any tokens.
 */
async function fetchPlaylistViaEmbed(playlistId) {
  const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    }
  });

  const html = res.data;
  
  // Look for the JSON payload in the script tag
  const match = html.match(/<script id="resource" type="application\/json">(.+?)<\/script>/);
  if (!match) {
    // Try the __NEXT_DATA__ format
    const nextMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
    if (!nextMatch) throw new Error('Could not find playlist data in embed page');
    
    const data = JSON.parse(nextMatch[1]);
    const playlist = data.props?.pageProps?.state?.data?.entity || {};
    const tracks = playlist.tracks?.items?.map(item => ({
      name: item.track?.name,
      artist: item.track?.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
      album: item.track?.album?.name || '',
      albumArt: item.track?.album?.images?.[0]?.url || null,
      duration_ms: item.track?.duration_ms || 0,
    })).filter(t => t.name) || [];

    return {
      playlist: {
        id: playlistId,
        name: playlist.name || 'Spotify Playlist',
        description: playlist.description || '',
        image: playlist.images?.[0]?.url || null,
        totalTracks: playlist.tracks?.total || tracks.length,
      },
      tracks
    };
  }

  const data = JSON.parse(match[1]);
  // The structure here is usually { name, description, images, tracks: { items: [...] } }
  const tracks = data.tracks?.items?.map(item => ({
    name: item.track?.name,
    artist: item.track?.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
    album: item.track?.album?.name || '',
    albumArt: item.track?.album?.images?.[0]?.url || null,
    duration_ms: item.track?.duration_ms || 0,
  })).filter(t => t.name) || [];

  return {
    playlist: {
      id: playlistId,
      name: data.name || 'Spotify Playlist',
      description: data.description || '',
      image: data.images?.[0]?.url || null,
      totalTracks: data.tracks?.total || tracks.length,
    },
    tracks
  };
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

  // Try standard Anonymous Token first
  try {
    const token = await getAnonymousToken();

    const playlistRes = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { fields: 'id,name,description,images,tracks.total' },
    });

    const playlist = playlistRes.data;
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
    console.warn(`Anonymous Token method failed for ${playlistId}, trying Embed Scraper fallback...`);
    
    // Fallback to Embed Scraper
    try {
      const result = await fetchPlaylistViaEmbed(playlistId);
      return NextResponse.json(result);
    } catch (fallbackErr) {
      console.error('Embed Scraper fallback failed:', fallbackErr.message);
      
      const status = err.response?.status || 500;
      return NextResponse.json({ 
        error: `Could not access this playlist. Error: ${err.message}. Fallback Error: ${fallbackErr.message}` 
      }, { status });
    }
  }
}


