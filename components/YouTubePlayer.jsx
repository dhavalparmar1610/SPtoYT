"use client";

import { useEffect, useRef, useState } from 'react';
import { PlayCircle } from 'lucide-react';

export default function YouTubePlayer({ videoId }) {
  const playerRef = useRef(null);
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else if (window.YT && window.YT.Player) {
      initPlayer();
    }

    function initPlayer() {
      if (!playerRef.current) return;
      
      const newPlayer = new window.YT.Player(playerRef.current, {
        height: '100%',
        width: '100%',
        videoId: videoId || '',
        playerVars: {
          'playsinline': 1,
          'autoplay': 0,
        }
      });
      setPlayer(newPlayer);
    }
  }, []);

  useEffect(() => {
    if (player && videoId && typeof player.loadVideoById === 'function') {
      player.loadVideoById(videoId);
    }
  }, [videoId, player]);

  return (
    <div className="card">
      <div className="card-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <span style={{color: 'var(--youtube-red)'}}><PlayCircle /></span> YouTube Player
        </div>
      </div>

      <div style={{flex: 1, backgroundColor: 'black', borderRadius: '8px', overflow: 'hidden', position: 'relative', minHeight: '250px'}}>
        {videoId ? (
          <div ref={playerRef} style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}} />
        ) : (
          <div className="track-info" style={{color: 'var(--text-muted)'}}>
            <p>No video playing.</p>
            <p style={{fontSize: '0.9rem', marginTop: '8px'}}>Sync a playlist to see preview here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
