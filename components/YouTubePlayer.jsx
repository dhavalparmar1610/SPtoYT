"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  SkipBack, 
  SkipForward, 
  Play as PlayIcon, 
  Pause, 
  Shuffle, 
  Repeat, 
  Tv, 
  ChevronDown, 
  Volume2, 
  VolumeX, 
  Maximize2,
  Minimize2,
  Heart
} from 'lucide-react';
import SilentAudioHack from './SilentAudioHack';
import { cleanYouTubeTitle, formatDuration } from '@/lib/formatters';

export default function YouTubePlayer({ 
  videoId, 
  playlistId, 
  onPlayerReady, 
  isMini, 
  onToggleExpand,
  queue = [],
  initialIndex = 0,
  onNextTrack,
  onPrevTrack
}) {
  const playerRef = useRef(null);
  const playerInstanceRef = useRef(null);
  
  // Refs to store latest state for callbacks to avoid stale closures
  const isRepeatRef = useRef(false);
  const isShuffleRef = useRef(false);
  const playlistIdRef = useRef(playlistId);
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(initialIndex);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [useCustomPlayer, setUseCustomPlayer] = useState(true); // true = Audio/Art mode, false = Video mode
  const [isLiked, setIsLiked] = useState(false);
  
  const [currentVideoData, setCurrentVideoData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  // Sync refs with state/props
  useEffect(() => { isRepeatRef.current = isRepeat; }, [isRepeat]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);
  useEffect(() => { playlistIdRef.current = playlistId; }, [playlistId]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = initialIndex; }, [initialIndex]);

  // Update MediaSession for lockscreen / system controls
  const updateMediaSession = useCallback((data, player) => {
    if (!('mediaSession' in navigator) || !data) return;
    const { title, artist } = cleanYouTubeTitle(data.title, data.author);
    const vId = data.video_id;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'Music Sync',
        artist: artist || 'YouTube Music',
        album: 'Spotify to YouTube',
        artwork: vId ? [
          { src: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
          { src: `https://i.ytimg.com/vi/${vId}/maxresdefault.jpg`, sizes: '1280x720', type: 'image/jpeg' }
        ] : []
      });

      navigator.mediaSession.setActionHandler('play', () => {
        player?.playVideo();
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        player?.pauseVideo();
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (onPrevTrack) onPrevTrack();
        else player?.previousVideo();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (onNextTrack) onNextTrack();
        else player?.nextVideo();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && player) {
          player.seekTo(details.seekTime, true);
          setProgress(details.seekTime);
        }
      });
    } catch (e) {
      console.warn('MediaSession error:', e);
    }
  }, [onNextTrack, onPrevTrack]);

  // Stable callback for player state change
  const onPlayerStateChange = useCallback((event) => {
    const state = event.data;
    const player = event.target;

    if (state === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      const data = player.getVideoData();
      setCurrentVideoData(data);
      const d = player.getDuration();
      if (d && !isNaN(d)) setDuration(d);
      updateMediaSession(data, player);
      
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    } else if (state === window.YT.PlayerState.ENDED) {
      if (isRepeatRef.current) {
        const currentId = player.getVideoData()?.video_id;
        if (currentId) {
          player.loadVideoById(currentId);
        } else {
          player.seekTo(0);
          player.playVideo();
        }
      } else {
        setIsPlaying(false);
        if (onNextTrack) {
          onNextTrack();
        } else if (playlistIdRef.current || (queueRef.current && queueRef.current.length > 1)) {
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
      const data = player.getVideoData();
      if (data?.title) setCurrentVideoData(data);
    } else if (state === window.YT.PlayerState.UNSTARTED) {
      setIsPlaying(false);
    }
  }, [updateMediaSession, onNextTrack]);

  // Initialize YouTube IFrame Player ONCE
  useEffect(() => {
    function initPlayer() {
      if (!playerRef.current || playerInstanceRef.current) return;
      
      const newPlayer = new window.YT.Player(playerRef.current, {
        height: '100%',
        width: '100%',
        videoId: videoId || (queue.length > 0 ? queue[initialIndex] : ''),
        playerVars: {
          playsinline: 1,
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          origin: typeof window !== 'undefined' ? window.location.origin : ''
        },
        events: {
          onReady: (event) => {
            const p = event.target;
            if (onPlayerReady) onPlayerReady(p);
            p.setVolume(volume);

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
          onStateChange: onPlayerStateChange
        }
      });
      playerInstanceRef.current = newPlayer;
    }

    if (typeof window !== 'undefined') {
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

    const currentLoadId = (playlistId || '') + '_' + (videoId || '') + '_' + (queue.length) + '_' + initialIndex;
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
        
        try {
          const currentTime = player.getCurrentTime();
          const totalTime = player.getDuration();
          
          if (!isNaN(currentTime)) setProgress(currentTime);
          if (!isNaN(totalTime) && totalTime > 0) setDuration(totalTime);

          // Proactive repeat
          if (isRepeatRef.current && totalTime > 5 && currentTime > 5 && (totalTime - currentTime) < 1.5) {
            player.seekTo(0);
            player.playVideo();
          }
        } catch (e) {
          // ignore transient iframe comms errors
        }
      }, 500);
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
    if (newShuffle) setIsRepeat(false);
    
    if (playerInstanceRef.current && typeof playerInstanceRef.current.setShuffle === 'function') {
      playerInstanceRef.current.setShuffle(newShuffle);
    }
  };

  const handleRepeatToggle = () => {
    const newRepeat = !isRepeat;
    setIsRepeat(newRepeat);
    if (newRepeat) setIsShuffle(false);
    
    if (playerInstanceRef.current && typeof playerInstanceRef.current.setLoop === 'function') {
      playerInstanceRef.current.setLoop(newRepeat);
    }
  };

  const handleVolumeChange = (e) => {
    const newVol = parseInt(e.target.value, 10);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (playerInstanceRef.current && typeof playerInstanceRef.current.setVolume === 'function') {
      playerInstanceRef.current.setVolume(newVol);
      if (newVol > 0 && typeof playerInstanceRef.current.unMute === 'function') {
        playerInstanceRef.current.unMute();
      }
    }
  };

  const handleToggleMute = () => {
    const player = playerInstanceRef.current;
    if (!player) return;
    if (isMuted) {
      setIsMuted(false);
      player.unMute?.();
      player.setVolume?.(volume || 80);
    } else {
      setIsMuted(true);
      player.mute?.();
    }
  };

  const player = playerInstanceRef.current;
  const currentId = currentVideoData?.video_id || videoId;
  const artworkUrl = currentId ? `https://i.ytimg.com/vi/${currentId}/hqdefault.jpg` : '';
  const { title: displayTitle, artist: displayArtist } = cleanYouTubeTitle(currentVideoData?.title, currentVideoData?.author);

  const showIframeVisually = !isMini && !useCustomPlayer;

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;

  return (
    <div className={`spotify-player-root ${isMini ? 'is-mini' : 'is-expanded'}`}>
      <SilentAudioHack isPlaying={isPlaying} />

      {/* 
        CRITICAL FIX FOR BRAVE / IOS / BACKGROUND AUDIO:
        The iframe must ALWAYS remain inside viewport bounds!
        Never apply left: -9999px or display: none.
      */}
      <div 
        className={`youtube-iframe-persistent ${showIframeVisually ? 'iframe-visible' : 'iframe-audio-mode'}`}
      >
        <div ref={playerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* ── EXPANDED FULL PLAYER VIEW (Mobile Sheet / Desktop Fullscreen) ── */}
      {!isMini && (
        <div className="full-player-layout">
          {artworkUrl && (
            <div 
              className="player-ambient-blur" 
              style={{ backgroundImage: `url(${artworkUrl})` }} 
            />
          )}

          <div className="full-player-header">
            <button 
              onClick={onToggleExpand} 
              className="player-header-icon-btn" 
              title="Collapse"
              aria-label="Collapse Player"
            >
              <ChevronDown size={28} />
            </button>
            <div className="full-header-center">
              <span className="now-playing-sub">PLAYING FROM YOUTUBE</span>
              <span className="now-playing-title">{displayTitle || 'Now Playing'}</span>
            </div>
            <button 
              onClick={() => setUseCustomPlayer(!useCustomPlayer)}
              className={`mode-toggle-pill ${!useCustomPlayer ? 'active' : ''}`}
              title="Toggle Video / Audio Mode"
            >
              <Tv size={16} />
              <span>{useCustomPlayer ? 'Video' : 'Artwork'}</span>
            </button>
          </div>

          <div className="full-player-body">
            {useCustomPlayer ? (
              <div className="artwork-stage">
                {artworkUrl ? (
                  <img 
                    src={artworkUrl} 
                    alt={displayTitle}
                    className="full-cover-art"
                    onError={(e) => {
                      if (currentId) e.target.src = `https://i.ytimg.com/vi/${currentId}/mqdefault.jpg`;
                    }}
                  />
                ) : (
                  <div className="full-cover-placeholder">
                    <PlayIcon size={64} opacity={0.3} />
                  </div>
                )}
              </div>
            ) : (
              <div className="video-stage-placeholder">
                {/* The persistent iframe is placed here via CSS when showIframeVisually is true */}
              </div>
            )}

            <div className="full-metadata-row">
              <div className="full-track-meta">
                <h1 className="full-title" title={displayTitle}>{displayTitle}</h1>
                <p className="full-artist" title={displayArtist}>{displayArtist}</p>
              </div>
              <button 
                className={`heart-btn ${isLiked ? 'liked' : ''}`}
                onClick={() => setIsLiked(!isLiked)}
                title="Save to Liked Songs"
              >
                <Heart size={24} fill={isLiked ? '#1DB954' : 'none'} color={isLiked ? '#1DB954' : '#B3B3B3'} />
              </button>
            </div>

            <div className="full-scrubber-section">
              <div className="scrubber-bar-wrapper">
                <input 
                  type="range" 
                  min={0} 
                  max={duration || 100} 
                  value={progress || 0} 
                  onChange={handleSeek} 
                  className="spotify-seek-slider" 
                  style={{
                    background: `linear-gradient(to right, #1DB954 ${progressPercent}%, #3E3E3E ${progressPercent}%)`
                  }}
                />
              </div>
              <div className="scrubber-time-row">
                <span>{formatDuration(progress)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>

            <div className="full-controls-row">
              <button 
                className={`spotify-btn-sub ${isShuffle ? 'active' : ''}`}
                onClick={handleShuffleToggle}
                title="Shuffle"
              >
                <Shuffle size={20} />
                {isShuffle && <span className="control-dot" />}
              </button>

              <button 
                className="spotify-btn-nav"
                onClick={() => onPrevTrack ? onPrevTrack() : player?.previousVideo()}
                title="Previous Track"
              >
                <SkipBack size={28} fill="currentColor" />
              </button>

              <button 
                className="spotify-play-pause-circle"
                onClick={() => isPlaying ? player?.pauseVideo() : player?.playVideo()}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause size={28} fill="#000000" color="#000000" />
                ) : (
                  <PlayIcon size={28} fill="#000000" color="#000000" style={{ marginLeft: '3px' }} />
                )}
              </button>

              <button 
                className="spotify-btn-nav"
                onClick={() => onNextTrack ? onNextTrack() : player?.nextVideo()}
                title="Next Track"
              >
                <SkipForward size={28} fill="currentColor" />
              </button>

              <button 
                className={`spotify-btn-sub ${isRepeat ? 'active' : ''}`}
                onClick={handleRepeatToggle}
                title="Repeat Track"
              >
                <Repeat size={20} />
                {isRepeat && <span className="control-dot" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MINI PLAYER VIEW (Desktop Bottom Bar & Mobile Floating Bar) ── */}
      {isMini && (
        <div className="spotify-bottom-bar" onClick={onToggleExpand}>
          {/* Top progress indicator for mobile */}
          <div 
            className="mini-top-progress"
            style={{ width: `${progressPercent}%` }}
          />

          {/* LEFT: Track Info */}
          <div className="bar-track-info" onClick={(e) => e.stopPropagation()}>
            {artworkUrl ? (
              <img 
                src={artworkUrl} 
                alt="" 
                className="bar-thumb" 
                onClick={onToggleExpand}
              />
            ) : (
              <div className="bar-thumb-placeholder" onClick={onToggleExpand}>
                <PlayIcon size={20} opacity={0.4} />
              </div>
            )}
            <div className="bar-text" onClick={onToggleExpand}>
              <div className="bar-title" title={displayTitle}>{displayTitle || 'No song selected'}</div>
              <div className="bar-artist" title={displayArtist}>{displayArtist || 'Select a song to listen'}</div>
            </div>
            {currentId && (
              <button 
                className={`bar-heart-btn ${isLiked ? 'liked' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLiked(!isLiked);
                }}
                title="Save to Liked Songs"
              >
                <Heart size={18} fill={isLiked ? '#1DB954' : 'none'} color={isLiked ? '#1DB954' : '#B3B3B3'} />
              </button>
            )}
          </div>

          {/* CENTER: Player Controls & Scrubber (Desktop) */}
          <div className="bar-center-controls" onClick={(e) => e.stopPropagation()}>
            <div className="controls-buttons-row">
              <button 
                className={`bar-sub-btn ${isShuffle ? 'active' : ''}`}
                onClick={handleShuffleToggle}
                title="Shuffle"
              >
                <Shuffle size={16} />
              </button>

              <button 
                className="bar-nav-btn"
                onClick={() => onPrevTrack ? onPrevTrack() : player?.previousVideo()}
                title="Previous"
              >
                <SkipBack size={18} fill="currentColor" />
              </button>

              <button 
                className="bar-play-circle"
                onClick={() => isPlaying ? player?.pauseVideo() : player?.playVideo()}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause size={18} fill="#000000" color="#000000" />
                ) : (
                  <PlayIcon size={18} fill="#000000" color="#000000" style={{ marginLeft: '2px' }} />
                )}
              </button>

              <button 
                className="bar-nav-btn"
                onClick={() => onNextTrack ? onNextTrack() : player?.nextVideo()}
                title="Next"
              >
                <SkipForward size={18} fill="currentColor" />
              </button>

              <button 
                className={`bar-sub-btn ${isRepeat ? 'active' : ''}`}
                onClick={handleRepeatToggle}
                title="Repeat"
              >
                <Repeat size={16} />
              </button>
            </div>

            <div className="bar-scrub-row">
              <span className="bar-time">{formatDuration(progress)}</span>
              <div className="bar-slider-track">
                <input 
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={progress || 0}
                  onChange={handleSeek}
                  className="bar-seek-slider"
                  style={{
                    background: `linear-gradient(to right, #1DB954 ${progressPercent}%, #3E3E3E ${progressPercent}%)`
                  }}
                />
              </div>
              <span className="bar-time">{formatDuration(duration)}</span>
            </div>
          </div>

          {/* RIGHT: Extra actions & Volume (Desktop) */}
          <div className="bar-right-actions" onClick={(e) => e.stopPropagation()}>
            <button 
              className={`bar-icon-action ${!useCustomPlayer ? 'active' : ''}`}
              onClick={() => {
                setUseCustomPlayer(!useCustomPlayer);
                if (useCustomPlayer) onToggleExpand(); // Expand to see video
              }}
              title="Toggle Video Mode"
            >
              <Tv size={18} />
            </button>

            <div className="volume-control-group">
              <button className="bar-icon-action" onClick={handleToggleMute} title="Mute/Unmute">
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input 
                type="range" 
                min={0} 
                max={100} 
                value={isMuted ? 0 : volume} 
                onChange={handleVolumeChange} 
                className="bar-vol-slider" 
                style={{
                  background: `linear-gradient(to right, #1DB954 ${isMuted ? 0 : volume}%, #3E3E3E ${isMuted ? 0 : volume}%)`
                }}
              />
            </div>

            <button 
              className="bar-icon-action" 
              onClick={onToggleExpand} 
              title="Expand Player"
            >
              <Maximize2 size={18} />
            </button>
          </div>

          {/* Mobile Right Quick Controls */}
          <div className="bar-mobile-controls" onClick={(e) => e.stopPropagation()}>
            <button 
              className="mobile-play-btn"
              onClick={() => isPlaying ? player?.pauseVideo() : player?.playVideo()}
            >
              {isPlaying ? (
                <Pause size={22} fill="currentColor" />
              ) : (
                <PlayIcon size={22} fill="currentColor" />
              )}
            </button>
            <button 
              className="mobile-next-btn"
              onClick={() => onNextTrack ? onNextTrack() : player?.nextVideo()}
            >
              <SkipForward size={22} fill="currentColor" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
