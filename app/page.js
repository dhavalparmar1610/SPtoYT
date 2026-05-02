"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import YouTubePlayer from '@/components/YouTubePlayer';
import PlaylistSync from '@/components/PlaylistSync';
import { Music, PlayCircle } from 'lucide-react';
import axios from 'axios';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [youtubeToken, setYoutubeToken] = useState(null);
  const [previewYtId, setPreviewYtId] = useState(null);
  const [playlistYtId, setPlaylistYtId] = useState(null);
  const [existingPlaylists, setExistingPlaylists] = useState([]);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    const yToken = searchParams.get('youtube_access_token');
    const urlError = searchParams.get('error');

    if (urlError) setError(urlError);

    if (yToken) {
      localStorage.setItem('youtube_token', yToken);
      setYoutubeToken(yToken);
    } else {
      const stored = localStorage.getItem('youtube_token');
      if (stored) setYoutubeToken(stored);
    }

    if (yToken) {
      router.replace('/');
    }
  }, [searchParams, router]);

  const handleLogout = () => {
    localStorage.removeItem('youtube_token');
    setYoutubeToken(null);
    setPreviewYtId(null);
    setPlaylistYtId(null);
  };

  return (
    <main className="app-container">
      <header className="header">
        <div className="logo-group">
          <div className="logo-icon">
            <Music color="white" size={24} />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Music Sync</h1>
          <span className="header-badge">Public Mode</span>
        </div>

        {youtubeToken && (
          <button onClick={handleLogout} className="logout-btn">
            Logout YouTube
          </button>
        )}
      </header>

      {error && (
        <div className="error-msg">
          <span>⚠️ Error: {error}</span>
          <button onClick={() => setError(null)} className="error-dismiss">✕</button>
        </div>
      )}

      {!youtubeToken ? (
        <div className="landing">
          <div className="landing-glow" />
          <h2>Sync Spotify → YouTube</h2>
          <p>
            Paste any <strong>public</strong> Spotify playlist URL and sync it to your YouTube account.
            <br />
            No Spotify login required.
          </p>

          <div className="auth-buttons">
            <a href="/api/auth/youtube" className="auth-btn youtube" id="connect-youtube-btn">
              <PlayCircle size={24} />
              Connect YouTube
            </a>
          </div>

          <div className="landing-note">
            <Music size={14} />
            <span>Works with any public Spotify playlist — no Spotify Premium needed</span>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <select 
                onChange={(e) => {
                  if (e.target.value) {
                    setPlaylistYtId(e.target.value);
                    setPreviewYtId(null);
                  }
                }}
                value={playlistYtId || ''}
                style={{ padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555', minWidth: '300px' }}
              >
                <option value="">▶️ Select a YouTube Playlist to play...</option>
                {existingPlaylists.map(p => (
                  <option key={p.id} value={p.id}>{p.snippet.title}</option>
                ))}
              </select>
            </div>
            <div style={{ height: '400px' }}>
              <YouTubePlayer videoId={previewYtId} playlistId={playlistYtId} />
            </div>
          </div>
          <div className="sync-container">
            <PlaylistSync
              youtubeToken={youtubeToken}
              onPreviewVideo={(id) => { setPreviewYtId(id); setPlaylistYtId(null); }}
              onPlaylistSynced={(id) => { setPlaylistYtId(id); setPreviewYtId(null); }}
            />
          </div>
        </div>
      )}
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#121212' }}>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
