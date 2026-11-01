import axios from 'axios';

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.map(cb => cb(token));
  refreshSubscribers = [];
}

/**
 * Get or refresh a valid YouTube access token
 */
export async function getValidYouTubeToken() {
  if (typeof window === 'undefined') return null;

  let token = localStorage.getItem('youtube_token');
  let refreshToken = localStorage.getItem('youtube_refresh_token');
  let expiry = localStorage.getItem('youtube_token_expiry');

  // If missing from localStorage, check server-side SQLite session
  if (!token || !refreshToken) {
    try {
      const res = await axios.get('/api/auth/session');
      const session = res.data?.session;
      if (session?.youtube_access_token) {
        token = session.youtube_access_token;
        refreshToken = session.youtube_refresh_token || refreshToken;
        expiry = session.youtube_expiry_date || expiry;

        localStorage.setItem('youtube_token', token);
        if (refreshToken) localStorage.setItem('youtube_refresh_token', refreshToken);
        if (expiry) localStorage.setItem('youtube_token_expiry', expiry.toString());
      }
    } catch (e) {
      console.warn('Could not restore session from server:', e);
    }
  }

  if (!token) return null;

  // Check if token is expired or expiring in next 5 minutes
  const expiryTime = Number(expiry) || 0;
  const isExpiringSoon = expiryTime > 0 && Date.now() > (expiryTime - 300000);

  if (isExpiringSoon && refreshToken) {
    try {
      token = await refreshYouTubeToken(refreshToken);
    } catch (e) {
      console.warn('Proactive token refresh failed, using existing token:', e);
    }
  }

  return token;
}

/**
 * Call refresh endpoint
 */
export async function refreshYouTubeToken(refreshToken) {
  if (isRefreshing) {
    return new Promise(resolve => {
      subscribeTokenRefresh(token => resolve(token));
    });
  }

  isRefreshing = true;

  try {
    const res = await axios.post('/api/auth/youtube/refresh', {
      refresh_token: refreshToken || localStorage.getItem('youtube_refresh_token')
    });

    if (res.data?.success && res.data?.access_token) {
      const newToken = res.data.access_token;
      const newExpiry = res.data.expiry_date;
      const newRefresh = res.data.refresh_token;

      localStorage.setItem('youtube_token', newToken);
      if (newExpiry) localStorage.setItem('youtube_token_expiry', newExpiry.toString());
      if (newRefresh) localStorage.setItem('youtube_refresh_token', newRefresh);

      onRefreshed(newToken);
      return newToken;
    }
  } catch (error) {
    console.error('Failed to refresh YouTube token:', error);
    throw error;
  } finally {
    isRefreshing = false;
  }

  return localStorage.getItem('youtube_token');
}

/**
 * Execute YouTube API GET request with automatic 401 retry
 */
export async function youtubeGet(url, params = {}) {
  let token = await getValidYouTubeToken();
  if (!token) throw new Error('Not authenticated with YouTube');

  try {
    return await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('Received 401 from YouTube API, refreshing token...');
      try {
        const refreshedToken = await refreshYouTubeToken();
        if (refreshedToken) {
          return await axios.get(url, {
            headers: { Authorization: `Bearer ${refreshedToken}` },
            params
          });
        }
      } catch (refreshErr) {
        console.error('Auto-refresh on 401 failed:', refreshErr);
      }
    }
    throw error;
  }
}

/**
 * Execute YouTube API POST request with automatic 401 retry
 */
export async function youtubePost(url, data = {}, params = {}) {
  let token = await getValidYouTubeToken();
  if (!token) throw new Error('Not authenticated with YouTube');

  try {
    return await axios.post(url, data, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('Received 401 on POST from YouTube API, refreshing token...');
      try {
        const refreshedToken = await refreshYouTubeToken();
        if (refreshedToken) {
          return await axios.post(url, data, {
            headers: { Authorization: `Bearer ${refreshedToken}` },
            params
          });
        }
      } catch (refreshErr) {
        console.error('Auto-refresh on 401 failed:', refreshErr);
      }
    }
    throw error;
  }
}

/**
 * Execute YouTube API DELETE request with automatic 401 retry
 */
export async function youtubeDelete(url, params = {}) {
  let token = await getValidYouTubeToken();
  if (!token) throw new Error('Not authenticated with YouTube');

  try {
    return await axios.delete(url, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
  } catch (error) {
    if (error.response?.status === 401) {
      const refreshedToken = await refreshYouTubeToken();
      if (refreshedToken) {
        return await axios.delete(url, {
          headers: { Authorization: `Bearer ${refreshedToken}` },
          params
        });
      }
    }
    throw error;
  }
}

