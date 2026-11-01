"use client";

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Upload, 
  AlertTriangle, 
  Music, 
  Trash2, 
  X,
  Play,
  ArrowRight
} from 'lucide-react';
import { youtubeGet, youtubePost } from '@/lib/api';

export default function PlaylistSync({ youtubeToken, onPlaylistSynced, onClose }) {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistInfo, setPlaylistInfo] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [syncState, setSyncState] = useState({
    isSyncing: false,
    progress: 0,
    total: 0,
    tracks: [],
  });
  const [existingPlaylists, setExistingPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('new');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (youtubeToken) {
      youtubeGet('https://www.googleapis.com/youtube/v3/playlists', {
        part: 'snippet',
        mine: true,
        maxResults: 50
      })
      .then(res => setExistingPlaylists(res.data.items || []))
      .catch(err => console.error('Failed to fetch playlists:', err));
    }
  }, [youtubeToken]);

  const loadFromUrl = async () => {
    if (!playlistUrl.trim()) return;
    setIsLoading(true);
    setLoadError(null);
    setPlaylistInfo(null);
    setTracks([]);
    try {
      const res = await axios.get('/api/spotify/public-playlist', { 
        params: { url: playlistUrl.trim() } 
      });
      setPlaylistInfo(res.data.playlist);
      setTracks(res.data.tracks || []);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Failed to load Spotify playlist. Please verify the URL.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const lines = text.split('\n');
        const header = parseCSVLine(lines[0]);
        const nameIdx = header.findIndex(h => h.toLowerCase().includes('track name') || h.toLowerCase() === 'name');
        const artistIdx = header.findIndex(h => h.toLowerCase().includes('artist name') || h.toLowerCase() === 'artist');
        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (!cols[nameIdx]) continue;
          parsed.push({ 
            name: cols[nameIdx] || '', 
            artist: artistIdx >= 0 ? (cols[artistIdx] || '') : '' 
          });
        }
        setPlaylistInfo({ name: file.name.replace(/\.csv$/i, ''), totalTracks: parsed.length });
        setTracks(parsed);
      } catch { 
        setLoadError('Failed to parse CSV file.'); 
      }
    };
    reader.readAsText(file);
  };

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = false;
        } else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { result.push(current.trim()); current = ''; }
        else current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const clearPlaylist = () => {
    setPlaylistInfo(null);
    setTracks([]);
    setPlaylistUrl('');
    setLoadError(null);
    setSyncState({ isSyncing: false, progress: 0, total: 0, tracks: [] });
  };

  const startSync = async () => {
    if (tracks.length === 0 || !youtubeToken) return;
    const syncTracks = tracks.map(t => ({ name: t.name, artist: t.artist, status: 'pending', ytId: null }));
    setSyncState({ isSyncing: true, progress: 0, total: syncTracks.length, tracks: syncTracks });
    
    let targetYtPlaylistId = selectedPlaylistId === 'new' ? null : selectedPlaylistId;
    try {
      if (!targetYtPlaylistId) {
        const createRes = await youtubePost('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
          snippet: { 
            title: playlistInfo?.name || 'Spotify Import', 
            description: 'Imported from Spotify via Music Sync' 
          },
          status: { privacyStatus: 'private' },
        });
        targetYtPlaylistId = createRes.data.id;
      }

      for (let i = 0; i < syncTracks.length; i++) {
        const track = syncTracks[i];
        const query = `${track.name} ${track.artist}`.trim();
        try {
          const searchRes = await youtubeGet('https://www.googleapis.com/youtube/v3/search', {
            part: 'snippet',
            q: query,
            type: 'video',
            videoCategoryId: '10',
            maxResults: 1
          });

          if (searchRes.data.items && searchRes.data.items.length > 0) {
            const videoId = searchRes.data.items[0].id.videoId;
            track.ytId = videoId;
            await youtubePost('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
              snippet: { 
                playlistId: targetYtPlaylistId, 
                resourceId: { kind: 'youtube#video', videoId } 
              }
            });
            track.status = 'synced';
          } else {
            track.status = 'not_found';
          }
        } catch (err) {
          track.status = 'not_found';
        }

        const updatedTracks = [...syncTracks];
        updatedTracks[i] = { ...track };
        setSyncState(prev => ({ ...prev, progress: i + 1, tracks: updatedTracks }));
        await new Promise(r => setTimeout(r, 450)); // Quota friendly delay
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncState(prev => ({ ...prev, isSyncing: false }));
      if (onPlaylistSynced) onPlaylistSynced(targetYtPlaylistId);
    }
  };

  const syncedCount = syncState.tracks.filter(t => t.status === 'synced').length;
  const failedCount = syncState.tracks.filter(t => t.status === 'not_found').length;
  const progressPercent = syncState.total > 0 ? (syncState.progress / syncState.total) * 100 : 0;

  return (
    <div className="spotify-sync-modal">
      <div className="sync-modal-header">
        <div className="sync-header-title-box">
          <div className="sync-icon-emblem">
            <RefreshCw className={syncState.isSyncing ? 'animate-spin' : ''} size={22} color="#1DB954" />
          </div>
          <div>
            <h2>Spotify to YouTube Sync</h2>
            <p className="sync-subtitle">Import your Spotify playlists and convert them to YouTube Music</p>
          </div>
        </div>
        <button onClick={onClose} className="sync-close-btn" title="Close">
          <X size={22} />
        </button>
      </div>

      <div className="sync-modal-body">
        {playlistInfo && (
          <div className="sync-loaded-banner">
            <div className="banner-info">
              <span className="banner-tag">LOADED</span>
              <h3>{playlistInfo.name}</h3>
              <p>{tracks.length} tracks found</p>
            </div>
            <button 
              onClick={clearPlaylist} 
              className="sync-reset-btn" 
              disabled={syncState.isSyncing}
            >
              <Trash2 size={16} />
              <span>Reset</span>
            </button>
          </div>
        )}

        {!playlistInfo && (
          <div className="sync-input-card">
            <div className="input-card-hero">
              <div className="spotify-hero-icon-circle">
                <Music size={32} color="#1DB954" />
              </div>
              <h3>Enter Spotify Playlist URL</h3>
              <p>Paste any public Spotify playlist URL or link</p>
            </div>

            <div className="url-bar-group">
              <input 
                type="text" 
                value={playlistUrl} 
                onChange={(e) => setPlaylistUrl(e.target.value)} 
                placeholder="https://open.spotify.com/playlist/..." 
                className="spotify-text-input" 
                disabled={isLoading}
              />
              <button 
                onClick={loadFromUrl} 
                disabled={!playlistUrl.trim() || isLoading} 
                className="spotify-accent-btn"
              >
                {isLoading ? 'Loading...' : 'Load Playlist'}
              </button>
            </div>

            <div className="sync-or-divider">
              <span>OR</span>
            </div>

            <button 
              className="spotify-outline-btn" 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isLoading}
            >
              <Upload size={18} />
              <span>Upload CSV Export</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleCsvUpload} 
              accept=".csv" 
              style={{ display: 'none' }} 
            />

            {loadError && (
              <div className="sync-error-banner">
                <AlertTriangle size={18} />
                <span>{loadError}</span>
              </div>
            )}
          </div>
        )}

        {playlistInfo && (
          <div className="sync-workflow-grid">
            <div className="sync-workflow-col">
              <h4 className="workflow-col-title">Tracks Preview ({tracks.length})</h4>
              <div className="tracks-preview-scroll">
                {tracks.map((t, i) => (
                  <div key={i} className="preview-track-item">
                    <span className="preview-track-idx">{i + 1}</span>
                    <div className="preview-track-meta">
                      <strong className="track-name">{t.name}</strong>
                      <span className="track-artist">{t.artist}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="destination-config-box">
                <label>Target YouTube Playlist:</label>
                <select 
                  value={selectedPlaylistId} 
                  onChange={(e) => setSelectedPlaylistId(e.target.value)} 
                  disabled={syncState.isSyncing} 
                  className="spotify-select-input"
                >
                  <option value="new">[+] Create New Playlist: &quot;{playlistInfo.name}&quot;</option>
                  {existingPlaylists.map(p => (
                    <option key={p.id} value={p.id}>
                      Existing: {p.snippet?.title}
                    </option>
                  ))}
                </select>

                <button 
                  onClick={startSync} 
                  disabled={tracks.length === 0 || !youtubeToken || syncState.isSyncing} 
                  className="spotify-big-sync-btn"
                >
                  {syncState.isSyncing ? (
                    <>
                      <RefreshCw className="animate-spin" size={20} />
                      <span>Syncing tracks ({syncState.progress}/{syncState.total})...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight size={20} />
                      <span>Start Sync to YouTube</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {syncState.total > 0 && (
              <div className="sync-workflow-col status-col">
                <h4 className="workflow-col-title">Conversion Progress</h4>
                
                <div className="spotify-progress-meter">
                  <div 
                    className="spotify-progress-fill" 
                    style={{ width: `${progressPercent}%` }} 
                  />
                </div>

                <div className="progress-stats-row">
                  <span>{syncState.progress} of {syncState.total} tracks processed</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>

                {syncState.progress === syncState.total && (
                  <div className="sync-summary-banner">
                    <CheckCircle color="#1DB954" size={20} />
                    <span>Sync Complete: {syncedCount} synced · {failedCount} not found</span>
                  </div>
                )}

                <div className="sync-live-log-list">
                  {syncState.tracks.map((t, i) => (
                    <div key={i} className="live-log-row">
                      <span className="log-track-name">{t.name}</span>
                      <span className="log-status-icon">
                        {t.status === 'synced' && <CheckCircle color="#1DB954" size={16} />}
                        {t.status === 'not_found' && <XCircle color="#E91429" size={16} />}
                        {t.status === 'pending' && <Clock color="#6A6A6A" size={16} />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
