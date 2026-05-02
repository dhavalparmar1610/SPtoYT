"use client";

import { useEffect, useRef, useState } from 'react';
import { SkipBack, SkipForward, Play as PlayIcon, Pause, Shuffle, Repeat, ListMusic, Tv } from 'lucide-react';

export default function YouTubePlayer({ videoId, playlistId, onPlayerReady, isMini }) {
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

  const artworkUrl = currentVideoData?.video_id 
    ? `https://i.ytimg.com/vi/${currentVideoData.video_id}/hqdefault.jpg` 
    : '';

  return (
    <div style={{height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative', background: '#121212', overflow: 'hidden'}}>
      
      {/* DYNAMIC GLOW BACKGROUND */}
      {useCustomPlayer && artworkUrl && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundImage: `url(${artworkUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'blur(80px) brightness(0.25)', opacity: 0.7, zIndex: 0, pointerEvents: 'none', transition: 'background-image 1s ease'
        }} />
      )}

      {/* CONTENT WRAPPER */}
      <div style={{position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: isMini ? 'row' : 'column', alignItems: 'center', minHeight: 0}}>
        
        {/* TOGGLE BUTTON */}
        {!isMini && (
          <button 
            onClick={() => setUseCustomPlayer(!useCustomPlayer)}
            style={{position: 'absolute', top: '16px', right: '16px', zIndex: 50, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '8px 12px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', backdropFilter: 'blur(10px)'}}
          >
            <Tv size={16} /> {useCustomPlayer ? 'Watch Video' : 'Hide Video'}
          </button>
        )}

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

        {/* SPOTIFY UI - FULL SCREEN */}
        {useCustomPlayer && !isMini && (
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0, justifyContent: 'space-between'}}>
            {/* Top Info Area */}
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 32px', width: '100%', minHeight: 0}}>
              {currentVideoData ? (
                <div style={{width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 0}}>
                  <img 
                    src={`https://i.ytimg.com/vi/${currentVideoData.video_id}/maxresdefault.jpg`} 
                    onError={(e) => { e.target.src = `https://i.ytimg.com/vi/${currentVideoData.video_id}/hqdefault.jpg`; }}
                    style={{maxHeight: '40vh', maxWidth: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', marginBottom: '24px'}} 
                    alt="Album Art"
                  />
                  <h2 style={{fontSize: '1.4rem', fontWeight: 'bold', margin: '0 0 6px 0', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'white'}}>
                    {currentVideoData.title}
                  </h2>
                  <p style={{fontSize: '1rem', color: '#bbb', margin: 0, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%'}}>
                    {currentVideoData.author}
                  </p>
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#888', width: '100%', textAlign: 'center'}}>
                  <div style={{width: '240px', height: '240px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)'}}>
                     <ListMusic size={80} opacity={0.1} />
                  </div>
                  <h2 style={{fontSize: '1.5rem', marginBottom: '8px', color: '#aaa'}}>Ready to Play</h2>
                  <p style={{color: '#666'}}>Select a song from your playlist to start</p>
                </div>
              )}
            </div>

            {/* FULL CONTROLS */}
            <div style={{padding: '0 32px 32px 32px', width: '100%', maxWidth: '600px'}}>
              {/* Progress Bar */}
              <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', fontSize: '0.8rem', color: '#aaa'}}>
                <span style={{minWidth: '40px', textAlign: 'right'}}>{formatTime(progress)}</span>
                <input 
                  type="range" 
                  min={0} 
                  max={duration || 100} 
                  value={progress} 
                  onChange={handleSeek}
                  style={{flex: 1, accentColor: 'white', height: '4px', cursor: 'pointer', background: 'rgba(255,255,255,0.2)', outline: 'none', borderRadius: '2px'}}
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
          </div>
        )}

        {/* SPOTIFY UI - MINI PLAYER (Bottom Bar) */}
        {useCustomPlayer && isMini && (
          <div style={{display: 'flex', width: '100%', height: '100px', alignItems: 'center', padding: '0 16px', gap: '16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.1)'}}>
            {currentVideoData ? (
              <>
                <img 
                  src={`https://i.ytimg.com/vi/${currentVideoData.video_id}/hqdefault.jpg`} 
                  style={{width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px'}} 
                  alt="Album Art"
                />
                <div style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                  <h3 style={{fontSize: '1rem', fontWeight: 'bold', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {currentVideoData.title}
                  </h3>
                  <p style={{fontSize: '0.8rem', color: '#aaa', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {currentVideoData.author}
                  </p>
                </div>
                
                <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
                  <button 
                    onClick={() => {
                      if (!player) return;
                      if (isPlaying) player.pauseVideo();
                      else player.playVideo();
                    }}
                    style={{background: 'white', border: 'none', color: 'black', borderRadius: '50%', width: '48px', height: '48px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
                  >
                    {isPlaying ? <Pause size={20} fill="black" /> : <PlayIcon size={20} fill="black" style={{marginLeft: '2px'}} />}
                  </button>
                  <button 
                    onClick={() => player && player.nextVideo()}
                    style={{background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex'}}
                  >
                    <SkipForward size={24} fill="white" />
                  </button>
                </div>
              </>
            ) : (
              <div style={{display: 'flex', alignItems: 'center', gap: '16px', color: '#888'}}>
                <div style={{width: '64px', height: '64px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <ListMusic size={24} opacity={0.5} />
                </div>
                <span>Nothing playing</span>
              </div>
            )}
          </div>
        )}
        
      </div>
    </div>
  );
}
