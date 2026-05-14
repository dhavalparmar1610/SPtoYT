import { useState, useEffect } from 'react';
import { Home, RefreshCw, LogOut, Search as SearchIcon, Download, Smartphone, Heart, Library, PlusSquare } from 'lucide-react';

export default function Navigation({ activeTab, onTabChange, onLogout, onSearch, searchQuery }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS — covers Safari, Chrome, Brave, Firefox on iOS (all use WebKit)
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad with desktop UA
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
      // On iOS, only Safari supports Add to Home Screen
      const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|brave/i.test(navigator.userAgent);
      if (isSafari) {
        alert('Tap the Share button (box with arrow) at the bottom, then tap "Add to Home Screen".');
      } else {
        alert('To install this app on iOS:\n\n1. Open this page in Safari\n2. Tap the Share button (box with arrow)\n3. Tap "Add to Home Screen"\n\nNote: Only Safari supports installing web apps on iOS.');
      }
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstallable(false);
    setDeferredPrompt(null);
  };

  return (
    <nav className="main-nav">
      <div className="nav-logo" onClick={() => onTabChange('player')} style={{cursor: 'pointer'}}>
        <img src="/logo.png" className="logo-icon-img" alt="Logo" />
        {/* <span className="logo-text">Music Sync</span> */}
      </div>

      <div className="header-search-container">
        <SearchIcon size={18} className="search-icon" />
        <input 
          type="text" 
          placeholder="Search songs, albums, artists..." 
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          className="header-search-input"
        />
      </div>
      
      <div className="nav-links">
        <button className={`nav-item ${activeTab === 'player' ? 'active' : ''}`} onClick={() => onTabChange('player')}>
          <Home size={20} /> <span>Home</span>
        </button>
        <button className={`nav-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => onTabChange('library')}>
          <Library size={20} /> <span>Playlists</span>
        </button>
        <button className={`nav-item ${activeTab === 'liked' ? 'active' : ''}`} onClick={() => onTabChange('liked')}>
          <Heart size={20} /> <span>Liked</span>
        </button>
        <button className={`nav-item create-nav-btn`} onClick={() => onTabChange('create')}>
          <PlusSquare size={20} /> <span>Create</span>
        </button>
        <button className={`nav-item ${activeTab === 'sync' ? 'active' : ''}`} onClick={() => onTabChange('sync')}>
          <RefreshCw size={20} /> <span>Sync Tool</span>
        </button>
      </div>

      <div className="nav-actions">
        {(isInstallable || isIOS) && (
          <button className="install-btn" onClick={handleInstallClick}>
            {isIOS ? <Smartphone size={18} /> : <Download size={18} />}
            <span>{isIOS ? 'App Info' : 'Install'}</span>
          </button>
        )}
        <button className="logout-btn" onClick={onLogout}>
          <LogOut size={18} /> <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}
