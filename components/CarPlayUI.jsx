"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Loader2, 
  Plus, 
  X, 
  Heart, 
  Clock, 
  ArrowLeft, 
  Shuffle, 
  Music, 
  Search as SearchIcon,
  Check,
  ListPlus
} from 'lucide-react';
import { youtubeGet, youtubePost } from '@/lib/api';
import { cleanYouTubeTitle, formatDuration, parseIsoDuration } from '@/lib/formatters';

const BROWSE_CATEGORIES = [
  { id: 'bollywood', name: 'Bollywood Hits', query: 'Bollywood hits hindi songs', color: 'linear-gradient(135deg, #E8115B, #FF6437)' },
  { id: 'punjabi', name: 'Punjabi Hits', query: 'punjabi songs latest', color: 'linear-gradient(135deg, #8D67AB, #E8115B)' },
  { id: 'global50', name: 'Global Top 50', query: 'top 50 global billboard songs', color: 'linear-gradient(135deg, #477D95, #8D67AB)' },
  { id: 'pop', name: 'Pop Central', query: 'pop central top hits songs', color: 'linear-gradient(135deg, #148A08, #24D04C)' },
  { id: 'hiphop', name: 'Hip-Hop / Rap', query: 'hip hop rap music playlist', color: 'linear-gradient(135deg, #BC5900, #E91429)' },
  { id: 'chill', name: 'Chill & Relax', query: 'chill vibes relaxing music acoustic', color: 'linear-gradient(135deg, #503750, #8C1932)' },
  { id: 'workout', name: 'Workout Energy', query: 'workout gym motivation music', color: 'linear-gradient(135deg, #777777, #2E77D0)' },
  { id: 'rock', name: 'Rock Classics', query: 'rock classics songs', color: 'linear-gradient(135deg, #E91429, #B02897)' },
  { id: 'indie', name: 'Indie & Acoustic', query: 'indie folk acoustic songs', color: 'linear-gradient(135deg, #0D73EC, #1DB954)' },
  { id: 'party', name: 'Party Night', query: 'party dance club hits remix', color: 'linear-gradient(135deg, #537AA1, #B49BC7)' },
  { id: 'lofi', name: 'Lofi Beats', query: 'lofi chill beats for study', color: 'linear-gradient(135deg, #4361EE, #3A0CA3)' },
  { id: 'romantic', name: 'Romantic Songs', query: 'romantic love songs', color: 'linear-gradient(135deg, #D81159, #8F2D56)' }
];

