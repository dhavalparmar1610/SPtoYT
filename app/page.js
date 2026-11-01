"use client";

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PlaylistSync from '@/components/PlaylistSync';
import CarPlayUI from '@/components/CarPlayUI';
import Navigation from '@/components/Navigation';
import YouTubePlayer from '@/components/YouTubePlayer';
import { PlayCircle, Music2, ShieldCheck, Zap, Radio, Sparkles } from 'lucide-react';
import axios from 'axios';
import { getValidYouTubeToken, youtubeGet } from '@/lib/api';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [youtubeToken, setYoutubeToken] = useState(null);
  const [existingPlaylists, setExistingPlaylists] = useState([]);
  const [activeTab, setActiveTab] = useState('player'); // 'player' | 'search' | 'library' | 'liked' | 'sync'
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // GLOBAL PERSISTENT PLAYER STATE
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [activeQueue, setActiveQueue] = useState([]);
  const [playingIndex, setPlayingIndex] = useState(0);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);

  // Restore or initialize authentication from URL, localStorage, or server SQLite session
  useEffect(() => {
    const initAuth = async () => {
      setAuthLoading(true);

      // Check if tokens were returned in callback URL
      const urlToken = searchParams.get('youtube_access_token');
      const urlRefresh = searchParams.get('youtube_refresh_token');
      const urlExpiry = searchParams.get('youtube_expiry_date');

      if (urlToken) {
        localStorage.setItem('youtube_token', urlToken);
        if (urlRefresh) localStorage.setItem('youtube_refresh_token', urlRefresh);
        if (urlExpiry) localStorage.setItem('youtube_token_expiry', urlExpiry);

        setYoutubeToken(urlToken);

        // Sync to server SQLite session
        try {
          await axios.post('/api/auth/session', {
            youtube_access_token: urlToken,
            youtube_refresh_token: urlRefresh,
            youtube_expiry_date: urlExpiry
          });
        } catch (e) {
          console.warn('Failed to persist session to server:', e);
        }

        router.replace('/');
        setAuthLoading(false);
        return;
      }

      // Check existing token via API helper (restores from localStorage or SQLite)
      try {
        const token = await getValidYouTubeToken();
        if (token) {
          setYoutubeToken(token);
        }
      } catch (err) {
        console.warn('Could not restore YouTube token:', err);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();
  }, [searchParams, router]);

  // Fetch user playlists
  const fetchPlaylists = useCallback(async () => {
    if (!youtubeToken) return;
    try {
      const res = await youtubeGet('https://www.googleapis.com/youtube/v3/playlists', {
        part: 'snippet,contentDetails',
        mine: true,
        maxResults: 50
      });
      setExistingPlaylists(res.data.items || []);
    } catch (err) {
      console.warn('Failed to fetch playlists:', err);
    }
  }, [youtubeToken]);

  useEffect(() => {
    if (youtubeToken) {
      fetchPlaylists();
    }
  }, [youtubeToken, fetchPlaylists]);

  const handleLogout = async () => {
    localStorage.removeItem('youtube_token');
    localStorage.removeItem('youtube_refresh_token');
    localStorage.removeItem('youtube_token_expiry');
    setYoutubeToken(null);
    setActiveVideoId(null);
    setActivePlaylistId(null);
    setActiveQueue([]);

    try {
      await axios.delete('/api/auth/session');
    } catch (e) {
      console.warn('Logout session clear error:', e);
    }
  };

  const handlePlayVideo = (videoId, queue = [], index = 0) => {
    setActivePlaylistId(null);
    setActiveVideoId(videoId);
    setActiveQueue(queue);
    setPlayingIndex(index);
    // On mobile / desktop, keep minimized by default or allow user to open, so they can keep browsing
    // We do NOT forcibly expand to fullscreen so users can keep browsing without having to minimize!
  };

  const handlePlayPlaylist = (playlistId, index = 0) => {
    setActivePlaylistId(playlistId);
    setActiveVideoId(null);
    setActiveQueue([]);
    setPlayingIndex(index);
  };

  // Queue Next / Previous Track handlers
  const handleNextTrack = () => {
    if (activeQueue.length > 1) {
      const nextIdx = (playingIndex + 1) % activeQueue.length;
      setPlayingIndex(nextIdx);
      setActiveVideoId(activeQueue[nextIdx]);
    }
  };

  const handlePrevTrack = () => {
    if (activeQueue.length > 1) {
      const prevIdx = (playingIndex - 1 + activeQueue.length) % activeQueue.length;
      setPlayingIndex(prevIdx);
      setActiveVideoId(activeQueue[prevIdx]);
    }
  };

  if (authLoading) {
    return (
      <div className="spotify-app-loader">
        <div className="spotify-loader-circle">
          <Music2 size={36} color="#1DB954" className="animate-spin" />
        </div>
        <p>Loading your Spotify & YouTube library...</p>
      </div>
    );
  }

  return (
    <main className="spotify-app-layout">
      {youtubeToken ? (
        <div className="spotify-dashboard-container">
          {/* Spotify Sidebar (Desktop) & Top Header + Bottom Nav (Mobile) */}
          <Navigation 
            activeTab={activeTab} 
            onTabChange={setActiveTab} 
            onLogout={handleLogout}
            onOpenCreatePlaylist={() => setIsCreatingPlaylist(true)}
          />

          {/* Main Streaming & Browsing Content */}
          <div className="spotify-content-viewport">
            <CarPlayUI 
              youtubeToken={youtubeToken} 
              existingPlaylists={existingPlaylists} 
              onPlayVideo={handlePlayVideo}
              onPlayPlaylist={handlePlayPlaylist}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isCreatingPlaylist={isCreatingPlaylist}
              setIsCreatingPlaylist={setIsCreatingPlaylist}
              onRefreshPlaylists={fetchPlaylists}
              currentPlayingId={activeVideoId}
            />

            {/* Sync Tool Modal Overlay */}
            {activeTab === 'sync' && (
              <div className="spotify-sync-overlay" onClick={() => setActiveTab('player')}>
                <div className="spotify-sync-container-inner" onClick={(e) => e.stopPropagation()}>
                  <PlaylistSync
                    youtubeToken={youtubeToken}
                    onClose={() => setActiveTab('player')}
                    onPlaylistSynced={() => {
                      fetchPlaylists();
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 
            PERSISTENT SPOTIFY PLAYER:
            Never unmounted so music playback never interrupts during navigation
          */}
          {(activeVideoId || activePlaylistId || activeQueue.length > 0) && (
            <div className={`spotify-player-dock ${isPlayerExpanded ? 'dock-expanded' : 'dock-minimized'}`}>
              <YouTubePlayer 
                videoId={activeVideoId} 
                playlistId={activePlaylistId} 
                queue={activeQueue}
                initialIndex={playingIndex}
                isMini={!isPlayerExpanded}
                onToggleExpand={() => setIsPlayerExpanded(!isPlayerExpanded)}
                onNextTrack={handleNextTrack}
                onPrevTrack={handlePrevTrack}
              />
            </div>
          )}
        </div>
      ) : (
        /* ── SPOTIFY-THEMED LANDING PAGE ── */
        <div className="spotify-landing-page">
          <div className="landing-ambient-radial" />
          
          <div className="landing-glass-card">
            <div className="landing-emblem">
              <Music2 size={48} color="#000000" />
            </div>

            <h1 className="landing-main-title">Spotify to YouTube</h1>
            <p className="landing-subtitle">
              Enjoy your Spotify music library seamlessly streamed via YouTube with high quality, smart auto-sync, and uninterrupted playback.
            </p>

            <div className="landing-feature-pills">
              <div className="feature-pill">
                <Zap size={16} color="#1DB954" />
                <span>Smart Auto-Sync</span>
              </div>
              <div className="feature-pill">
                <Radio size={16} color="#1DB954" />
                <span>Persistent Web Player</span>
              </div>
              <div className="feature-pill">
                <ShieldCheck size={16} color="#1DB954" />
                <span>Offline Session Storage</span>
              </div>
              <div className="feature-pill">
                <Sparkles size={16} color="#1DB954" />
                <span>Spotify Dark Experience</span>
              </div>
            </div>

            <div className="landing-cta-area">
              <a href="/api/auth/youtube" className="spotify-connect-btn">
                <PlayCircle size={24} />
                <span>Connect YouTube Music</span>
              </a>
              <span className="landing-secure-notice">
                Secure Google OAuth 2.0 · Permanent session memory
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="spotify-app-loader">
        <div className="spotify-loader-circle">
          <Music2 size={36} color="#1DB954" className="animate-spin" />
        </div>
        <p>Loading Music Sync...</p>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
