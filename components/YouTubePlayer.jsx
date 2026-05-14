"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { SkipBack, SkipForward, Play as PlayIcon, Pause, Shuffle, Repeat, ListMusic, Tv, ChevronDown } from 'lucide-react';
import SilentAudioHack from './SilentAudioHack';

export default function YouTubePlayer({ 
  videoId, 
  playlistId, 
  onPlayerReady, 
  isMini, 
  onToggleExpand,
  queue = [],
  initialIndex = 0
}) {
  const playerRef = useRef(null);
  const playerInstanceRef = useRef(null);
  
  // Refs to store latest state for the callback to avoid stale closures
  const isRepeatRef = useRef(false);
  const isShuffleRef = useRef(false);
  const playlistIdRef = useRef(playlistId);
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(initialIndex);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [useCustomPlayer, setUseCustomPlayer] = useState(true);
  
  const [currentVideoData, setCurrentVideoData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Sync refs with state/props
  useEffect(() => { isRepeatRef.current = isRepeat; }, [isRepeat]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);
  useEffect(() => { playlistIdRef.current = playlistId; }, [playlistId]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = initialIndex; }, [initialIndex]);

  // Stable callback for state change handler
  const onPlayerStateChange = useCallback((event) => {
    const state = event.data;
    const player = event.target;

    if (state === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      const data = player.getVideoData();
      setCurrentVideoData(data);
      setDuration(player.getDuration());
      
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

          navigator.mediaSession.setActionHandler('play', () => player.playVideo());
          navigator.mediaSession.setActionHandler('pause', () => player.pauseVideo());
          navigator.mediaSession.setActionHandler('previoustrack', () => player.previousVideo());
          navigator.mediaSession.setActionHandler('nexttrack', () => player.nextVideo());
        }
      }
    } else if (state === window.YT.PlayerState.ENDED) {
      if (isRepeatRef.current) {
        // Force restart of current video to override playlist auto-advance
        const currentId = player.getVideoData()?.video_id;
        if (currentId) {
          player.loadVideoById(currentId);
        } else {
          player.seekTo(0);
          player.playVideo();
        }
      } else {
        setIsPlaying(false);
        // If it's a playlist or we have a manual queue, try to go next
        if (playlistIdRef.current || (queueRef.current && queueRef.current.length > 1)) {
          player.nextVideo();
        }
      }
      
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    } else if (state === window.YT.PlayerState.PAUSED) {
      setIsPlaying(false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    } else if (state === window.YT.PlayerState.BUFFERING) {
      setIsPlaying(true);
    } else if (state === window.YT.PlayerState.UNSTARTED) {
      setIsPlaying(false);
    }
  }, []);

  // Initialize the YouTube IFrame player ONCE
  useEffect(() => {
    function initPlayer() {
      if (!playerRef.current || playerInstanceRef.current) return;
      
      const newPlayer = new window.YT.Player(playerRef.current, {
        height: '100%',
        width: '100%',
        videoId: videoId || (queue.length > 0 ? queue[initialIndex] : ''),
        playerVars: {
          'playsinline': 1,
          'autoplay': 1,
          'controls': 0,
          'disablekb': 1,
          'modestbranding': 1,
          'rel': 0,
          'origin': window.location.origin
        },
        events: {
          'onReady': (event) => {
             const p = event.target;
             if (onPlayerReady) onPlayerReady(p);
             
             // If we have a playlist, load it
             if (playlistId) {
               p.loadPlaylist({
                 list: playlistId,
                 listType: 'playlist',
                 index: initialIndex
               });
             } else if (queue && queue.length > 1) {
               p.loadPlaylist(queue, initialIndex);
             } else if (videoId) {
               p.loadVideoById(videoId);
             }
             
             p.playVideo();
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

    return () => {
      if (playerInstanceRef.current && typeof playerInstanceRef.current.destroy === 'function') {
        playerInstanceRef.current.destroy();
        playerInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastLoadedRef = useRef('');

  // Load new video/playlist when props change
  useEffect(() => {
    const player = playerInstanceRef.current;
    if (!player || typeof player.loadPlaylist !== 'function') return;

    const currentLoadId = (playlistId || '') + (videoId || '') + (queue.length) + initialIndex;
    if (lastLoadedRef.current === currentLoadId) return; 
    lastLoadedRef.current = currentLoadId;

    if (playlistId) {
      player.loadPlaylist({
        list: playlistId,
        listType: 'playlist',
        index: initialIndex
      });
    } else if (queue && queue.length > 1) {
      player.loadPlaylist(queue, initialIndex);
    } else if (videoId) {
      player.loadVideoById(videoId);
    }
  }, [videoId, playlistId, initialIndex, queue]);

  // Progress tracking interval & Proactive Repeat Detection
  useEffect(() => {
    let interval;
    const player = playerInstanceRef.current;
    if (isPlaying && player) {
      interval = setInterval(() => {
        if (!player.getCurrentTime || !player.getDuration) return;
        
        const currentTime = player.getCurrentTime();
        const totalTime = player.getDuration();
        
        setProgress(currentTime);
        setDuration(totalTime);

        // PROACTIVE REPEAT: If we are near the end and repeat is on, 
        // restart BEFORE the YouTube player's native playlist logic kicks in.
        if (isRepeatRef.current && totalTime > 5 && currentTime > 5 && (totalTime - currentTime) < 1.5) {
          player.seekTo(0);
          player.playVideo();
        }
      }, 500); // Higher frequency for accurate repeat detection
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setProgress(time);
    const player = playerInstanceRef.current;
    if (player && typeof player.seekTo === 'function') {
      player.seekTo(time, true);
      if (!isPlaying) player.playVideo();
    }
  };

  const handleShuffleToggle = () => {
    const newShuffle = !isShuffle;
    setIsShuffle(newShuffle);
    if (newShuffle) setIsRepeat(false); // Mutual exclusion
    
    if (playerInstanceRef.current && typeof playerInstanceRef.current.setShuffle === 'function') {
      playerInstanceRef.current.setShuffle(newShuffle);
    }
  };

  const handleRepeatToggle = () => {
    const newRepeat = !isRepeat;
    setIsRepeat(newRepeat);
    if (newRepeat) setIsShuffle(false); // Mutual exclusion
    
    if (playerInstanceRef.current && typeof playerInstanceRef.current.setLoop === 'function') {
      playerInstanceRef.current.setLoop(newRepeat);
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
    ? `https://i.ytimg.com/vi/${currentVideoData.video_id}/maxresdefault.jpg` 
    : (videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : '');

  const showIframeVisually = !isMini && !useCustomPlayer;

  return (
    <div className={`premium-player-container ${isMini ? 'mini-mode' : 'full-mode'}`}>
      <SilentAudioHack isPlaying={isPlaying} />
      
      {!isMini && artworkUrl && (
        <div className="player-background-blur" style={{ backgroundImage: `url(${artworkUrl})` }} />
      )}

      {/* Persistent IFrame */}
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
              <button onClick={onToggleExpand} className="minimize-btn" title="Minimize">
                <ChevronDown size={24} />
              </button>
              <div className="now-playing-label">Now Playing</div>
              <button 
                onClick={() => setUseCustomPlayer(!useCustomPlayer)}
                className="player-mode-toggle"
              >
                <Tv size={16} /> {useCustomPlayer ? 'Video Mode' : 'Audio Mode'}
              </button>
            </div>

            {useCustomPlayer ? (
              <div className="audio-visual-content">
                <div className="album-art-section">
                  {artworkUrl ? (
                    <img 
                      src={artworkUrl} 
                      onError={(e) => { 
                        if (currentVideoData?.video_id) e.target.src = `https://i.ytimg.com/vi/${currentVideoData.video_id}/hqdefault.jpg`;
                        else if (videoId) e.target.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                      }}
                      className="full-album-art"
                      alt=""
                    />
                  ) : (
                    <div className="full-art-placeholder"><ListMusic size={80} /></div>
                  )}
                </div>

                <div className="track-meta-section">
                  <h1 className="full-track-title">{currentVideoData?.title || 'Loading...'}</h1>
                  <p className="full-track-artist">{currentVideoData?.author || 'YouTube Music'}</p>
                </div>

                <div className="full-controls-section">
                  <div className="full-progress-container">
                    <span className="time-label">{formatTime(progress)}</span>
                    <input 
                      type="range" 
                      min={0} 
                      max={duration || 100} 
                      value={progress || 0} 
                      onChange={handleSeek} 
                      className="premium-range-slider" 
                    />
                    <span className="time-label">{formatTime(duration)}</span>
                  </div>

                  <div className="full-actions">
                    <button 
                      className={`sub-control ${isShuffle ? 'active' : ''}`} 
                      onClick={handleShuffleToggle}
                      title="Shuffle"
                    >
                      <Shuffle size={24} />
                    </button>
                    <div className="main-btns">
                      <button className="nav-btn" onClick={() => player?.previousVideo()} title="Previous"><SkipBack size={36} fill="white" /></button>
                      <button className="play-pause-circle" onClick={() => isPlaying ? player?.pauseVideo() : player?.playVideo()} title={isPlaying ? "Pause" : "Play"}>
                        {isPlaying ? <Pause size={36} fill="black" /> : <PlayIcon size={36} fill="black" style={{marginLeft: '4px'}} />}
                      </button>
                      <button className="nav-btn" onClick={() => player?.nextVideo()} title="Next"><SkipForward size={36} fill="white" /></button>
                    </div>
                    <button 
                      className={`sub-control ${isRepeat ? 'active' : ''}`} 
                      onClick={handleRepeatToggle}
                      title="Repeat"
                    >
                      <Repeat size={24} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="video-mode-content">
                <div className="video-container-placeholder">
                  {/* The actual iframe is absolutely positioned behind/over this area */}
                </div>
                <div className="track-meta-section" style={{ marginTop: '20px' }}>
                  <h1 className="full-track-title">{currentVideoData?.title || 'Loading...'}</h1>
                  <p className="full-track-artist">{currentVideoData?.author || 'YouTube Music'}</p>
                </div>
                <div className="full-actions" style={{ marginTop: 'auto', marginBottom: '20px' }}>
                   <div className="main-btns">
                      <button className="nav-btn" onClick={() => player?.previousVideo()} title="Previous"><SkipBack size={36} fill="white" /></button>
                      <button className="play-pause-circle" onClick={() => isPlaying ? player?.pauseVideo() : player?.playVideo()} title={isPlaying ? "Pause" : "Play"}>
                        {isPlaying ? <Pause size={36} fill="black" /> : <PlayIcon size={36} fill="black" style={{marginLeft: '4px'}} />}
                      </button>
                      <button className="nav-btn" onClick={() => player?.nextVideo()} title="Next"><SkipForward size={36} fill="white" /></button>
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
              {(currentVideoData || videoId) ? (
                <>
                  <img src={`https://i.ytimg.com/vi/${currentVideoData?.video_id || videoId}/hqdefault.jpg`} className="mini-thumb" alt="" />
                  <div className="mini-info">
                    <div className="mini-title">{currentVideoData?.title || 'Loading...'}</div>
                    <div className="mini-artist">{currentVideoData?.author || 'YouTube Music'}</div>
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
