"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Play, Loader2, Plus, X, Home, Heart, Library, PlusSquare, ArrowLeft } from 'lucide-react';

export default function CarPlayUI({ 
  youtubeToken, 
  existingPlaylists, 
  searchQuery, 
  onSearch, 
  onPlayVideo, 
  onPlayPlaylist, 
  activeTab, 
  onTabChange 
}) {
  const [view, setView] = useState('discover');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingVideoId, setAddingVideoId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  
  // Discover Sections
  const [trendingIndia, setTrendingIndia] = useState([]);
  const [trendingGlobal, setTrendingGlobal] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [likedVideos, setLikedVideos] = useState([]);

  // Sync state with header
  useEffect(() => {
    if (activeTab === 'library') setView('library');
    else if (activeTab === 'liked') setView('liked');
    else if (activeTab === 'create') setIsCreatingPlaylist(true);
    else if (activeTab === 'player') setView('discover');
  }, [activeTab]);

  // Handle Search
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const timer = setTimeout(async () => {
        setIsSearching(true);
        try {
          const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            headers: { Authorization: `Bearer ${youtubeToken}` },
            params: { part: 'snippet', q: searchQuery, type: 'video', videoCategoryId: '10', maxResults: 20 }
          });
          setSearchResults(res.data.items);
          setView('search');
        } catch (e) {}
        setIsSearching(false);
      }, 600);
      return () => clearTimeout(timer);
    } else if (view === 'search') {
      setView('discover');
    }
  }, [searchQuery, youtubeToken]);

  // Fetch Home Content
  useEffect(() => {
    const fetchHome = async () => {
      try {
        // Trending India
        const inRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
          headers: { Authorization: `Bearer ${youtubeToken}` },
          params: { part: 'snippet', chart: 'mostPopular', videoCategoryId: '10', maxResults: 20, regionCode: 'IN' }
        });
        setTrendingIndia(inRes.data.items);

        // Global Trending
        const globalRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
          headers: { Authorization: `Bearer ${youtubeToken}` },
          params: { part: 'snippet', chart: 'mostPopular', videoCategoryId: '10', maxResults: 15, regionCode: 'US' }
        });
        setTrendingGlobal(globalRes.data.items);

        // Liked
        const likedRes = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
          headers: { Authorization: `Bearer ${youtubeToken}` },
          params: { part: 'snippet', playlistId: 'LL', maxResults: 50 }
        });
        setLikedVideos(likedRes.data.items);

        // Recent
        const recentIds = JSON.parse(localStorage.getItem('recently_played_videos') || '[]');
        if (recentIds.length > 0) {
          const recRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            headers: { Authorization: `Bearer ${youtubeToken}` },
            params: { part: 'snippet', id: recentIds.join(',') }
          });
          setRecentlyPlayed(recRes.data.items);
        }
      } catch (e) {}
    };
    if (youtubeToken) fetchHome();
  }, [youtubeToken]);

  const extractVideoId = (item) => {
    if (typeof item === 'string') return item;
    return item.snippet?.resourceId?.videoId || item.id?.videoId || item.id;
  };

  const handlePlay = (videoId, items = [], index = 0) => {
    const queue = items.map(item => extractVideoId(item)).filter(id => id && typeof id === 'string');
    onPlayVideo(videoId, queue, index);
    
    let recent = JSON.parse(localStorage.getItem('recently_played_videos') || '[]');
    recent = [videoId, ...recent.filter(id => id !== videoId)].slice(0, 15);
    localStorage.setItem('recently_played_videos', JSON.stringify(recent));
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await axios.post('https://www.googleapis.com/youtube/v3/playlists?part=snippet', {
        snippet: { title: newPlaylistName }
      }, { headers: { Authorization: `Bearer ${youtubeToken}` } });
      setNewPlaylistName('');
      setIsCreatingPlaylist(false);
      onTabChange('library');
    } catch (e) {}
  };

  // Fetch tracks for selected playlist
  useEffect(() => {
    if (view === 'tracks' && selectedPlaylistId) {
      const fetchTracks = async () => {
        setIsLoadingTracks(true);
        try {
          const res = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
            headers: { Authorization: `Bearer ${youtubeToken}` },
            params: { part: 'snippet', playlistId: selectedPlaylistId, maxResults: 50 }
          });
          setTracks(res.data.items);
        } catch (e) {}
        setIsLoadingTracks(false);
      };
      fetchTracks();
    }
  }, [selectedPlaylistId, view, youtubeToken]);

  const renderGrid = (items, isPlaylist = false) => (
    <div className="track-grid">
      {items.map((item, idx) => {
        const id = isPlaylist ? item.id : extractVideoId(item);
        const title = item.snippet?.title || 'Unknown Title';
        const author = item.snippet?.channelTitle || item.snippet?.videoOwnerChannelTitle || 'Unknown Artist';
        const thumb = item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url;
        if (title === 'Private video') return null;

        return (
          <div key={id + idx} className="modern-track-card" onClick={() => isPlaylist ? (setSelectedPlaylistId(id), setView('tracks')) : handlePlay(id, items, idx)}>
            <div className="card-thumb-wrapper">
              {thumb ? (
                <img src={thumb} alt="" className="card-thumb" />
              ) : (
                <div className="card-thumb-placeholder"><Home size={32} /></div>
              )}
              <div className="card-overlay"><Play size={32} fill="white" color="white" /></div>
            </div>
            <div className="card-info">
              <div className="card-title" title={title}>{title}</div>
              <div className="card-author">{author}</div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="streaming-content-layout">
      <div className="main-view-area">
        <div className="view-scroll" style={{padding: '32px'}}>
          {view === 'discover' && (
            <>
              <div className="discover-hero">
                <h1>Swagat Hai!</h1>
                <p>Trending music from India and across the globe.</p>
              </div>

              {recentlyPlayed.length > 0 && <div className="section-group"><h3>Recently Played</h3>{renderGrid(recentlyPlayed)}</div>}
              <div className="section-group"><h3>Trending in India</h3>{renderGrid(trendingIndia)}</div>
              <div className="section-group"><h3>Global Charts</h3>{renderGrid(trendingGlobal)}</div>
            </>
          )}

          {view === 'library' && <div className="section-group"><h3>Your Playlists</h3>{renderGrid(existingPlaylists, true)}</div>}
          
          {view === 'tracks' && (
            <div className="section-group">
              <button onClick={() => setView('library')} className="back-btn" style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'20px', background:'none', border:'none', color:'white', cursor:'pointer', fontWeight:'bold'}}>
                <ArrowLeft size={20} /> Back to Library
              </button>
              {isLoadingTracks ? <Loader2 className="animate-spin" /> : renderGrid(tracks)}
            </div>
          )}

          {view === 'liked' && <div className="section-group"><h3>Liked Videos</h3>{renderGrid(likedVideos)}</div>}
          {view === 'search' && <div className="section-group"><h3>Search Results</h3>{isSearching ? <Loader2 className="animate-spin" /> : renderGrid(searchResults)}</div>}
        </div>
      </div>

      {/* CREATE MODAL */}
      {isCreatingPlaylist && (
        <div className="modal-overlay" onClick={() => (setIsCreatingPlaylist(false), onTabChange('player'))}>
          <div className="playlist-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Create New Playlist</h3><button onClick={() => (setIsCreatingPlaylist(false), onTabChange('player'))}><X size={24} /></button></div>
            <input type="text" className="premium-input" placeholder="Playlist Name..." value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} autoFocus />
            <button className="sync-btn" style={{marginTop: '20px'}} onClick={handleCreatePlaylist}>Create Playlist</button>
          </div>
        </div>
      )}

      {/* ADD MODAL */}
      {addingVideoId && (
        <div className="modal-overlay" onClick={() => setAddingVideoId(null)}>
          <div className="playlist-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Add to Playlist</h3><button onClick={() => setAddingVideoId(null)}><X size={24} /></button></div>
            <div className="modal-list">
              {existingPlaylists.map(p => (
                <button 
                  key={p.id} 
                  className="modal-item-btn"
                  onClick={async () => {
                    try {
                      await axios.post('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', { 
                        snippet: { 
                          playlistId: p.id, 
                          resourceId: { kind: 'youtube#video', videoId: addingVideoId } 
                        } 
                      }, { headers: { Authorization: `Bearer ${youtubeToken}` } });
                      setAddingVideoId(null);
                      alert('Added to ' + p.snippet.title);
                    } catch (e) { alert('Failed to add.'); }
                  }}
                >
                  {p.snippet.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
