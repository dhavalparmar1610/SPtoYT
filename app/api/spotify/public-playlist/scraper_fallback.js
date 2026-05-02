import axios from 'axios';

/**
 * FALLBACK: Fetch playlist data by scraping the Spotify Embed page.
 * Note: Embeds usually only show the first 100 tracks.
 */
export async function fetchPlaylistViaEmbed(playlistId) {
  const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    }
  });

  const html = res.data;
  let entity = null;

  // Try parsing from the 'resource' script tag
  const resourceMatch = html.match(/<script id="resource" type="application\/json">(.+?)<\/script>/);
  if (resourceMatch) {
    try {
      const data = JSON.parse(resourceMatch[1]);
      entity = data.props?.pageProps?.state?.data?.entity || data;
    } catch (e) {}
  }

  // Try parsing from '__NEXT_DATA__'
  if (!entity || !entity.name) {
    const nextMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
    if (nextMatch) {
      try {
        const data = JSON.parse(nextMatch[1]);
        entity = data.props?.pageProps?.state?.data?.entity || data.props?.pageProps?.state?.data || {};
      } catch (e) {}
    }
  }

  if (!entity || (!entity.name && !entity.title)) throw new Error('Could not find playlist data in embed page');

  const rawTracks = entity.trackList || entity.tracks?.items || entity.items || [];
  
  const tracks = rawTracks.map(item => {
    const trackObj = item.track || item;
    return {
      name: trackObj.title || trackObj.name || 'Unknown Track',
      artist: trackObj.subtitle || trackObj.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
      album: trackObj.album?.name || '',
      albumArt: trackObj.album?.images?.[0]?.url || trackObj.image?.[0]?.url || null,
      duration_ms: trackObj.duration || trackObj.duration_ms || 0,
    };
  }).filter(t => t.name !== 'Unknown Track');

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
