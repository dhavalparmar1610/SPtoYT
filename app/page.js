"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PlaylistSync from '@/components/PlaylistSync';
import CarPlayUI from '@/components/CarPlayUI';
import { Music, PlayCircle } from 'lucide-react';
import axios from 'axios';

import Navigation from '@/components/Navigation';
import YouTubePlayer from '@/components/YouTubePlayer';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [youtubeToken, setYoutubeToken] = useState(null);
  const [existingPlaylists, setExistingPlaylists] = useState([]);
  const [activeTab, setActiveTab] = useState('player');
  const [searchQuery, setSearchQuery] = useState('');
  
  // GLOBAL PLAYER STATE
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);

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
    const storedToken = localStorage.getItem('youtube_token');
    if (storedToken) setYoutubeToken(storedToken);
    
    const token = searchParams.get('youtube_access_token');
    if (token) {
      localStorage.setItem('youtube_token', token);
      setYoutubeToken(token);
      router.replace('/');
    }
  }, [searchParams, router]);

  const handleLogout = () => {
    localStorage.removeItem('youtube_token');
    setYoutubeToken(null);
  };

  const handlePlayVideo = (videoId) => {
    setActivePlaylistId(null);
    setActiveVideoId(videoId);
    setPlayingIndex(-1);
    setIsPlayerExpanded(true);
  };

  const handlePlayPlaylist = (playlistId, index = 0) => {
    setActivePlaylistId(playlistId);
    setActiveVideoId(null);
    setPlayingIndex(index);
    setIsPlayerExpanded(true);
  };

  return (
    <main className="app-container">
      {youtubeToken ? (
        <div className="dashboard-wrapper">
          <Navigation 
            activeTab={activeTab} 
            onTabChange={setActiveTab} 
            onLogout={handleLogout}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
          />

          <div className="content-area">
            <CarPlayUI 
              youtubeToken={youtubeToken} 
              existingPlaylists={existingPlaylists} 
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              onPlayVideo={handlePlayVideo}
              onPlayPlaylist={handlePlayPlaylist}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
            
            {activeTab === 'sync' && (
              <div className="sync-overlay">
                <div className="sync-content-wrapper">
                  <PlaylistSync
                    youtubeToken={youtubeToken}
                    onClose={() => setActiveTab('player')}
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

          {/* PERSISTENT BOTTOM PLAYER */}
          {(activeVideoId || activePlaylistId) && (
            <div className={`persistent-bottom-player ${isPlayerExpanded ? 'expanded' : 'minimized'}`}>
               {isPlayerExpanded && (
                 <div className="player-drag-handle" onClick={() => setIsPlayerExpanded(false)}>
                   <div className="handle-bar" />
                 </div>
               )}
               <YouTubePlayer 
                 videoId={activeVideoId} 
                 playlistId={activePlaylistId} 
                 initialIndex={playingIndex}
                 isMini={!isPlayerExpanded}
                 onToggleExpand={() => setIsPlayerExpanded(!isPlayerExpanded)}
               />
            </div>
          )}
        </div>
      ) : (
        <div className="landing">
          <div className="landing-glow" />
          <div className="landing-content">
            <div className="landing-icon">🎵</div>
            <h1>Music Sync PWA</h1>
            <p>Your Spotify Library on YouTube Music interface.</p>
            <div className="auth-buttons">
              <a href="/api/auth/youtube" className="auth-btn youtube">
                <PlayCircle size={24} /> Connect YouTube
              </a>
            </div>
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
