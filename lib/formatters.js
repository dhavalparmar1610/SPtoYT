/**
 * Cleans up messy YouTube titles into clean song title and artist
 */
export function cleanYouTubeTitle(rawTitle = '', channelTitle = '') {
  if (!rawTitle) return { title: 'Unknown Title', artist: channelTitle || 'Unknown Artist' };

  let title = rawTitle;

  // Remove common YouTube clutter tags
  const clutterPatterns = [
    /\[\s*official\s*(music)?\s*video\s*\]/gi,
    /\(\s*official\s*(music)?\s*video\s*\)/gi,
    /\[\s*official\s*audio\s*\]/gi,
    /\(\s*official\s*audio\s*\)/gi,
    /\[\s*official\s*lyric(s)?\s*video\s*\]/gi,
    /\(\s*official\s*lyric(s)?\s*video\s*\)/gi,
    /\[\s*lyrics?\s*\]/gi,
    /\(\s*lyrics?\s*\)/gi,
    /\[\s*visualizer\s*\]/gi,
    /\(\s*visualizer\s*\)/gi,
    /\[\s*4k\s*(60fps)?\s*\]/gi,
    /\(\s*4k\s*(60fps)?\s*\)/gi,
    /\[\s*hd\s*\]/gi,
    /\(\s*hd\s*\)/gi,
    /\|\s*full\s*song/gi,
    /\|\s*new\s*song/gi,
    /\|\s*audio\s*song/gi,
    /\|\s*t-series/gi,
    /\|\s*zee\s*music/gi,
    /\|\s*sony\s*music/gi,
    /\|\s*speed\s*records/gi,
  ];

  clutterPatterns.forEach(pattern => {
    title = title.replace(pattern, '');
  });

  title = title.trim();

  // If title has "Artist - Song Title" or "Artist : Song Title"
  let artist = channelTitle?.replace(/ - Topic$/i, '') || '';
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }
  } else if (title.includes(' : ')) {
    const parts = title.split(' : ');
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' : ').trim();
    }
  }

  // Remove trailing dashes or pipes
  title = title.replace(/[-|/]+$/, '').trim();

  return {
    title: title || rawTitle,
    artist: artist || channelTitle?.replace(/ - Topic$/i, '') || 'YouTube Music'
  };
}

/**
 * Format seconds into mm:ss
 */
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Format ISO 8601 duration (PT4M13S) from YouTube API
 */
export function parseIsoDuration(isoDuration) {
  if (!isoDuration) return '';
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  if (hours > 0) {
    return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

