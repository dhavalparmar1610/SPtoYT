# Spotify to YouTube Music Sync 🎵

A complete, full-stack Next.js application that seamlessly bridges the gap between your Spotify and YouTube accounts. This app lets you view your Spotify playlists and automatically sync them over to YouTube with an intelligent "Smart Auto-Sync" algorithm that prevents duplicate tracks.

## ✨ Features

- **Dual Authentication**: Secure OAuth 2.0 logins for both Spotify and Google/YouTube.
- **Unified Dashboard**: A sleek, dark-mode interface built with Vanilla CSS (No Tailwind dependencies).
- **Interactive Web Players**: Listen to tracks directly in the browser via the Spotify Web Playback SDK and YouTube IFrame API.
- **Smart Auto-Sync**: Enable intelligent syncing to compare an existing YouTube playlist against your Spotify playlist. It automatically diffs the tracks and only adds the ones that are missing!
- **Track-by-Track Progress**: Watch the sync progress in real-time with visual indicators for each song (Pending, Synced, or Not Found).
- **Rate-Limit Safe**: Built-in 500ms delay algorithms ensure you never hit YouTube's API quota limits during large playlist syncs.

## 🚀 Getting Started

### Prerequisites
You will need Node.js installed on your machine. You will also need developer accounts for both platforms:
1. **Spotify Developer Dashboard**: Create an app and get your `Client ID` and `Client Secret`.
2. **Google Cloud Console**: Create a project, enable the "YouTube Data API v3", and generate an OAuth 2.0 `Client ID` and `Client Secret`.

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd SPtoYT
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Rename the provided `.env.example` file to `.env` (or `.env.local`).
   ```bash
   cp .env.example .env
   ```
   Fill in your API credentials. **Important:** Ensure your redirect URIs in the Spotify and Google Cloud consoles exactly match the `http://localhost:3000/api/auth/.../callback` URLs defined in your `.env` file!

### Running the App

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Connect both accounts, select a playlist from the left panel, and click **Sync to YouTube**!

## 🛠 Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: JavaScript / JSX
- **Styling**: Vanilla CSS (`globals.css`)
- **APIs**: Spotify Web API, YouTube Data API v3
- **Libraries**: `axios`, `googleapis`, `spotify-web-api-node`, `lucide-react`
