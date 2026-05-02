"use client";

import { useEffect, useRef, useState } from 'react';
import { SkipBack, SkipForward, Play as PlayIcon, Pause, Shuffle, Repeat, ListMusic, Tv } from 'lucide-react';

export default function YouTubePlayer({ videoId, playlistId, onPlayerReady }) {
  const playerRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [useCustomPlayer, setUseCustomPlayer] = useState(true);
  
  const [currentVideoData, setCurrentVideoData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

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
          'controls': 0,
          'disablekb': 1,
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
      const state = event.data;
      if (state === window.YT.PlayerState.PLAYING) {
        setIsPlaying(true);
        const data = event.target.getVideoData();
        setCurrentVideoData(data);
        setDuration(event.target.getDuration());
        
        if ('mediaSession' in navigator) {
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
      } else if (state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.ENDED) {
        setIsPlaying(false);
      } else if (state === window.YT.PlayerState.UNSTARTED) {
        setProgress(0);
        const data = event.target.getVideoData();
        if (data && data.video_id) setCurrentVideoData(data);
      }
    }
  }, []);

  useEffect(() => {
    let interval;
    if (isPlaying && player) {
      interval = setInterval(() => {
        setProgress(player.getCurrentTime());
        setDuration(player.getDuration());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, player]);

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

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setProgress(time);
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

  return (
    <div style={{height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', background: '#121212'}}>
      
      {/* TOGGLE BUTTON */}
      <button 
        onClick={() => setUseCustomPlayer(!useCustomPlayer)}
        style={{position: 'absolute', top: '16px', right: '16px', zIndex: 50, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '8px 12px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', backdropFilter: 'blur(10px)'}}
      >
        <Tv size={16} /> {useCustomPlayer ? 'Watch Video' : 'Hide Video'}
      </button>

      {/* YOUTUBE IFRAME */}
      <div style={{
        position: useCustomPlayer ? 'absolute' : 'relative', 
        opacity: useCustomPlayer ? 0 : 1, 
        pointerEvents: useCustomPlayer ? 'none' : 'auto', 
        width: useCustomPlayer ? '10px' : '100%', 
        height: useCustomPlayer ? '10px' : '100%', 
        flex: useCustomPlayer ? 'none' : 1,
        overflow: 'hidden'
      }}>
        <div ref={playerRef} style={{width: '100%', height: '100%'}} />
      </div>

      {/* SPOTIFY UI */}
      {useCustomPlayer && (
        <>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', width: '100%'}}>
            {currentVideoData ? (
              <div style={{width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <img 
                  src={`https://i.ytimg.com/vi/${currentVideoData.video_id}/maxresdefault.jpg`} 
                  onError={(e) => { e.target.src = `https://i.ytimg.com/vi/${currentVideoData.video_id}/hqdefault.jpg`; }}
                  style={{width: '280px', height: '280px', objectFit: 'cover', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', marginBottom: '32px'}} 
                  alt="Album Art"
                />
                <h2 style={{fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 8px 0', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  {currentVideoData.title}
                </h2>
                <p style={{fontSize: '1rem', color: '#aaa', margin: 0, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%'}}>
                  {currentVideoData.author}
                </p>
              </div>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#666', width: '100%'}}>
                <div style={{width: '280px', height: '280px', backgroundColor: '#222', borderRadius: '12px', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.3)'}}>
                   <ListMusic size={64} opacity={0.2} />
                </div>
                <h2>No Track Selected</h2>
                <p>Select a playlist to start listening</p>
              </div>
            )}
          </div>

          {/* CONTROLS */}
          <div style={{padding: '0 32px 32px 32px', width: '100%'}}>
            {/* Progress Bar */}
            <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', fontSize: '0.8rem', color: '#aaa'}}>
              <span style={{minWidth: '40px', textAlign: 'right'}}>{formatTime(progress)}</span>
              <input 
                type="range" 
                min={0} 
                max={duration || 100} 
                value={progress} 
                onChange={handleSeek}
                style={{flex: 1, accentColor: 'var(--spotify-green)', height: '4px', cursor: 'pointer', background: '#333', outline: 'none', borderRadius: '2px'}}
              />
              <span style={{minWidth: '40px'}}>{formatTime(duration)}</span>
            </div>

            {/* Buttons */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
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
              
              <div style={{display: 'flex', gap: '24px', alignItems: 'center'}}>
                <button 
                  onClick={() => player && player.previousVideo()}
                  style={{background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex'}}
                >
                  <SkipBack size={28} fill="white" />
                </button>
                
                <button 
                  onClick={() => {
                    if (!player) return;
                    if (isPlaying) player.pauseVideo();
                    else player.playVideo();
                  }}
                  style={{background: 'white', border: 'none', color: 'black', borderRadius: '50%', padding: '16px', cursor: 'pointer', display: 'flex', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'transform 0.1s'}}
                  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                  onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {isPlaying ? <Pause size={28} fill="black" /> : <PlayIcon size={28} fill="black" style={{marginLeft: '4px'}} />}
                </button>
                
                <button 
                  onClick={() => player && player.nextVideo()}
                  style={{background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex'}}
                >
                  <SkipForward size={28} fill="white" />
                </button>
              </div>
              
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
        </>
      )}
    </div>
  );
}
