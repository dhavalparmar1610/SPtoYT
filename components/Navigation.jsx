"use client";

import { useState, useEffect } from 'react';
import { 
  Home, 
  Search as SearchIcon, 
  Library, 
  Heart, 
  PlusSquare, 
  RefreshCw, 
  LogOut, 
  Download, 
  Smartphone,
  Music2
} from 'lucide-react';

export default function Navigation({ activeTab, onTabChange, onLogout, onOpenCreatePlaylist }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = typeof navigator !== 'undefined' && (
      /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      alert('To install this app on iPhone / iPad:\n\n1. Tap the Share button (square with arrow up)\n2. Scroll down and tap "Add to Home Screen"\n3. Enjoy full-screen music without address bar!');
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstallable(false);
    setDeferredPrompt(null);
  };

  return (
    <>
      {/* ── DESKTOP & TABLET SPOTIFY SIDEBAR ── */}
      <aside className="spotify-sidebar">
        <div className="sidebar-brand" onClick={() => onTabChange('player')}>
          <div className="brand-logo-circle">
            <Music2 size={24} color="#000000" />
          </div>
          <span className="brand-title">Music Sync</span>
        </div>

        <nav className="sidebar-nav-group">
          <button 
            className={`sidebar-nav-item ${activeTab === 'player' ? 'active' : ''}`}
            onClick={() => onTabChange('player')}
          >
            <Home size={22} />
            <span>Home</span>
          </button>

          <button 
            className={`sidebar-nav-item ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => onTabChange('search')}
          >
            <SearchIcon size={22} />
            <span>Search</span>
          </button>

          <button 
            className={`sidebar-nav-item ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => onTabChange('library')}
          >
            <Library size={22} />
            <span>Your Library</span>
          </button>
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-secondary-group">
          <button 
            className="sidebar-secondary-item"
            onClick={onOpenCreatePlaylist}
          >
            <div className="secondary-icon-box create-box">
              <PlusSquare size={16} />
            </div>
            <span>Create Playlist</span>
          </button>

          <button 
            className={`sidebar-secondary-item ${activeTab === 'liked' ? 'active' : ''}`}
            onClick={() => onTabChange('liked')}
          >
            <div className="secondary-icon-box liked-box">
              <Heart size={14} fill="#FFFFFF" color="#FFFFFF" />
            </div>
            <span>Liked Songs</span>
          </button>

          <button 
            className={`sidebar-secondary-item sync-item ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => onTabChange('sync')}
          >
            <div className="secondary-icon-box sync-box">
              <RefreshCw size={14} />
            </div>
            <span>Spotify Sync Tool</span>
          </button>
        </div>

        <div className="sidebar-footer">
          {(isInstallable || isIOS) && (
            <button className="sidebar-install-btn" onClick={handleInstallClick}>
              {isIOS ? <Smartphone size={18} /> : <Download size={18} />}
              <span>{isIOS ? 'Install on iPhone' : 'Install App'}</span>
            </button>
          )}

          <button className="sidebar-logout-btn" onClick={onLogout} title="Sign Out">
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP HEADER ── */}
      <header className="mobile-top-header">
        <div className="mobile-brand" onClick={() => onTabChange('player')}>
          <div className="brand-logo-circle small">
            <Music2 size={18} color="#000000" />
          </div>
          <span className="brand-title">Music Sync</span>
        </div>

        <div className="mobile-top-actions">
          {(isInstallable || isIOS) && (
            <button className="mobile-icon-btn" onClick={handleInstallClick} title="Install App">
              {isIOS ? <Smartphone size={18} /> : <Download size={18} />}
            </button>
          )}
          <button className="mobile-icon-btn" onClick={onLogout} title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      <nav className="mobile-bottom-tabs">
        <button 
          className={`tab-bar-item ${activeTab === 'player' ? 'active' : ''}`}
          onClick={() => onTabChange('player')}
        >
          <Home size={22} />
          <span>Home</span>
        </button>

        <button 
          className={`tab-bar-item ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => onTabChange('search')}
        >
          <SearchIcon size={22} />
          <span>Search</span>
        </button>

        <button 
          className={`tab-bar-item ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => onTabChange('library')}
        >
          <Library size={22} />
          <span>Library</span>
        </button>

        <button 
          className={`tab-bar-item ${activeTab === 'liked' ? 'active' : ''}`}
          onClick={() => onTabChange('liked')}
        >
          <Heart size={22} fill={activeTab === 'liked' ? '#1DB954' : 'none'} />
          <span>Liked</span>
        </button>

        <button 
          className={`tab-bar-item ${activeTab === 'sync' ? 'active' : ''}`}
          onClick={() => onTabChange('sync')}
        >
          <RefreshCw size={22} />
          <span>Sync</span>
        </button>
      </nav>
    </>
  );
}
