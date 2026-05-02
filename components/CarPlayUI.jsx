"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ListMusic, Play, ArrowLeft, Loader2, Pin, Calendar, PlusCircle, Plus, X } from 'lucide-react';
import YouTubePlayer from '@/components/YouTubePlayer';

export default function CarPlayUI({ youtubeToken, existingPlaylists, isMini }) {
  const [localPlaylists, setLocalPlaylists] = useState(existingPlaylists);
  const [pinnedPlaylists, setPinnedPlaylists] = useState([]);
  const [view, setView] = useState('playlists'); // 'playlists', 'tracks', 'search'
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [addingVideoId, setAddingVideoId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    setLocalPlaylists(existingPlaylists);
  }, [existingPlaylists]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pinned_playlists');
      if (saved) setPinnedPlaylists(JSON.parse(saved));
      
      const lastPlaylist = localStorage.getItem('last_playlist_id');
      if (lastPlaylist) {
        setSelectedPlaylistId(lastPlaylist);
        setView('tracks');
        setActivePlaylistId(lastPlaylist);
      }
    } catch (e) {}
  }, []);

  const togglePin = (e, id) => {
    e.stopPropagation();
    let updated;
    if (pinnedPlaylists.includes(id)) {
      updated = pinnedPlaylists.filter(p => p !== id);
    } else {
      updated = [...pinnedPlaylists, id];
    }
    setPinnedPlaylists(updated);
    localStorage.setItem('pinned_playlists', JSON.stringify(updated));
  };

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    try {
      const res = await axios.post('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
        snippet: { title: newPlaylistName },
        status: { privacyStatus: 'private' }
      }, { headers: { Authorization: `Bearer ${youtubeToken}` }});
      setLocalPlaylists([res.data, ...localPlaylists]);
      setIsCreatingPlaylist(false);
      setNewPlaylistName('');
    } catch(err) {
      console.error(err);
    }
  };

  const handleAddToPlaylist = async (playlistId, videoId) => {
    setIsAdding(true);
    try {
      await axios.post('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
        snippet: {
          playlistId: playlistId,
          resourceId: { kind: 'youtube#video', videoId: videoId }
        }
      }, { headers: { Authorization: `Bearer ${youtubeToken}` }});
      setAddingVideoId(null);
    } catch(err) {
      console.error(err);
      alert('Failed to add song. It might already exist or API quota exceeded.');
    } finally {
      setIsAdding(false);
    }
  };

  const sortedPlaylists = [...localPlaylists].sort((a, b) => {
    const aPinned = pinnedPlaylists.includes(a.id);
    const bPinned = pinnedPlaylists.includes(b.id);
    if (aPinned === bPinned) return 0;
    return aPinned ? -1 : 1;
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [activeVideoId, setActiveVideoId] = useState(null);
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [ytPlayer, setYtPlayer] = useState(null);

  // Fetch playlist tracks when a playlist is selected
  useEffect(() => {
    let isMounted = true;
    if (view === 'tracks' && selectedPlaylistId) {
      setIsLoadingTracks(true);
      setTracks([]); // Clear old tracks immediately
      
      const fetchTracks = async () => {
        try {
          const allItems = [];
          let nextPageToken = null;
          do {
            const res = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
              headers: { Authorization: `Bearer ${youtubeToken}` },
              params: {
                part: 'snippet',
                playlistId: selectedPlaylistId,
                maxResults: 50,
                pageToken: nextPageToken || undefined,
              },
            });
            allItems.push(...res.data.items);
            nextPageToken = res.data.nextPageToken;
          } while (nextPageToken && isMounted);
          
          if (isMounted) {
            setTracks(allItems);
          }
        } catch (e) {
          if (isMounted) console.error('Failed to fetch tracks', e);
        } finally {
          if (isMounted) setIsLoadingTracks(false);
        }
      };
      fetchTracks();
    }
    
    return () => {
      isMounted = false;
    };
  }, [view, selectedPlaylistId, youtubeToken]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        headers: { Authorization: `Bearer ${youtubeToken}` },
        params: {
          part: 'snippet',
          q: searchQuery,
          type: 'video',
          videoCategoryId: '10', // Music
          maxResults: 20
        }
      });
      setSearchResults(res.data.items);
      setView('search');
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      setIsSearching(false);
    }
  };

  const playTrackFromPlaylist = (index) => {
    setActivePlaylistId(selectedPlaylistId);
    setActiveVideoId(null);
    setPlayingIndex(index);
    if (ytPlayer && typeof ytPlayer.loadPlaylist === 'function') {
      ytPlayer.loadPlaylist({
        list: selectedPlaylistId,
        listType: 'playlist',
        index: index
      });
    }
  };

  const playSingleVideo = (videoId) => {
    setActivePlaylistId(null);
    setActiveVideoId(videoId);
    setPlayingIndex(-1);
    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
      ytPlayer.loadVideoById(videoId);
    }
  };

  return (
    <div className="carplay-container" style={isMini ? { flexDirection: 'column', height: '100px', minHeight: '100px', position: 'absolute', bottom: 0, left: 0, width: '100%', zIndex: 20 } : {}}>
      {/* LEFT PANEL */}
      {!isMini && (
        <div className="carplay-sidebar">
          {/* Header / Search */}
          <div className="carplay-header">
          <form onSubmit={handleSearch} className="carplay-search-form">
            <Search size={18} color="#aaa" />
            <input 
              type="text" 
              placeholder="Search YouTube Music..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="carplay-search-input"
            />
          </form>
        </div>

        {/* Content Area */}
        <div className="carplay-list-container">
          {view === 'playlists' && (
            <div className="carplay-list">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                <h3 className="carplay-section-title" style={{marginBottom: 0}}>Your Playlists</h3>
                <button onClick={() => setIsCreatingPlaylist(!isCreatingPlaylist)} style={{background: 'none', border: 'none', color: 'var(--spotify-green)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem'}}>
                  <PlusCircle size={16} /> New
                </button>
              </div>

              {isCreatingPlaylist && (
                <form onSubmit={handleCreatePlaylist} style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
                  <input 
                    type="text" 
                    placeholder="Playlist name..." 
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    style={{flex: 1, padding: '8px', borderRadius: '4px', border: 'none', background: '#222', color: 'white', outline: 'none'}}
                  />
                  <button type="submit" style={{background: 'var(--spotify-green)', border: 'none', color: 'black', fontWeight: 'bold', padding: '0 12px', borderRadius: '4px', cursor: 'pointer'}}>Add</button>
                </form>
              )}

              {sortedPlaylists.length === 0 && (
                <p style={{color: '#aaa', fontSize: '0.9rem'}}>No playlists found. Try syncing one below!</p>
              )}
              {sortedPlaylists.map(p => {
                const isPinned = pinnedPlaylists.includes(p.id);
                const publishedDate = new Date(p.snippet.publishedAt).toLocaleDateString();
                return (
                  <div key={p.id} className="carplay-list-item-wrapper" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <button 
                      className="carplay-list-item"
                      onClick={() => {
                        setSelectedPlaylistId(p.id);
                        localStorage.setItem('last_playlist_id', p.id);
                        setView('tracks');
                        setActivePlaylistId(p.id);
                        setActiveVideoId(null);
                        setPlayingIndex(0);
                      }}
                      style={{flex: 1}}
                    >
                      {p.snippet.thumbnails?.default?.url ? (
                        <img src={p.snippet.thumbnails.default.url} style={{width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover'}} alt="" />
                      ) : (
                        <ListMusic size={20} color={isPinned ? 'var(--spotify-green)' : '#aaa'} />
                      )}
                      <div style={{display: 'flex', flexDirection: 'column', textAlign: 'left', flex: 1, overflow: 'hidden'}}>
                        <span className="carplay-item-title">{p.snippet.title}</span>
                        <span style={{fontSize: '0.75rem', color: '#888', display: 'flex', alignItems: 'center', gap: '4px'}}>
                          <Calendar size={10} /> {publishedDate}
                        </span>
                      </div>
                    </button>
                    <button onClick={(e) => togglePin(e, p.id)} style={{background: 'none', border: 'none', color: isPinned ? 'var(--spotify-green)' : '#444', cursor: 'pointer', padding: '8px'}}>
                      <Pin size={18} fill={isPinned ? 'var(--spotify-green)' : 'none'} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {view === 'tracks' && (
            <div className="carplay-list">
              <button className="carplay-back-btn" onClick={() => setView('playlists')}>
                <ArrowLeft size={16} /> Back to Playlists
              </button>
              
              {isLoadingTracks ? (
                <div className="carplay-loading"><Loader2 className="animate-spin" /></div>
              ) : (
                tracks.map((t, i) => {
                  // Only show playable videos
                  if (t.snippet.title === 'Private video' || t.snippet.title === 'Deleted video') return null;
                  
                  const isActive = activePlaylistId === selectedPlaylistId && playingIndex === i;
                  return (
                    <button 
                      key={t.id} 
                      className={`carplay-track-item ${isActive ? 'active' : ''}`}
                      onClick={() => playTrackFromPlaylist(i)}
                    >
                      <img src={t.snippet.thumbnails?.default?.url || '/fallback.jpg'} className="carplay-track-thumb" alt="" />
                      <div className="carplay-track-info">
                        <div className="carplay-track-title">{t.snippet.title}</div>
                        <div className="carplay-track-author">{t.snippet.videoOwnerChannelTitle}</div>
                      </div>
                      {isActive && <Play size={16} color="var(--spotify-green)" />}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {view === 'search' && (
            <div className="carplay-list">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                <h3 className="carplay-section-title">Search Results</h3>
                <button className="carplay-back-btn" onClick={() => setView('playlists')} style={{marginBottom: 0}}>
                  Clear
                </button>
              </div>
              
              {isSearching ? (
                <div className="carplay-loading"><Loader2 className="animate-spin" /></div>
              ) : (
                searchResults.map((r) => {
                  const isActive = activeVideoId === r.id.videoId;
                  return (
                    <div key={r.id.videoId} style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px'}}>
                      <button 
                        className={`carplay-track-item ${isActive ? 'active' : ''}`}
                        onClick={() => playSingleVideo(r.id.videoId)}
                        style={{flex: 1, marginBottom: 0}}
                      >
                        <img src={r.snippet.thumbnails?.default?.url} className="carplay-track-thumb" alt="" />
                        <div className="carplay-track-info">
                          <div className="carplay-track-title">{r.snippet.title}</div>
                          <div className="carplay-track-author">{r.snippet.channelTitle}</div>
                        </div>
                        {isActive && <Play size={16} color="var(--spotify-green)" />}
                      </button>
                      <button 
                        onClick={() => setAddingVideoId(r.id.videoId)}
                        style={{background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', color: 'white', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}}
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {addingVideoId && (
        <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{background: '#1a1a2e', padding: '24px', borderRadius: '12px', width: '80%', maxWidth: '400px', border: '1px solid #333', display: 'flex', flexDirection: 'column', maxHeight: '80%'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
              <h3 style={{margin: 0}}>Add to Playlist</h3>
              <button onClick={() => setAddingVideoId(null)} style={{background: 'none', border: 'none', color: '#aaa', cursor: 'pointer'}}><X size={20} /></button>
            </div>
            <div style={{overflowY: 'auto', flex: 1}}>
              {localPlaylists.map(p => (
                <button 
                  key={p.id}
                  onClick={() => handleAddToPlaylist(p.id, addingVideoId)}
                  disabled={isAdding}
                  style={{width: '100%', textAlign: 'left', padding: '12px', background: 'transparent', border: 'none', borderBottom: '1px solid #333', color: 'white', cursor: 'pointer'}}
                >
                  {p.snippet.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RIGHT PANEL - PLAYER */}
      <div className="carplay-player-panel" style={isMini ? { padding: 0 } : {}}>
        <YouTubePlayer 
          videoId={activeVideoId} 
          playlistId={activePlaylistId} 
          onPlayerReady={setYtPlayer}
          isMini={isMini} 
        />
      </div>
    </div>
  );
}
