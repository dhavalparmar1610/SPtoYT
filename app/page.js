"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import YouTubePlayer from '@/components/YouTubePlayer';
import PlaylistSync from '@/components/PlaylistSync';
import { Music, PlayCircle } from 'lucide-react';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [spotifyToken, setSpotifyToken] = useState(null);
  const [youtubeToken, setYoutubeToken] = useState(null);
  const [previewYtId, setPreviewYtId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const sToken = searchParams.get('spotify_access_token');
    const yToken = searchParams.get('youtube_access_token');
    const urlError = searchParams.get('error');

    if (urlError) setError(urlError);

    if (sToken) {
      localStorage.setItem('spotify_token', sToken);
      setSpotifyToken(sToken);
    } else {
      const stored = localStorage.getItem('spotify_token');
      if (stored) setSpotifyToken(stored);
    }

    if (yToken) {
      localStorage.setItem('youtube_token', yToken);
      setYoutubeToken(yToken);
    } else {
      const stored = localStorage.getItem('youtube_token');
      if (stored) setYoutubeToken(stored);
    }

    if (sToken || yToken) {
      router.replace('/');
    }
  }, [searchParams, router]);

  const handleLogout = () => {
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('youtube_token');
    setSpotifyToken(null);
    setYoutubeToken(null);
  };

  return (
    <main className="app-container">
      <header className="header">
        <div className="logo-group">
          <div className="logo-icon">
            <Music color="white" size={24} />
          </div>
          <h1 style={{fontSize: '2rem', fontWeight: 'bold'}}>Music Sync</h1>
        </div>
        
        {(spotifyToken || youtubeToken) && (
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        )}
      </header>

      {error && <div className="error-msg">Error: {error}</div>}

      {!spotifyToken || !youtubeToken ? (
        <div className="landing">
          <h2>Unify Your Music</h2>
          <p>Connect both platforms to sync your Spotify playlists seamlessly to YouTube.</p>
          
          <div className="auth-buttons">
            <a href="/api/auth/spotify" className={`auth-btn spotify ${spotifyToken ? 'connected' : ''}`}>
              <Music size={24} />
              {spotifyToken ? 'Spotify Connected' : 'Connect Spotify'}
            </a>
            
            <a href="/api/auth/youtube" className={`auth-btn youtube ${youtubeToken ? 'connected' : ''}`}>
              <PlayCircle size={24} />
              {youtubeToken ? 'YouTube Connected' : 'Connect YouTube'}
            </a>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '24px', height: '400px' }}>
            <YouTubePlayer videoId={previewYtId} />
          </div>
          <div className="sync-container">
            <PlaylistSync 
              spotifyToken={spotifyToken} 
              youtubeToken={youtubeToken} 
              onPreviewVideo={setPreviewYtId}
            />
          </div>
        </div>
      )}
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
