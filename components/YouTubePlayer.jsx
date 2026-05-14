"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { SkipBack, SkipForward, Play as PlayIcon, Pause, Shuffle, Repeat, ListMusic, Tv } from 'lucide-react';
import SilentAudioHack from './SilentAudioHack';

export default function YouTubePlayer({ videoId, playlistId, onPlayerReady, isMini, onToggleExpand }) {
  const playerRef = useRef(null);
  const playerInstanceRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [useCustomPlayer, setUseCustomPlayer] = useState(true);
  
  const [currentVideoData, setCurrentVideoData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Stable callback for state change handler
  const onPlayerStateChange = useCallback((event) => {
    const state = event.data;
    if (state === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      const data = event.target.getVideoData();
      setCurrentVideoData(data);
      setDuration(event.target.getDuration());
      
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
        if (data && data.title && data.video_id) {
          try {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: data.title,
              artist: data.author || 'YouTube Music',
              artwork: [
                { src: `https://i.ytimg.com/vi/${data.video_id}/maxresdefault.jpg`, sizes: '1280x720', type: 'image/jpeg' },
                { src: `https://i.ytimg.com/vi/${data.video_id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }
              ]
            });
          } catch (e) {
            console.error('MediaSession metadata error:', e);
          }

          navigator.mediaSession.setActionHandler('play', () => {
            event.target.playVideo();
          });
          navigator.mediaSession.setActionHandler('pause', () => {
            event.target.pauseVideo();
          });
          navigator.mediaSession.setActionHandler('previoustrack', () => {
            event.target.previousVideo();
          });
          navigator.mediaSession.setActionHandler('nexttrack', () => {
            event.target.nextVideo();
          });
        }
      }
    } else if (state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.ENDED) {
      setIsPlaying(false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    }
  }, []);

  // Initialize the YouTube IFrame player ONCE
  useEffect(() => {
    function initPlayer() {
      if (!playerRef.current || playerInstanceRef.current) return;
      
      const newPlayer = new window.YT.Player(playerRef.current, {
        height: '100%',
        width: '100%',
        videoId: videoId || '',
        playerVars: {
          'playsinline': 1,
          'autoplay': 1,
          'controls': 0,
          'disablekb': 1,
          'modestbranding': 1,
          'rel': 0
        },
        events: {
          'onReady': (event) => {
             if (onPlayerReady) onPlayerReady(event.target);
             if (videoId || playlistId) event.target.playVideo();
          },
          'onStateChange': onPlayerStateChange
        }
      });
      playerInstanceRef.current = newPlayer;
    }

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

    // Cleanup on unmount only
    return () => {
      if (playerInstanceRef.current && typeof playerInstanceRef.current.destroy === 'function') {
        playerInstanceRef.current.destroy();
        playerInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load new video/playlist when props change
  useEffect(() => {
    const player = playerInstanceRef.current;
    if (!player) return;
    if (playlistId && typeof player.loadPlaylist === 'function') {
      player.loadPlaylist({
        list: playlistId,
        listType: 'playlist'
      });
    } else if (videoId && typeof player.loadVideoById === 'function') {
      player.loadVideoById(videoId);
    }
  }, [videoId, playlistId]);

  // Progress tracking interval
  useEffect(() => {
    let interval;
    const player = playerInstanceRef.current;
    if (isPlaying && player) {
      interval = setInterval(() => {
        if (player.getCurrentTime) setProgress(player.getCurrentTime());
        if (player.getDuration) setDuration(player.getDuration());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setProgress(time);
    const player = playerInstanceRef.current;
    if (player && typeof player.seekTo === 'function') {
      player.seekTo(time, true);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const player = playerInstanceRef.current;

  const artworkUrl = currentVideoData?.video_id 
    ? `https://i.ytimg.com/vi/${currentVideoData.video_id}/hqdefault.jpg` 
    : '';

  // Determine if iframe should be shown visually (video mode + expanded)
  const showIframeVisually = !isMini && !useCustomPlayer;

  return (
    <div className={`premium-player-container ${isMini ? 'mini-mode' : 'full-mode'}`}>
      <SilentAudioHack isPlaying={isPlaying} />
      
      {!isMini && artworkUrl && (
        <div className="player-background-blur" style={{ backgroundImage: `url(${artworkUrl})` }} />
      )}

      {/* 
        CRITICAL: The iframe div is ALWAYS rendered. Never conditionally remove it.
        When hidden, we move it off-screen with CSS so the YT player keeps playing.
      */}
      <div 
        className={`youtube-iframe-persistent ${showIframeVisually ? 'iframe-visible' : 'iframe-hidden'}`}
      >
        <div ref={playerRef} style={{width: '100%', height: '100%'}} />
      </div>

      <div className="player-content-wrapper">
        
        {/* Full Player Content */}
        {!isMini && (
          <div className="full-player-layout">
            <div className="full-header">
              <button onClick={onToggleExpand} className="minimize-btn">
                <SkipForward size={24} style={{transform: 'rotate(90deg)'}} />
              </button>
              <div className="now-playing-label">Now Playing</div>
              <button 
                onClick={() => setUseCustomPlayer(!useCustomPlayer)}
                className="player-mode-toggle"
              >
                <Tv size={16} /> {useCustomPlayer ? 'Video Mode' : 'Audio Mode'}
              </button>
            </div>

            {useCustomPlayer && (
              <div className="audio-visual-content">
                <div className="album-art-section">
                  {currentVideoData ? (
                    <img 
                      src={`https://i.ytimg.com/vi/${currentVideoData.video_id}/maxresdefault.jpg`} 
                      onError={(e) => { e.target.src = `https://i.ytimg.com/vi/${currentVideoData.video_id}/hqdefault.jpg`; }}
                      className="full-album-art"
                      alt=""
                    />
                  ) : (
                    <div className="full-art-placeholder"><ListMusic size={80} /></div>
                  )}
                </div>

                <div className="track-meta-section">
                  <h1 className="full-track-title">{currentVideoData?.title || 'Not Playing'}</h1>
                  <p className="full-track-artist">{currentVideoData?.author || 'Unknown Artist'}</p>
                </div>

                <div className="full-controls-section">
                  <div className="full-progress-container">
                    <span className="time-label">{formatTime(progress)}</span>
                    <input type="range" min={0} max={duration || 100} value={progress} onChange={handleSeek} className="premium-range-slider" />
                    <span className="time-label">{formatTime(duration)}</span>
                  </div>

                  <div className="full-actions">
                    <button className={`sub-control ${isShuffle ? 'active' : ''}`} onClick={() => {setIsShuffle(!isShuffle); player?.setShuffle(!isShuffle);}}><Shuffle size={24} /></button>
                    <div className="main-btns">
                      <button className="nav-btn" onClick={() => player?.previousVideo()}><SkipBack size={36} fill="white" /></button>
                      <button className="play-pause-circle" onClick={() => isPlaying ? player?.pauseVideo() : player?.playVideo()}>
                        {isPlaying ? <Pause size={36} fill="black" /> : <PlayIcon size={36} fill="black" style={{marginLeft: '4px'}} />}
                      </button>
                      <button className="nav-btn" onClick={() => player?.nextVideo()}><SkipForward size={36} fill="white" /></button>
                    </div>
                    <button className={`sub-control ${isRepeat ? 'active' : ''}`} onClick={() => {setIsRepeat(!isRepeat); player?.setLoop(!isRepeat);}}><Repeat size={24} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mini Player Content */}
        {isMini && (
          <div className="mini-player-layout" onClick={onToggleExpand}>
            <div className="mini-progress-line" style={{ width: `${(progress / duration) * 100}%` }} />
            <div className="mini-main-content">
              {currentVideoData ? (
                <>
                  <img src={`https://i.ytimg.com/vi/${currentVideoData.video_id}/hqdefault.jpg`} className="mini-thumb" alt="" />
                  <div className="mini-info">
                    <div className="mini-title">{currentVideoData.title}</div>
                    <div className="mini-artist">{currentVideoData.author}</div>
                  </div>
                  <div className="mini-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="mini-btn" onClick={() => isPlaying ? player?.pauseVideo() : player?.playVideo()}>
                      {isPlaying ? <Pause size={24} fill="currentColor" /> : <PlayIcon size={24} fill="currentColor" />}
                    </button>
                    <button className="mini-btn" onClick={() => player?.nextVideo()}><SkipForward size={24} fill="currentColor" /></button>
                  </div>
                </>
              ) : (
                <div className="mini-empty">Choose a song to start listening</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
