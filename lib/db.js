import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'session.sqlite');
const JSON_FILE = path.join(DATA_DIR, 'session.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create data directory:', e);
  }
}

let sqliteDb = null;
let useSqlite = false;

// Attempt to initialize node:sqlite
try {
  const { DatabaseSync } = await import('node:sqlite');
  sqliteDb = new DatabaseSync(DB_FILE);
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      youtube_access_token TEXT,
      youtube_refresh_token TEXT,
      youtube_expiry_date INTEGER,
      spotify_access_token TEXT,
      spotify_refresh_token TEXT,
      spotify_expiry_date INTEGER,
      updated_at INTEGER
    )
  `);
  useSqlite = true;
} catch (e) {
  useSqlite = false;
}

// Fallback JSON store helpers
function readJsonStore() {
  try {
    if (fs.existsSync(JSON_FILE)) {
      const content = fs.readFileSync(JSON_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('Error reading session JSON store:', err);
  }
  return {};
}

function writeJsonStore(data) {
  try {
    fs.writeFileSync(JSON_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing session JSON store:', err);
  }
}

export function getSession(sessionId = 'default') {
  if (useSqlite && sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT * FROM sessions WHERE id = ?');
      const row = stmt.get(sessionId);
      if (row) return row;
    } catch (e) {
      console.warn('SQLite read failed, falling back to JSON:', e);
    }
  }

  const json = readJsonStore();
  return json[sessionId] || null;
}

export function saveSession(sessionData, sessionId = 'default') {
  const now = Date.now();
  const existing = getSession(sessionId) || {};

  const merged = {
    id: sessionId,
    youtube_access_token: sessionData.youtube_access_token !== undefined ? sessionData.youtube_access_token : existing.youtube_access_token || null,
    youtube_refresh_token: sessionData.youtube_refresh_token !== undefined ? sessionData.youtube_refresh_token : existing.youtube_refresh_token || null,
    youtube_expiry_date: sessionData.youtube_expiry_date !== undefined ? Number(sessionData.youtube_expiry_date) : existing.youtube_expiry_date || null,
    spotify_access_token: sessionData.spotify_access_token !== undefined ? sessionData.spotify_access_token : existing.spotify_access_token || null,
    spotify_refresh_token: sessionData.spotify_refresh_token !== undefined ? sessionData.spotify_refresh_token : existing.spotify_refresh_token || null,
    spotify_expiry_date: sessionData.spotify_expiry_date !== undefined ? Number(sessionData.spotify_expiry_date) : existing.spotify_expiry_date || null,
    updated_at: now
  };

  if (useSqlite && sqliteDb) {
    try {
      const stmt = sqliteDb.prepare(`
        INSERT INTO sessions (
          id, youtube_access_token, youtube_refresh_token, youtube_expiry_date,
          spotify_access_token, spotify_refresh_token, spotify_expiry_date, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          youtube_access_token = excluded.youtube_access_token,
          youtube_refresh_token = COALESCE(excluded.youtube_refresh_token, sessions.youtube_refresh_token),
          youtube_expiry_date = excluded.youtube_expiry_date,
          spotify_access_token = excluded.spotify_access_token,
          spotify_refresh_token = COALESCE(excluded.spotify_refresh_token, sessions.spotify_refresh_token),
          spotify_expiry_date = excluded.spotify_expiry_date,
          updated_at = excluded.updated_at
      `);
      stmt.run(
        merged.id,
        merged.youtube_access_token,
        merged.youtube_refresh_token,
        merged.youtube_expiry_date,
        merged.spotify_access_token,
        merged.spotify_refresh_token,
        merged.spotify_expiry_date,
        merged.updated_at
      );
    } catch (e) {
      console.warn('SQLite write failed, saving to JSON:', e);
    }
  }

  // Also sync to JSON store for resilience
  const json = readJsonStore();
  json[sessionId] = merged;
  writeJsonStore(json);

  return merged;
}

export function clearSession(sessionId = 'default') {
  if (useSqlite && sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('DELETE FROM sessions WHERE id = ?');
      stmt.run(sessionId);
    } catch (e) {
      console.warn('SQLite delete failed:', e);
    }
  }

  const json = readJsonStore();
  delete json[sessionId];
  writeJsonStore(json);
}

