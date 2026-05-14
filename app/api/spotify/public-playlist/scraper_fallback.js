import axios from 'axios';

/**
 * FALLBACK: Fetch playlist data by scraping the Spotify Embed page.
 * Note: Embeds usually only show the first 100 tracks.
 */
export async function fetchPlaylistViaEmbed(playlistId) {
  // Try main page first, as it might have more data
  const mainUrl = `https://open.spotify.com/playlist/${playlistId}`;
  const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
  
  let html;
  try {
    const res = await axios.get(mainUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      }
    });
    html = res.data;
  } catch (e) {
    const res = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      }
    });
    html = res.data;
  }

  let entity = null;
  
  // Method 1: Resource tag
  const resourceMatch = html.match(/<script id="resource" type="application\/json">(.+?)<\/script>/);
  if (resourceMatch) {
    try {
      const data = JSON.parse(resourceMatch[1]);
      entity = data.props?.pageProps?.state?.data?.entity || data;
    } catch (e) {}
  }

  // Method 2: __NEXT_DATA__
  if (!entity || !entity.name) {
    const nextMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
    if (nextMatch) {
      try {
        const data = JSON.parse(nextMatch[1]);
        const state = data.props?.pageProps?.state?.data;
        entity = state?.entity || state || {};
      } catch (e) {}
    }
  }

  // Method 3: Spotify state (Newer layout)
  if (!entity || !entity.name) {
    const stateMatch = html.match(/<script id="initial-state" type="text\/plain">(.+?)<\/script>/);
    if (stateMatch) {
      try {
        const decoded = Buffer.from(stateMatch[1], 'base64').toString();
        const data = JSON.parse(decoded);
        entity = data.entities?.playlist?.[playlistId] || data;
      } catch (e) {}
    }
  }

  if (!entity || (!entity.name && !entity.title)) throw new Error('Could not find playlist data');

  const rawTracks = entity.trackList || entity.tracks?.items || entity.items || entity.content?.items || [];
  
  const tracks = rawTracks.map(item => {
    const trackObj = item.track || item;
    if (!trackObj || (!trackObj.name && !trackObj.title)) return null;
    return {
      name: trackObj.title || trackObj.name || 'Unknown Track',
      artist: trackObj.subtitle || trackObj.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
      album: trackObj.album?.name || '',
      albumArt: trackObj.album?.images?.[0]?.url || trackObj.image?.[0]?.url || null,
      duration_ms: trackObj.duration || trackObj.duration_ms || 0,
    };
  }).filter(Boolean);

  return {
    playlist: {
      id: playlistId,
      name: entity.name || entity.title || 'Spotify Playlist',
      description: entity.description || '',
      image: entity.images?.[0]?.url || entity.visualIdentity?.image?.[0]?.url || null,
      totalTracks: entity.trackList?.length || entity.tracks?.total || tracks.length,
    },
    tracks
  };
}
