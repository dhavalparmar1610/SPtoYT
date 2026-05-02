"use client";

import { useEffect, useRef, useState } from 'react';
import { PlayCircle, SkipBack, SkipForward, Play as PlayIcon, Pause, Shuffle, Repeat } from 'lucide-react';

export default function YouTubePlayer({ videoId, playlistId, onPlayerReady }) {
  const playerRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

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
        },
        events: {
          'onReady': (event) => {
             if (onPlayerReady) onPlayerReady(event.target);
          },
          'onStateChange': onPlayerStateChange
        }
      });
      setPlayer(newPlayer);
    }

    function onPlayerStateChange(event) {
      if (event.data === window.YT.PlayerState.PLAYING) {
        setIsPlaying(true);
        if ('mediaSession' in navigator) {
          const data = event.target.getVideoData();
          if (data && data.title) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: data.title,
              artist: data.author || 'YouTube Music',
              artwork: [
                { src: `https://i.ytimg.com/vi/${data.video_id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }
              ]
            });

            navigator.mediaSession.setActionHandler('previoustrack', () => {
              event.target.previousVideo();
            });
            navigator.mediaSession.setActionHandler('nexttrack', () => {
              event.target.nextVideo();
            });
          }
        }
      } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
        setIsPlaying(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!player) return;
    
    if (playlistId && typeof player.loadPlaylist === 'function') {
      player.loadPlaylist({
        list: playlistId,
        listType: 'playlist'
      });
    } else if (videoId && typeof player.loadVideoById === 'function') {
      player.loadVideoById(videoId);
    }
  }, [videoId, playlistId, player]);

  return (
    <div className="card">
      <div className="card-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <span style={{color: 'var(--youtube-red)'}}><PlayCircle /></span> YouTube Player
        </div>
      </div>

      <div style={{flex: 1, backgroundColor: 'black', borderRadius: '8px', overflow: 'hidden', position: 'relative', minHeight: '250px'}}>
        <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: (videoId || playlistId) ? 'block' : 'none'}}>
          <div ref={playerRef} style={{width: '100%', height: '100%'}} />
        </div>
        
        {!(videoId || playlistId) && (
          <div className="track-info" style={{color: 'var(--text-muted)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center'}}>
            <p>No video playing.</p>
            <p style={{fontSize: '0.9rem', marginTop: '8px'}}>Sync a playlist to see preview here.</p>
          </div>
        )}
      </div>

      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', padding: '16px 0 0 0'}}>
        <button 
          onClick={() => {
            const newState = !isShuffle;
            setIsShuffle(newState);
            if (player) player.setShuffle(newState);
          }}
          style={{background: 'none', border: 'none', color: isShuffle ? 'var(--spotify-green)' : '#888', cursor: 'pointer', display: 'flex'}}
        >
          <Shuffle size={20} />
        </button>
        
        <button 
          onClick={() => player && player.previousVideo()}
          style={{background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex'}}
        >
          <SkipBack size={24} />
        </button>
        
        <button 
          onClick={() => {
            if (!player) return;
            if (isPlaying) player.pauseVideo();
            else player.playVideo();
          }}
          style={{background: 'white', border: 'none', color: 'black', borderRadius: '50%', padding: '12px', cursor: 'pointer', display: 'flex'}}
        >
          {isPlaying ? <Pause size={24} fill="black" /> : <PlayIcon size={24} fill="black" />}
        </button>
        
        <button 
          onClick={() => player && player.nextVideo()}
          style={{background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex'}}
        >
          <SkipForward size={24} />
        </button>
        
        <button 
          onClick={() => {
            const newState = !isRepeat;
            setIsRepeat(newState);
            if (player) player.setLoop(newState);
          }}
          style={{background: 'none', border: 'none', color: isRepeat ? 'var(--spotify-green)' : '#888', cursor: 'pointer', display: 'flex'}}
        >
          <Repeat size={20} />
        </button>
      </div>
    </div>
  );
}
