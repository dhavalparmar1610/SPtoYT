"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ListMusic, Play, ArrowLeft, Loader2 } from 'lucide-react';
import YouTubePlayer from '@/components/YouTubePlayer';

export default function CarPlayUI({ youtubeToken, existingPlaylists }) {
  const [view, setView] = useState('playlists'); // 'playlists', 'tracks', 'search'
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [activeVideoId, setActiveVideoId] = useState(null);
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [ytPlayer, setYtPlayer] = useState(null);

  // Fetch playlist tracks when a playlist is selected
  useEffect(() => {
    if (view === 'tracks' && selectedPlaylistId) {
      setIsLoadingTracks(true);
      
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
          } while (nextPageToken);
          setTracks(allItems);
        } catch (e) {
          console.error('Failed to fetch tracks', e);
        } finally {
          setIsLoadingTracks(false);
        }
      };
      fetchTracks();
    }
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
    if (ytPlayer && typeof ytPlayer.playVideoAt === 'function') {
      ytPlayer.playVideoAt(index);
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
    <div className="carplay-container">
      {/* LEFT PANEL */}
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
              <h3 className="carplay-section-title">Your Playlists</h3>
              {existingPlaylists.length === 0 && (
                <p style={{color: '#aaa', fontSize: '0.9rem'}}>No playlists found. Try syncing one below!</p>
              )}
              {existingPlaylists.map(p => (
                <button 
                  key={p.id} 
                  className="carplay-list-item"
                  onClick={() => {
                    setSelectedPlaylistId(p.id);
                    setView('tracks');
                    setActivePlaylistId(p.id);
                    setActiveVideoId(null);
                    setPlayingIndex(0);
                  }}
                >
                  <ListMusic size={20} color="var(--spotify-green)" />
                  <span className="carplay-item-title">{p.snippet.title}</span>
                </button>
              ))}
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
                    <button 
                      key={r.id.videoId} 
                      className={`carplay-track-item ${isActive ? 'active' : ''}`}
                      onClick={() => playSingleVideo(r.id.videoId)}
                    >
                      <img src={r.snippet.thumbnails?.default?.url} className="carplay-track-thumb" alt="" />
                      <div className="carplay-track-info">
                        <div className="carplay-track-title">{r.snippet.title}</div>
                        <div className="carplay-track-author">{r.snippet.channelTitle}</div>
                      </div>
                      {isActive && <Play size={16} color="var(--spotify-green)" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL - PLAYER */}
      <div className="carplay-player-panel">
        <YouTubePlayer 
          videoId={activeVideoId} 
          playlistId={activePlaylistId} 
          onPlayerReady={setYtPlayer} 
        />
      </div>
    </div>
  );
}