export default function CarPlayUI({ 
  youtubeToken, 
  existingPlaylists = [], 
  onPlayVideo, 
  onPlayPlaylist, 
  activeTab, 
  onTabChange,
  isCreatingPlaylist,
  setIsCreatingPlaylist,
  onRefreshPlaylists,
  currentPlayingId,
  isPlaying
}) {
  const [view, setView] = useState('discover'); // 'discover' | 'search' | 'library' | 'tracks' | 'liked'
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  
  // Search state
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all'); // 'all' | 'songs' | 'playlists'
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  // Modals & Playlists
  const [addingVideoId, setAddingVideoId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingSubmitting, setIsCreatingSubmitting] = useState(false);
  const [addedSuccessId, setAddedSuccessId] = useState(null);

  // Home content
  const [trendingIndia, setTrendingIndia] = useState([]);
  const [trendingGlobal, setTrendingGlobal] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [likedVideos, setLikedVideos] = useState([]);
  const [isLoadingHome, setIsLoadingHome] = useState(false);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('recent_search_queries') || '[]');
      if (Array.isArray(saved)) setRecentSearches(saved);
    } catch {}
  }, []);

  // Sync tab changes from parent navigation
  useEffect(() => {
    if (activeTab === 'library') setView('library');
    else if (activeTab === 'liked') setView('liked');
    else if (activeTab === 'search') setView('search');
    else if (activeTab === 'player') setView('discover');
  }, [activeTab]);

  // Handle browser back button (popstate) so music NEVER stops
  useEffect(() => {
    const handlePopState = (e) => {
      if (view === 'tracks') {
        setView('library');
        setSelectedPlaylist(null);
      } else if (view === 'search' && activeTab !== 'search') {
        setView('discover');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, activeTab]);

  // Fetch Home content
  useEffect(() => {
    if (!youtubeToken) return;

    const fetchHomeContent = async () => {
      setIsLoadingHome(true);
      try {
        // Trending India
        const inRes = await youtubeGet('https://www.googleapis.com/youtube/v3/videos', {
          part: 'snippet,contentDetails',
          chart: 'mostPopular',
          videoCategoryId: '10',
          maxResults: 15,
          regionCode: 'IN'
        });
        setTrendingIndia(inRes.data.items || []);

        // Global Trending
        const globalRes = await youtubeGet('https://www.googleapis.com/youtube/v3/videos', {
          part: 'snippet,contentDetails',
          chart: 'mostPopular',
          videoCategoryId: '10',
          maxResults: 15,
          regionCode: 'US'
        });
        setTrendingGlobal(globalRes.data.items || []);

        // Liked
        const likedRes = await youtubeGet('https://www.googleapis.com/youtube/v3/playlistItems', {
          part: 'snippet,contentDetails',
          playlistId: 'LL',
          maxResults: 50
        });
        setLikedVideos(likedRes.data.items || []);

        // Recently Played IDs
        const recentIds = JSON.parse(localStorage.getItem('recently_played_videos') || '[]');
        if (recentIds.length > 0) {
          const recRes = await youtubeGet('https://www.googleapis.com/youtube/v3/videos', {
            part: 'snippet,contentDetails',
            id: recentIds.slice(0, 10).join(',')
          });
          setRecentlyPlayed(recRes.data.items || []);
        }
      } catch (e) {
        console.warn('Error loading home content:', e);
      } finally {
        setIsLoadingHome(false);
      }
    };

    fetchHomeContent();
  }, [youtubeToken]);

  // Fetch playlist tracks
  const loadPlaylistTracks = useCallback(async (playlist) => {
    if (!playlist?.id || !youtubeToken) return;
    setIsLoadingTracks(true);
    setSelectedPlaylist(playlist);
    setView('tracks');

    // Push history state so back button returns to library without page reload
    window.history.pushState({ view: 'tracks', playlistId: playlist.id }, '');

    try {
      const res = await youtubeGet('https://www.googleapis.com/youtube/v3/playlistItems', {
        part: 'snippet,contentDetails',
        playlistId: playlist.id,
        maxResults: 50
      });
      setTracks(res.data.items || []);
    } catch (e) {
      console.error('Error fetching playlist tracks:', e);
    } finally {
      setIsLoadingTracks(false);
    }
  }, [youtubeToken]);

  // Debounced search logic
  const performSearch = useCallback(async (query, filterType = searchFilter) => {
    if (!query || query.trim().length < 2 || !youtubeToken) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const params = {
        part: 'snippet',
        q: query.trim(),
        maxResults: 25
      };

      if (filterType === 'songs') {
        params.type = 'video';
        params.videoCategoryId = '10';
      } else if (filterType === 'playlists') {
        params.type = 'playlist';
      } else {
        params.type = 'video,playlist';
      }

      const res = await youtubeGet('https://www.googleapis.com/youtube/v3/search', params);
      setSearchResults(res.data.items || []);

      // Save to recent searches
      let updated = [query.trim(), ...recentSearches.filter(q => q.toLowerCase() !== query.trim().toLowerCase())].slice(0, 8);
      setRecentSearches(updated);
      localStorage.setItem('recent_search_queries', JSON.stringify(updated));
    } catch (e) {
      console.warn('Search failed:', e);
    } finally {
      setIsSearching(false);
    }
  }, [youtubeToken, searchFilter, recentSearches]);

  // Search input typing debounce
  const searchTimeoutRef = useRef(null);
  const handleSearchChange = (val) => {
    setLocalSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (val.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(val);
      }, 400);
    } else {
      setSearchResults([]);
    }
  };

  const handleCategoryClick = (category) => {
    setLocalSearchQuery(category.name);
    performSearch(category.query);
  };

  const handleRemoveRecentSearch = (queryToRemove, e) => {
    e.stopPropagation();
    const updated = recentSearches.filter(q => q !== queryToRemove);
    setRecentSearches(updated);
    localStorage.setItem('recent_search_queries', JSON.stringify(updated));
  };

  const extractVideoId = (item) => {
    if (!item) return null;
    if (typeof item === 'string') return item;
    return item.snippet?.resourceId?.videoId || item.id?.videoId || item.contentDetails?.videoId || (typeof item.id === 'string' ? item.id : null);
  };

  const handlePlaySong = (videoId, itemsList = [], index = 0) => {
    if (!videoId) return;
    const queue = itemsList.map(item => extractVideoId(item)).filter(Boolean);
    onPlayVideo(videoId, queue, index);

    // Save recently played
    try {
      let recent = JSON.parse(localStorage.getItem('recently_played_videos') || '[]');
      recent = [videoId, ...recent.filter(id => id !== videoId)].slice(0, 20);
      localStorage.setItem('recently_played_videos', JSON.stringify(recent));
    } catch {}
  };

  const handlePlayEntirePlaylist = (playlistId) => {
    if (!playlistId) return;
    onPlayPlaylist(playlistId, 0);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || isCreatingSubmitting) return;
    setIsCreatingSubmitting(true);
    try {
      await youtubePost('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
        snippet: { title: newPlaylistName.trim(), description: 'Created with Music Sync' },
        status: { privacyStatus: 'private' }
      });
      setNewPlaylistName('');
      setIsCreatingPlaylist(false);
      if (onRefreshPlaylists) onRefreshPlaylists();
      setView('library');
    } catch (e) {
      alert('Failed to create playlist. Please try again.');
    } finally {
      setIsCreatingSubmitting(false);
    }
  };

  const handleAddToPlaylist = async (playlistId, videoId) => {
    try {
      await youtubePost('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
        snippet: {
          playlistId,
          resourceId: { kind: 'youtube#video', videoId }
        }
      });
      setAddedSuccessId(playlistId);
      setTimeout(() => {
        setAddedSuccessId(null);
        setAddingVideoId(null);
      }, 1200);
    } catch (e) {
      alert('Could not add track to playlist.');
    }
  };

  // Greeting based on time of day
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Renders Spotify-style Track Cards (Square tiles with hover Play button)
  const renderCardGrid = (items, isPlaylist = false) => {
    if (!items || items.length === 0) {
      return <div className="empty-grid-msg">No tracks found.</div>;
    }

    return (
      <div className="spotify-card-grid">
        {items.map((item, idx) => {
          const id = isPlaylist ? item.id : extractVideoId(item);
          const rawTitle = item.snippet?.title || 'Unknown Title';
          const author = item.snippet?.channelTitle || item.snippet?.videoOwnerChannelTitle || 'Artist';
          const thumb = item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url;
          if (rawTitle === 'Private video' || rawTitle === 'Deleted video') return null;

          const { title: cleanTitle, artist: cleanArtist } = cleanYouTubeTitle(rawTitle, author);
          const isCurrentActive = !isPlaylist && id === currentPlayingId;

          return (
            <div 
              key={id + '-' + idx} 
              className={`spotify-card ${isCurrentActive ? 'is-active-card' : ''}`}
              onClick={() => isPlaylist ? loadPlaylistTracks(item) : handlePlaySong(id, items, idx)}
            >
              <div className="card-artwork-wrapper">
                {thumb ? (
                  <img src={thumb} alt="" className="card-artwork-img" loading="lazy" />
                ) : (
                  <div className="card-artwork-placeholder"><Music size={36} opacity={0.3} /></div>
                )}
                
                {/* Spotify Floating Green Play Button */}
                <button 
                  className={`card-play-btn ${isCurrentActive && isPlaying ? 'is-playing' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isPlaylist) {
                      handlePlayEntirePlaylist(id);
                    } else {
                      handlePlaySong(id, items, idx);
                    }
                  }}
                  title={isCurrentActive && isPlaying ? "Pause" : "Play"}
                >
                  {isCurrentActive && isPlaying ? (
                    <Pause size={20} fill="#000000" color="#000000" />
                  ) : (
                    <Play size={20} fill="#000000" color="#000000" style={{ marginLeft: '2px' }} />
                  )}
                </button>
              </div>

              <div className="card-metadata">
                <div className="card-title-text" title={rawTitle}>{cleanTitle}</div>
                <div className="card-artist-text">{isPlaylist ? 'Playlist' : cleanArtist}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Renders Spotify-style Tracklist Table
  const renderTracklistTable = (trackItems) => {
    if (!trackItems || trackItems.length === 0) {
      return <div className="empty-tracklist-msg">No tracks in this playlist yet.</div>;
    }

    return (
      <div className="spotify-tracklist">
        <div className="tracklist-header-row">
          <div className="col-index">#</div>
          <div className="col-title">TITLE</div>
          <div className="col-artist">ARTIST</div>
          <div className="col-actions"></div>
        </div>

        <div className="tracklist-body">
          {trackItems.map((item, idx) => {
            const videoId = extractVideoId(item);
            const rawTitle = item.snippet?.title || 'Unknown Title';
            const channel = item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || 'Artist';
            const thumb = item.snippet?.thumbnails?.default?.url || item.snippet?.thumbnails?.medium?.url;
            if (rawTitle === 'Private video' || rawTitle === 'Deleted video') return null;

            const { title: cleanTitle, artist: cleanArtist } = cleanYouTubeTitle(rawTitle, channel);
            const isCurrentActive = videoId === currentPlayingId;

            return (
              <div 
                key={videoId + '-' + idx} 
                className={`tracklist-row ${isCurrentActive ? 'row-active' : ''}`}
                onClick={() => handlePlaySong(videoId, trackItems, idx)}
              >
                <div className="col-index">
                  <span className="row-number">{idx + 1}</span>
                  <button className="row-play-icon" title="Play">
                    {isCurrentActive && isPlaying ? (
                      <Pause size={16} fill="currentColor" />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
                  </button>
                </div>

                <div className="col-title">
                  {thumb && <img src={thumb} alt="" className="row-thumb" />}
                  <div className="row-title-wrap">
                    <span className={`row-track-name ${isCurrentActive ? 'text-accent' : ''}`} title={rawTitle}>
                      {cleanTitle}
                    </span>
                    <span className="row-mobile-artist">{cleanArtist}</span>
                  </div>
                </div>

                <div className="col-artist">
                  <span className="row-artist-name">{cleanArtist}</span>
                </div>

                <div className="col-actions" onClick={(e) => e.stopPropagation()}>
                  <button 
                    className="row-action-btn"
                    onClick={() => setAddingVideoId(videoId)}
                    title="Add to Playlist"
                  >
                    <ListPlus size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="spotify-content-wrapper">
      <div className="spotify-main-scroll">
        
        {/* ══════════════════════════════════════════
            VIEW: DISCOVER (HOME)
            ══════════════════════════════════════════ */}
        {view === 'discover' && (
          <div className="view-discover-page">
            <header className="discover-hero-header">
              <h1 className="hero-greeting">{getGreeting()}</h1>
            </header>

            {/* Quick Access Grid (Spotify 6-tile shelf) */}
            {recentlyPlayed.length > 0 && (
              <div className="quick-access-grid">
                {recentlyPlayed.slice(0, 6).map((item, i) => {
                  const id = extractVideoId(item);
                  const thumb = item.snippet?.thumbnails?.default?.url;
                  const { title } = cleanYouTubeTitle(item.snippet?.title);
                  return (
                    <div 
                      key={id + '-quick-' + i} 
                      className="quick-card"
                      onClick={() => handlePlaySong(id, recentlyPlayed, i)}
                    >
                      {thumb && <img src={thumb} alt="" className="quick-card-img" />}
                      <span className="quick-card-title">{title}</span>
                      <button className="quick-play-btn">
                        <Play size={18} fill="#000" color="#000" style={{ marginLeft: '2px' }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recently Played Shelf */}
            {recentlyPlayed.length > 0 && (
              <section className="spotify-shelf">
                <div className="shelf-header">
                  <h2>Recently Played</h2>
                </div>
                {renderCardGrid(recentlyPlayed)}
              </section>
            )}

            {/* Trending India Shelf */}
            <section className="spotify-shelf">
              <div className="shelf-header">
                <h2>Trending in India</h2>
              </div>
              {isLoadingHome && trendingIndia.length === 0 ? (
                <div className="shelf-loading"><Loader2 className="animate-spin" size={32} /></div>
              ) : (
                renderCardGrid(trendingIndia)
              )}
            </section>

            {/* Global Charts Shelf */}
            <section className="spotify-shelf">
              <div className="shelf-header">
                <h2>Global Top Hits</h2>
              </div>
              {isLoadingHome && trendingGlobal.length === 0 ? (
                <div className="shelf-loading"><Loader2 className="animate-spin" size={32} /></div>
              ) : (
                renderCardGrid(trendingGlobal)
              )}
            </section>
          </div>
        )}

        {/* ══════════════════════════════════════════
            VIEW: SEARCH
            ══════════════════════════════════════════ */}
        {view === 'search' && (
          <div className="view-search-page">
            <div className="search-top-bar">
              <div className="search-input-field-wrap">
                <SearchIcon size={20} className="search-input-icon" />
                <input 
                  type="text" 
                  className="spotify-search-input"
                  placeholder="What do you want to play?"
                  value={localSearchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  autoFocus
                />
                {localSearchQuery && (
                  <button 
                    className="search-clear-btn"
                    onClick={() => {
                      setLocalSearchQuery('');
                      setSearchResults([]);
                    }}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="search-filter-pills">
                <button 
                  className={`pill-btn ${searchFilter === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    setSearchFilter('all');
                    if (localSearchQuery) performSearch(localSearchQuery, 'all');
                  }}
                >
                  All
                </button>
                <button 
                  className={`pill-btn ${searchFilter === 'songs' ? 'active' : ''}`}
                  onClick={() => {
                    setSearchFilter('songs');
                    if (localSearchQuery) performSearch(localSearchQuery, 'songs');
                  }}
                >
                  Songs
                </button>
                <button 
                  className={`pill-btn ${searchFilter === 'playlists' ? 'active' : ''}`}
                  onClick={() => {
                    setSearchFilter('playlists');
                    if (localSearchQuery) performSearch(localSearchQuery, 'playlists');
                  }}
                >
                  Playlists
                </button>
              </div>
            </div>

            {/* Recent Searches Tags */}
            {!localSearchQuery && recentSearches.length > 0 && (
              <div className="recent-searches-box">
                <h3 className="section-subheading">Recent Searches</h3>
                <div className="recent-tags-row">
                  {recentSearches.map((q, i) => (
                    <div 
                      key={i} 
                      className="recent-tag-chip"
                      onClick={() => {
                        setLocalSearchQuery(q);
                        performSearch(q);
                      }}
                    >
                      <span>{q}</span>
                      <button 
                        className="chip-remove-btn"
                        onClick={(e) => handleRemoveRecentSearch(q, e)}
                        title="Remove"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* When not searching: Spotify Browse All Categories */}
            {!localSearchQuery && (
              <div className="browse-categories-section">
                <h2 className="browse-heading">Browse All</h2>
                <div className="browse-category-grid">
                  {BROWSE_CATEGORIES.map(cat => (
                    <div 
                      key={cat.id} 
                      className="category-tile"
                      style={{ background: cat.color }}
                      onClick={() => handleCategoryClick(cat)}
                    >
                      <h3 className="category-tile-title">{cat.name}</h3>
                      <div className="category-tile-icon">
                        <Music size={40} opacity={0.7} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Searching Indicator */}
            {isSearching && (
              <div className="search-loading-box">
                <Loader2 className="animate-spin" size={36} color="#1DB954" />
                <p>Searching tracks and playlists...</p>
              </div>
            )}

            {/* Search Results Display */}
            {!isSearching && localSearchQuery && searchResults.length > 0 && (
              <div className="search-results-layout">
                {/* Top Result Card Spotlight */}
                <div className="search-top-result-col">
                  <h3 className="section-subheading">Top Result</h3>
                  {(() => {
                    const topItem = searchResults[0];
                    const topId = topItem.id?.videoId || topItem.id?.playlistId || topItem.id;
                    const isPl = topItem.id?.kind === 'youtube#playlist';
                    const rawTitle = topItem.snippet?.title || '';
                    const thumb = topItem.snippet?.thumbnails?.high?.url || topItem.snippet?.thumbnails?.medium?.url;
                    const { title, artist } = cleanYouTubeTitle(rawTitle, topItem.snippet?.channelTitle);

                    return (
                      <div 
                        className="spotlight-card"
                        onClick={() => isPl ? loadPlaylistTracks(topItem) : handlePlaySong(topId, searchResults, 0)}
                      >
                        {thumb && <img src={thumb} alt="" className="spotlight-thumb" />}
                        <h2 className="spotlight-title">{title}</h2>
                        <div className="spotlight-meta">
                          <span className="spotlight-artist">{artist}</span>
                          <span className="spotlight-badge">{isPl ? 'PLAYLIST' : 'SONG'}</span>
                        </div>
                        <button className="spotlight-play-btn">
                          <Play size={24} fill="#000" color="#000" style={{ marginLeft: '2px' }} />
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* Song Results List */}
                <div className="search-songs-col">
                  <h3 className="section-subheading">Songs</h3>
                  {renderTracklistTable(searchResults.filter(item => item.id?.kind !== 'youtube#playlist').slice(0, 10))}
                </div>

                {/* Additional Playlist Results if present */}
                {searchResults.some(item => item.id?.kind === 'youtube#playlist') && (
                  <div className="search-playlists-full-width">
                    <h3 className="section-subheading">Matching Playlists</h3>
                    {renderCardGrid(searchResults.filter(item => item.id?.kind === 'youtube#playlist'), true)}
                  </div>
                )}
              </div>
            )}

            {!isSearching && localSearchQuery && searchResults.length === 0 && (
              <div className="no-search-results">
                <h3>No results found for "{localSearchQuery}"</h3>
                <p>Please check your spelling or try different keywords.</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            VIEW: LIBRARY (PLAYLISTS)
            ══════════════════════════════════════════ */}
        {view === 'library' && (
          <div className="view-library-page">
            <div className="library-header-row">
              <h1>Your Library</h1>
              <button 
                className="spotify-pill-btn-create"
                onClick={() => setIsCreatingPlaylist(true)}
              >
                <Plus size={18} />
                <span>Create Playlist</span>
              </button>
            </div>

            {existingPlaylists.length === 0 ? (
              <div className="library-empty-box">
                <Music size={48} opacity={0.3} />
                <h3>Your library is empty</h3>
                <p>Create a new playlist or import from Spotify using the Sync Tool!</p>
                <button 
                  className="spotify-green-btn"
                  onClick={() => onTabChange('sync')}
                >
                  Import Spotify Playlist
                </button>
              </div>
            ) : (
              renderCardGrid(existingPlaylists, true)
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            VIEW: TRACKS (PLAYLIST DETAIL)
            ══════════════════════════════════════════ */}
        {view === 'tracks' && selectedPlaylist && (
          <div className="view-tracks-page">
            <button 
              className="spotify-back-link"
              onClick={() => {
                setView('library');
                setSelectedPlaylist(null);
              }}
            >
              <ArrowLeft size={20} />
              <span>Back to Library</span>
            </button>

            {/* Playlist Hero Banner */}
            <div className="playlist-hero-banner">
              <div className="playlist-hero-art">
                {selectedPlaylist.snippet?.thumbnails?.high?.url || selectedPlaylist.snippet?.thumbnails?.medium?.url ? (
                  <img 
                    src={selectedPlaylist.snippet.thumbnails.high?.url || selectedPlaylist.snippet.thumbnails.medium?.url} 
                    alt="" 
                    className="hero-art-img" 
                  />
                ) : (
                  <div className="hero-art-placeholder"><Music size={64} opacity={0.3} /></div>
                )}
              </div>

              <div className="playlist-hero-details">
                <span className="hero-tag">PUBLIC PLAYLIST</span>
                <h1 className="hero-title">{selectedPlaylist.snippet?.title || 'Playlist'}</h1>
                <p className="hero-desc">{selectedPlaylist.snippet?.description || 'Synced with YouTube'}</p>
                <div className="hero-stats">
                  <span><strong>YouTube Music</strong></span>
                  <span>·</span>
                  <span>{tracks.length} tracks</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="playlist-action-bar">
              <button 
                className="hero-big-play-btn"
                onClick={() => handlePlayEntirePlaylist(selectedPlaylist.id)}
                title="Play Playlist"
              >
                <Play size={28} fill="#000000" color="#000000" style={{ marginLeft: '3px' }} />
              </button>
              <button 
                className="hero-sub-action-btn"
                onClick={() => handlePlayEntirePlaylist(selectedPlaylist.id)}
                title="Shuffle Playlist"
              >
                <Shuffle size={24} />
              </button>
            </div>

            {/* Tracklist Table */}
            {isLoadingTracks ? (
              <div className="tracks-loading"><Loader2 className="animate-spin" size={36} color="#1DB954" /></div>
            ) : (
              renderTracklistTable(tracks)
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            VIEW: LIKED SONGS
            ══════════════════════════════════════════ */}
        {view === 'liked' && (
          <div className="view-liked-page">
            {/* Spotify Liked Songs Gradient Banner */}
            <div className="playlist-hero-banner liked-hero-gradient">
              <div className="playlist-hero-art liked-art-box">
                <Heart size={64} fill="#FFFFFF" color="#FFFFFF" />
              </div>

              <div className="playlist-hero-details">
                <span className="hero-tag">PLAYLIST</span>
                <h1 className="hero-title">Liked Songs</h1>
                <div className="hero-stats">
                  <span><strong>Your Account</strong></span>
                  <span>·</span>
                  <span>{likedVideos.length} songs</span>
                </div>
              </div>
            </div>

            {likedVideos.length > 0 && (
              <div className="playlist-action-bar">
                <button 
                  className="hero-big-play-btn"
                  onClick={() => {
                    const firstId = extractVideoId(likedVideos[0]);
                    handlePlaySong(firstId, likedVideos, 0);
                  }}
                  title="Play All"
                >
                  <Play size={28} fill="#000" color="#000" style={{ marginLeft: '3px' }} />
                </button>
              </div>
            )}

            {renderTracklistTable(likedVideos)}
          </div>
        )}

      </div>

      {/* ── CREATE PLAYLIST MODAL ── */}
      {isCreatingPlaylist && (
        <div className="spotify-modal-backdrop" onClick={() => setIsCreatingPlaylist(false)}>
          <div className="spotify-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="spotify-modal-header">
              <h2>Create playlist</h2>
              <button className="modal-close-icon" onClick={() => setIsCreatingPlaylist(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="spotify-modal-body">
              <input 
                type="text" 
                className="spotify-modal-input" 
                placeholder="Give your playlist a name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                autoFocus
              />
              <div className="modal-actions-row">
                <button 
                  className="modal-cancel-btn"
                  onClick={() => setIsCreatingPlaylist(false)}
                >
                  Cancel
                </button>
                <button 
                  className="modal-submit-btn"
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim() || isCreatingSubmitting}
                >
                  {isCreatingSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD TO PLAYLIST MODAL ── */}
      {addingVideoId && (
        <div className="spotify-modal-backdrop" onClick={() => setAddingVideoId(null)}>
          <div className="spotify-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="spotify-modal-header">
              <h2>Add to playlist</h2>
              <button className="modal-close-icon" onClick={() => setAddingVideoId(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="spotify-modal-list">
              {existingPlaylists.length === 0 ? (
                <p className="empty-sub">No playlists found. Create one first!</p>
              ) : (
                existingPlaylists.map(p => (
                  <button 
                    key={p.id}
                    className={`modal-playlist-option ${addedSuccessId === p.id ? 'is-success' : ''}`}
                    onClick={() => handleAddToPlaylist(p.id, addingVideoId)}
                  >
                    <span>{p.snippet?.title}</span>
                    {addedSuccessId === p.id && <Check size={18} color="#1DB954" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
