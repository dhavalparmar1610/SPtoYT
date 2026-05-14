"use client";

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, CheckCircle, XCircle, Clock, Play, Link, Upload, AlertTriangle, Music, Trash2, X } from 'lucide-react';

export default function PlaylistSync({ youtubeToken, onPreviewVideo, onPlaylistSynced, onClose }) {
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
  const [autoSync, setAutoSync] = useState(true);
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

  const loadFromUrl = async () => {
    if (!playlistUrl.trim()) return;
    setIsLoading(true);
    setLoadError(null);
    setPlaylistInfo(null);
    setTracks([]);
    try {
      const res = await axios.get('/api/spotify/public-playlist', { params: { url: playlistUrl.trim() } });
      setPlaylistInfo(res.data.playlist);
      setTracks(res.data.tracks);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Failed to load playlist.');
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
          parsed.push({ name: cols[nameIdx] || '', artist: artistIdx >= 0 ? (cols[artistIdx] || '') : '' });
        }
        setPlaylistInfo({ name: file.name.replace(/\.csv$/i, ''), totalTracks: parsed.length });
        setTracks(parsed);
      } catch { setLoadError('Failed to parse CSV.'); }
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
        const createRes = await axios.post('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
          snippet: { title: playlistInfo?.name || 'Spotify Import', description: 'Synced from Spotify' },
          status: { privacyStatus: 'private' },
        }, { headers: { Authorization: `Bearer ${youtubeToken}` } });
        targetYtPlaylistId = createRes.data.id;
      }
      for (let i = 0; i < syncTracks.length; i++) {
        const track = syncTracks[i];
        const query = `${track.name} ${track.artist}`;
        try {
          const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            headers: { Authorization: `Bearer ${youtubeToken}` },
            params: { part: 'snippet', q: query, type: 'video', videoCategoryId: '10', maxResults: 1 },
          });
          if (searchRes.data.items.length > 0) {
            const videoId = searchRes.data.items[0].id.videoId;
            track.ytId = videoId;
            await axios.post('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
              snippet: { playlistId: targetYtPlaylistId, resourceId: { kind: 'youtube#video', videoId } }
            }, { headers: { Authorization: `Bearer ${youtubeToken}` } });
            track.status = 'synced';
          } else track.status = 'not_found';
        } catch { track.status = 'not_found'; }
        const updatedTracks = [...syncTracks];
        updatedTracks[i] = { ...track };
        setSyncState(prev => ({ ...prev, progress: i + 1, tracks: updatedTracks }));
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) { console.error(err); }
    finally {
      setSyncState(prev => ({ ...prev, isSyncing: false }));
      if (onPlaylistSynced) onPlaylistSynced(targetYtPlaylistId);
    }
  };

  const syncedCount = syncState.tracks.filter(t => t.status === 'synced').length;
  const failedCount = syncState.tracks.filter(t => t.status === 'not_found').length;

  return (
    <div className="premium-sync-container">
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="sync-icon-circle"><RefreshCw className={syncState.isSyncing ? 'animate-spin' : ''} /></div>
          <h2>Playlist Sync</h2>
        </div>
        <button onClick={onClose} className="modal-close-btn"><X size={24} /></button>
      </div>

      <div className="modal-body">
        {playlistInfo && (
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>{playlistInfo.name} loaded</span>
            <button onClick={clearPlaylist} className="clear-btn" disabled={syncState.isSyncing}>
              <Trash2 size={16} /> Reset
            </button>
          </div>
        )}

        {!playlistInfo && (
          <div className="import-section">
            <div className="import-header">
              <Music size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <h3>Import a Spotify Playlist</h3>
              <p style={{ color: '#666', fontSize: '0.9rem' }}>Paste a public Spotify URL or upload a CSV</p>
            </div>
            <div className="url-input-group">
              <input type="text" value={playlistUrl} onChange={(e) => setPlaylistUrl(e.target.value)} placeholder="Spotify Playlist URL..." className="url-input" />
              <button onClick={loadFromUrl} disabled={!playlistUrl.trim() || isLoading} className="load-btn">{isLoading ? 'Loading...' : 'Load'}</button>
            </div>
            <div className="import-divider"><span>or</span></div>
            <button className="csv-btn" onClick={() => fileInputRef.current?.click()} disabled={isLoading}><Upload size={18} /> Upload CSV File</button>
            <input type="file" ref={fileInputRef} onChange={handleCsvUpload} accept=".csv" style={{ display: 'none' }} />
            {loadError && <div className="load-error"><AlertTriangle size={16} /> {loadError}</div>}
          </div>
        )}

        {playlistInfo && (
          <div className="sync-layout">
            <div className="sync-col">
              <div className="playlist-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {tracks.map((t, i) => (
                  <div key={i} className="playlist-track-item">
                    <p className="track-name-text"><strong>{t.name}</strong> - {t.artist}</p>
                  </div>
                ))}
              </div>
              <div className="sync-actions" style={{ marginTop: '20px' }}>
                <select value={selectedPlaylistId} onChange={(e) => setSelectedPlaylistId(e.target.value)} disabled={syncState.isSyncing} className="playlist-select">
                  <option value="new">[+] Create New Playlist</option>
                  {existingPlaylists.map(p => <option key={p.id} value={p.id}>{p.snippet.title}</option>)}
                </select>
                <button onClick={startSync} disabled={tracks.length === 0 || !youtubeToken || syncState.isSyncing} className="sync-btn">
                  {syncState.isSyncing ? 'Syncing...' : 'Sync to YouTube'}
                </button>
              </div>
            </div>
            {syncState.total > 0 && (
              <div className="sync-col" style={{ borderLeft: '1px solid #eee', paddingLeft: '20px' }}>
                <h4 style={{ marginBottom: '12px' }}>Sync Progress</h4>
                <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${(syncState.progress / syncState.total) * 100}%` }} /></div>
                <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>{syncState.progress} / {syncState.total} tracks</p>
                {syncState.progress === syncState.total && <p style={{ color: 'green', fontSize: '0.8rem' }}>✅ {syncedCount} synced · ❌ {failedCount} failed</p>}
                <div className="track-list" style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '12px' }}>
                  {syncState.tracks.map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.8rem' }}>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{t.name}</span>
                      {t.status === 'synced' && <CheckCircle color="green" size={14} />}
                      {t.status === 'not_found' && <XCircle color="red" size={14} />}
                      {t.status === 'pending' && <Clock color="#999" size={14} />}
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
