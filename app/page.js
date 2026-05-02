"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PlaylistSync from '@/components/PlaylistSync';
import CarPlayUI from '@/components/CarPlayUI';
import { Music, PlayCircle } from 'lucide-react';
import axios from 'axios';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [youtubeToken, setYoutubeToken] = useState(null);
  const [existingPlaylists, setExistingPlaylists] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('player');

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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '32px', padding: '0 32px', borderBottom: '1px solid #333', marginBottom: '0' }}>
            <button 
              onClick={() => setActiveTab('player')} 
              style={{ background: 'none', border: 'none', color: activeTab === 'player' ? 'white' : '#888', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', padding: '16px 0', borderBottom: activeTab === 'player' ? '2px solid var(--spotify-green)' : '2px solid transparent' }}
            >
              Music Player
            </button>
            <button 
              onClick={() => setActiveTab('sync')} 
              style={{ background: 'none', border: 'none', color: activeTab === 'sync' ? 'white' : '#888', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', padding: '16px 0', borderBottom: activeTab === 'sync' ? '2px solid var(--spotify-green)' : '2px solid transparent' }}
            >
              Playlist Sync
            </button>
          </div>

          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <CarPlayUI 
              youtubeToken={youtubeToken} 
              existingPlaylists={existingPlaylists} 
              isMini={activeTab === 'sync'}
            />
            
            {activeTab === 'sync' && (
              <div style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: 'calc(100% - 100px)', 
                overflowY: 'auto', 
                background: '#0a0a0f', 
                zIndex: 100, 
                padding: '24px' 
              }}>
                <div style={{maxWidth: '900px', margin: '0 auto'}}>
                  <PlaylistSync
                    youtubeToken={youtubeToken}
                    onPlaylistSynced={() => { 
                      axios.get('https://www.googleapis.com/youtube/v3/playlists', {
                        headers: { Authorization: `Bearer ${youtubeToken}` },
                        params: { part: 'snippet', mine: true, maxResults: 50 },
                      }).then(res => setExistingPlaylists(res.data.items || []));
                    }}
                  />
                </div>
              </div>
            )}
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
