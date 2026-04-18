"use client";

import { useEffect, useState, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Music } from 'lucide-react';

export default function SpotifyPlayer({ token }) {
  const [player, setPlayer] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (!token || scriptLoaded.current) return;

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;

    document.body.appendChild(script);
    scriptLoaded.current = true;

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: 'Music Sync Web Player',
        getOAuthToken: cb => { cb(token); },
        volume: 0.5
      });

      setPlayer(player);

      player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
      });

      player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
      });

      player.addListener('player_state_changed', (state) => {
        if (!state) return;
        setCurrentTrack(state.track_window.current_track);
        setIsPaused(state.paused);
        
        player.getCurrentState().then(state => { 
            (!state) ? setIsActive(false) : setIsActive(true);
        });
      });

      player.connect();
    };

    return () => {
      if (player) player.disconnect();
    };
  }, [token]);

  if (!token) return null;

  return (
    <div className="card">
      <div className="card-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <span style={{color: 'var(--spotify-green)'}}><Music /></span> Spotify Player
        </div>
        <div style={{width: '12px', height: '12px', borderRadius: '50%', background: isActive ? 'var(--spotify-green)' : '#555'}} title={isActive ? "Active" : "Inactive"} />
      </div>

      {currentTrack ? (
        <div className="track-info">
          {currentTrack.album.images[0]?.url && (
            <img 
              src={currentTrack.album.images[0].url} 
              alt={currentTrack.album.name} 
              className="track-img"
            />
          )}
          <h3 className="track-title">{currentTrack.name}</h3>
          <p className="track-artist">
            {currentTrack.artists.map(a => a.name).join(', ')}
          </p>

          <div className="player-controls">
            <button onClick={() => player.previousTrack()}><SkipBack size={28} /></button>
            <button className="play-btn" onClick={() => player.togglePlay()}>
              {isPaused ? <Play size={32} fill="black" /> : <Pause size={32} fill="black" />}
            </button>
            <button onClick={() => player.nextTrack()}><SkipForward size={28} /></button>
          </div>
        </div>
      ) : (
        <div className="track-info" style={{color: 'var(--text-muted)'}}>
          <p style={{marginBottom: '8px'}}>Player ready.</p>
          <p style={{fontSize: '0.9rem', textAlign: 'center'}}>Select "Music Sync Web Player" in your Spotify app to start listening.</p>
        </div>
      )}
    </div>
  );
}
