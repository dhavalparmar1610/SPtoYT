"use client";

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, CheckCircle, XCircle, Clock, Play, Link, Upload, AlertTriangle, Music, Trash2 } from 'lucide-react';

export default function PlaylistSync({ youtubeToken, onPreviewVideo, onPlaylistSynced }) {
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
  const [autoSync, setAutoSync] = useState(false);
  const [existingPlaylists, setExistingPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('new');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (youtubeToken) {
      axios.get('https://www.googleapis.com/youtube/v3/playlists', {
        headers: { Authorization: `Bearer ${youtubeToken}` },
        params: { part: 'snippet', mine: true, maxResults: 50 },
      })
      .then(res => setExistingPlaylists(res.data.items || []))
      .catch(err => console.error('Failed to fetch playlists', err));
    }
  }, [youtubeToken]);

  // ── Load from Public Spotify URL ──────────────────────────
  const loadFromUrl = async () => {
    if (!playlistUrl.trim()) return;
    setIsLoading(true);
    setLoadError(null);
    setPlaylistInfo(null);
    setTracks([]);

    try {
      const res = await axios.get('/api/spotify/public-playlist', {
        params: { url: playlistUrl.trim() },
      });

      setPlaylistInfo(res.data.playlist);
      setTracks(res.data.tracks);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to load playlist. Check the URL and try again.';
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Load from CSV (Exportify format) ──────────────────────
  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const lines = text.split('\n');
        if (lines.length < 2) {
          setLoadError('CSV file appears to be empty.');
          return;
        }

        // Parse header to find column indices
        const header = parseCSVLine(lines[0]);
        const nameIdx = header.findIndex(h => h.toLowerCase().includes('track name') || h.toLowerCase() === 'name');
        const artistIdx = header.findIndex(h => h.toLowerCase().includes('artist name') || h.toLowerCase() === 'artist');
        const albumIdx = header.findIndex(h => h.toLowerCase().includes('album name') || h.toLowerCase() === 'album');

        if (nameIdx === -1) {
          setLoadError('Could not find a "Track Name" column in CSV. Use Exportify format.');
          return;
        }

        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (!cols[nameIdx]) continue;
          parsed.push({
            name: cols[nameIdx] || '',
            artist: artistIdx >= 0 ? (cols[artistIdx] || '') : '',
            album: albumIdx >= 0 ? (cols[albumIdx] || '') : '',
            albumArt: null,
          });
        }

        if (parsed.length === 0) {
          setLoadError('No tracks found in CSV.');
          return;
        }

        setPlaylistInfo({
          name: file.name.replace(/\.csv$/i, ''),
          description: `Imported from CSV (${parsed.length} tracks)`,
          image: null,
          totalTracks: parsed.length,
        });
        setTracks(parsed);
      } catch {
        setLoadError('Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── CSV line parser (handles quoted fields) ───────────────
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  }

  // ── Clear loaded playlist ─────────────────────────────────
  const clearPlaylist = () => {
    setPlaylistInfo(null);
    setTracks([]);
    setPlaylistUrl('');
    setLoadError(null);
    setSyncState({ isSyncing: false, progress: 0, total: 0, tracks: [] });
  };

  // ── Start YouTube Sync ────────────────────────────────────
  const startSync = async () => {
    if (tracks.length === 0 || !youtubeToken) return;

    const syncTracks = tracks.map(t => ({
      name: t.name,
      artist: t.artist,
      status: 'pending',
      ytId: null,
    }));

    setSyncState({ isSyncing: true, progress: 0, total: syncTracks.length, tracks: syncTracks });

    let targetYtPlaylistId = selectedPlaylistId === 'new' ? null : selectedPlaylistId;

    try {
      const playlistName = playlistInfo?.name || 'Spotify Import';

      // Create playlist if not found
      if (!targetYtPlaylistId) {
        const createRes = await axios.post(
          'https://www.googleapis.com/youtube/v3/playlists?part=snippet,status',
          {
            snippet: {
              title: playlistName,
              description: 'Synced from Spotify via Music Sync App',
            },
            status: { privacyStatus: 'private' },
          },
          { headers: { Authorization: `Bearer ${youtubeToken}` } }
        );
        targetYtPlaylistId = createRes.data.id;
      }

      // Fetch existing videos for diff (Smart Auto-Sync)
      const existingYtVideoIds = new Set();
      if (autoSync && targetYtPlaylistId) {
        try {
          let nextPageToken = null;
          do {
            const itemsRes = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
              headers: { Authorization: `Bearer ${youtubeToken}` },
              params: {
                part: 'snippet',
                playlistId: targetYtPlaylistId,
                maxResults: 50,
                pageToken: nextPageToken || undefined,
              },
            });
            itemsRes.data.items.forEach(item => {
              existingYtVideoIds.add(item.snippet.resourceId.videoId);
            });
            nextPageToken = itemsRes.data.nextPageToken || null;
          } while (nextPageToken);
        } catch (e) {
          console.error('Failed to fetch existing YT items for diffing', e);
        }
      }

      // Sync each track
      for (let i = 0; i < syncTracks.length; i++) {
        const track = syncTracks[i];
        const query = `${track.name} ${track.artist} official audio`;

        try {
          const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            headers: { Authorization: `Bearer ${youtubeToken}` },
            params: { part: 'snippet', q: query, type: 'video', maxResults: 1 },
          });

          if (searchRes.data.items.length > 0) {
            const videoId = searchRes.data.items[0].id.videoId;
            track.ytId = videoId;

            if (autoSync && existingYtVideoIds.has(videoId)) {
              track.status = 'synced';
            } else {
              await axios.post(
                'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
                {
                  snippet: {
                    playlistId: targetYtPlaylistId,
                    resourceId: { kind: 'youtube#video', videoId },
                  },
                },
                { headers: { Authorization: `Bearer ${youtubeToken}` } }
              );
              track.status = 'synced';
              existingYtVideoIds.add(videoId);
            }
          } else {
            track.status = 'not_found';
          }
        } catch (err) {
          const isAuthError = err.response?.status === 401;
          console.error(`Error syncing track ${track.name}`, err);
          
          if (isAuthError) {
            setLoadError('YouTube session expired. Please sign in again to continue syncing.');
            track.status = 'failed';
            const updatedTracks = [...syncTracks];
            updatedTracks[i] = { ...track };
            setSyncState(prev => ({ ...prev, progress: i + 1, tracks: updatedTracks, isSyncing: false }));
            return; // STOP SYNC
          }
          
          track.status = 'not_found';
        }

        const updatedTracks = [...syncTracks];
        updatedTracks[i] = { ...track };
        setSyncState(prev => ({ ...prev, progress: i + 1, tracks: updatedTracks }));

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error('Sync failed', err);
    } finally {
      setSyncState(prev => ({ ...prev, isSyncing: false }));
      if (onPlaylistSynced && targetYtPlaylistId) {
        onPlaylistSynced(targetYtPlaylistId);
      }
    }
  };

  const syncedCount = syncState.tracks.filter(t => t.status === 'synced').length;
  const failedCount = syncState.tracks.filter(t => t.status === 'not_found').length;

  return (
    <div className="card sync-card">
      <h2 className="card-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw
            className={syncState.isSyncing ? 'animate-spin' : ''}
            color={syncState.isSyncing ? 'var(--spotify-green)' : 'var(--text-muted)'}
          />
          Playlist Sync
        </div>
        {playlistInfo && (
          <button onClick={clearPlaylist} className="clear-btn" title="Clear & start over" disabled={syncState.isSyncing}>
            <Trash2 size={16} />
          </button>
        )}
      </h2>

      {/* ── Import Section (shown when no playlist is loaded) ─── */}
      {!playlistInfo && (
        <div className="import-section">
          <div className="import-header">
            <Music size={40} style={{ opacity: 0.3 }} />
            <h3>Import a Spotify Playlist</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Paste a public Spotify playlist URL or upload a CSV from{' '}
              <a href="https://exportify.app" target="_blank" rel="noopener noreferrer" className="ext-link">
                Exportify
              </a>
            </p>
          </div>

          {/* URL Input */}
          <div className="url-input-group">
            <div className="url-input-wrapper">
              <Link size={16} className="url-icon" />
              <input
                type="text"
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder="https://open.spotify.com/playlist/..."
                className="url-input"
                onKeyDown={(e) => e.key === 'Enter' && loadFromUrl()}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={loadFromUrl}
              disabled={!playlistUrl.trim() || isLoading}
              className="load-btn"
            >
              {isLoading ? 'Loading...' : 'Load'}
            </button>
          </div>

          <div className="import-divider">
            <span>or</span>
          </div>

          {/* CSV Upload */}
          <button
            className="csv-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <Upload size={18} />
            Upload CSV File
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleCsvUpload}
            accept=".csv"
            style={{ display: 'none' }}
          />

          {/* Error */}
          {loadError && (
            <div className="load-error">
              <AlertTriangle size={16} />
              {loadError}
            </div>
          )}
        </div>
      )}

      {/* ── Playlist Loaded — show tracks + sync controls ─────── */}
      {playlistInfo && (
        <div className="sync-layout">
          {/* Left: Loaded Playlist Info + Tracks */}
          <div className="sync-col left">
            {/* Playlist Header */}
            <div className="loaded-playlist-header">
              {playlistInfo.image && (
                <img src={playlistInfo.image} alt={playlistInfo.name} className="loaded-playlist-img" />
              )}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <h3 className="loaded-playlist-name">{playlistInfo.name}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {tracks.length} tracks loaded
                </p>
              </div>
            </div>

            {/* Track list */}
            <div className="playlist-list">
              {tracks.map((t, i) => (
                <div key={i} className="playlist-track-item">
                  {t.albumArt && <img src={t.albumArt} alt="" className="track-thumb" />}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p className="track-name-text">{t.name}</p>
                    <p className="track-artist-text">{t.artist}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Sync Controls */}
            <div className="sync-actions">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  disabled={syncState.isSyncing}
                  id="autoSyncCb"
                />
                <label htmlFor="autoSyncCb" style={{ fontSize: '0.9rem', color: '#ccc', cursor: 'pointer' }}>
                  Smart Auto-Sync (skip existing)
                </label>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', color: '#ccc', marginBottom: '4px' }}>Target Playlist</label>
                <select 
                  value={selectedPlaylistId}
                  onChange={(e) => setSelectedPlaylistId(e.target.value)}
                  disabled={syncState.isSyncing}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}
                >
                  <option value="new">[+] Create New Playlist</option>
                  {existingPlaylists.map(p => (
                    <option key={p.id} value={p.id}>{p.snippet.title}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={startSync}
                disabled={tracks.length === 0 || !youtubeToken || syncState.isSyncing}
                className="sync-btn"
              >
                {syncState.isSyncing ? 'Syncing...' : 'Sync to YouTube'}
              </button>
            </div>
          </div>

          {/* Right: Sync Progress */}
          <div className="sync-col">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '16px', color: '#ccc' }}>
              Sync Progress
            </h3>

            {syncState.total > 0 ? (
              <>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${(syncState.progress / syncState.total) * 100}%` }}
                  />
                </div>
                <div className="progress-stats">
                  <span>{syncState.progress} / {syncState.total} tracks</span>
                  {syncState.progress === syncState.total && (
                    <span className="progress-summary">
                      ✅ {syncedCount} synced · ❌ {failedCount} not found
                    </span>
                  )}
                </div>

                <div className="track-list">
                  {syncState.tracks.map((t, i) => (
                    <div key={i} className="track-list-item">
                      <div style={{ flex: 1, overflow: 'hidden', paddingRight: '16px' }}>
                        <p style={{ fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {t.name}
                        </p>
                        <p style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {t.artist}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {t.ytId && (
                          <button
                            onClick={() => onPreviewVideo && onPreviewVideo(t.ytId)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
                <p>Click "Sync to YouTube" to start.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
