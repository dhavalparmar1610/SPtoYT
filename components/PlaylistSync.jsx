"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, CheckCircle, XCircle, Clock, Play } from 'lucide-react';

export default function PlaylistSync({ spotifyToken, youtubeToken, onPreviewVideo }) {
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [syncState, setSyncState] = useState({
    isSyncing: false,
    progress: 0,
    total: 0,
    tracks: [],
  });
  const [autoSync, setAutoSync] = useState(false);

  useEffect(() => {
    if (spotifyToken) {
      fetchSpotifyPlaylists();
    }
  }, [spotifyToken]);

  const fetchSpotifyPlaylists = async () => {
    try {
      const res = await axios.get('https://api.spotify.com/v1/me/playlists', {
        headers: { Authorization: `Bearer ${spotifyToken}` }
      });
      setPlaylists(res.data.items);
    } catch (err) {
      console.error('Failed to fetch Spotify playlists', err);
    }
  };

  const startSync = async () => {
    if (!selectedPlaylist || !youtubeToken) return;

    setSyncState({ isSyncing: true, progress: 0, total: 0, tracks: [] });

    try {
      const tracksRes = await axios.get(`https://api.spotify.com/v1/playlists/${selectedPlaylist.id}/tracks`, {
        headers: { Authorization: `Bearer ${spotifyToken}` }
      });
      
      const tracks = tracksRes.data.items
        .filter(item => item.track)
        .map(item => ({
          name: item.track.name,
          artist: item.track.artists[0]?.name || '',
          status: 'pending'
        }));

      setSyncState(prev => ({ ...prev, total: tracks.length, tracks }));

      let targetYtPlaylistId = null;

      if (autoSync) {
        const ytPlaylistsRes = await axios.get('https://www.googleapis.com/youtube/v3/playlists', {
          headers: { Authorization: `Bearer ${youtubeToken}` },
          params: { part: 'snippet', mine: true, maxResults: 50 }
        });
        
        const existingPlaylist = ytPlaylistsRes.data.items.find(
          p => p.snippet.title === selectedPlaylist.name
        );

        if (existingPlaylist) {
          targetYtPlaylistId = existingPlaylist.id;
        }
      }

      if (!targetYtPlaylistId) {
        const createRes = await axios.post('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
          snippet: {
            title: selectedPlaylist.name,
            description: 'Synced from Spotify via Music Sync App'
          },
          status: { privacyStatus: 'private' }
        }, {
          headers: { Authorization: `Bearer ${youtubeToken}` }
        });
        targetYtPlaylistId = createRes.data.id;
      }

      const existingYtVideoIds = new Set();
      if (autoSync && targetYtPlaylistId) {
        try {
          const itemsRes = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
            headers: { Authorization: `Bearer ${youtubeToken}` },
            params: { part: 'snippet', playlistId: targetYtPlaylistId, maxResults: 50 }
          });
          itemsRes.data.items.forEach(item => {
            existingYtVideoIds.add(item.snippet.resourceId.videoId);
          });
        } catch (e) {
          console.error('Failed to fetch existing YT items for diffing', e);
        }
      }

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const query = `${track.name} ${track.artist} official`;

        try {
          const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            headers: { Authorization: `Bearer ${youtubeToken}` },
            params: { part: 'snippet', q: query, type: 'video', maxResults: 1 }
          });

          if (searchRes.data.items.length > 0) {
            const videoId = searchRes.data.items[0].id.videoId;
            track.ytId = videoId;

            if (autoSync && existingYtVideoIds.has(videoId)) {
              track.status = 'synced';
            } else {
              await axios.post('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
                snippet: {
                  playlistId: targetYtPlaylistId,
                  resourceId: { kind: 'youtube#video', videoId: videoId }
                }
              }, {
                headers: { Authorization: `Bearer ${youtubeToken}` }
              });
              track.status = 'synced';
              existingYtVideoIds.add(videoId);
            }
          } else {
            track.status = 'not_found';
          }
        } catch (err) {
          console.error(`Error syncing track ${track.name}`, err);
          track.status = 'not_found';
        }

        const newTracks = [...tracks];
        newTracks[i] = track;
        setSyncState(prev => ({ ...prev, progress: i + 1, tracks: newTracks }));

        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (err) {
      console.error('Sync failed', err);
    } finally {
      setSyncState(prev => ({ ...prev, isSyncing: false }));
    }
  };

  return (
    <div className="card">
      <h2 className="card-header" style={{marginBottom: '24px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <RefreshCw className={syncState.isSyncing ? "animate-spin" : ""} color={syncState.isSyncing ? "var(--spotify-green)" : "var(--text-muted)"} />
          Playlist Sync
        </div>
      </h2>

      <div className="sync-layout">
        <div className="sync-col left">
          <h3 style={{fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '16px', color: '#ccc'}}>Your Spotify Playlists</h3>
          <div className="playlist-list">
            {playlists.map(p => (
              <button
                key={p.id}
                onClick={() => !syncState.isSyncing && setSelectedPlaylist(p)}
                className={`playlist-item ${selectedPlaylist?.id === p.id ? 'selected' : ''}`}
                disabled={syncState.isSyncing}
              >
                {p.images && p.images[0] && (
                  <img src={p.images[0].url} alt={p.name} />
                )}
                <div style={{flex: 1, overflow: 'hidden'}}>
                  <p style={{fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{p.name}</p>
                  <p style={{fontSize: '0.8rem', opacity: 0.75}}>{p.tracks.total} tracks</p>
                </div>
              </button>
            ))}
            {playlists.length === 0 && (
              <p style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>No playlists found.</p>
            )}
          </div>

          <div className="sync-actions">
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
              <input 
                type="checkbox" 
                checked={autoSync} 
                onChange={(e) => setAutoSync(e.target.checked)}
                disabled={syncState.isSyncing}
                id="autoSyncCb"
              />
              <label htmlFor="autoSyncCb" style={{fontSize: '0.9rem', color: '#ccc', cursor: 'pointer'}}>
                Smart Auto-Sync (diff existing)
              </label>
            </div>
            <button
              onClick={startSync}
              disabled={!selectedPlaylist || !youtubeToken || syncState.isSyncing}
              className="sync-btn"
            >
              {syncState.isSyncing ? 'Syncing...' : 'Sync to YouTube'}
            </button>
          </div>
        </div>

        <div className="sync-col">
          <h3 style={{fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '16px', color: '#ccc'}}>Sync Progress</h3>
          
          {syncState.total > 0 ? (
            <>
              <div className="progress-bar-bg">
                <div 
                  className="progress-bar-fill"
                  style={{ width: `${(syncState.progress / syncState.total) * 100}%` }}
                />
              </div>
              <p style={{fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', textAlign: 'right'}}>
                {syncState.progress} / {syncState.total} tracks
              </p>

              <div className="track-list">
                {syncState.tracks.map((t, i) => (
                  <div key={i} className="track-list-item">
                    <div style={{flex: 1, overflow: 'hidden', paddingRight: '16px'}}>
                      <p style={{fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{t.name}</p>
                      <p style={{color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{t.artist}</p>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                      {t.ytId && (
                        <button 
                          onClick={() => onPreviewVideo && onPreviewVideo(t.ytId)}
                          style={{background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'}}
                          title="Preview in YouTube Player"
                        >
                          <Play size={16} />
                        </button>
                      )}
                      {t.status === 'pending' && <Clock color="var(--text-muted)" size={18} />}
                      {t.status === 'synced' && <CheckCircle color="var(--spotify-green)" size={18} />}
                      {t.status === 'not_found' && <XCircle color="var(--youtube-red)" size={18} />}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'}}>
              <RefreshCw size={48} style={{marginBottom: '16px', opacity: 0.2}} />
              <p>Select a playlist and click Sync to start.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
