import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./mobile.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Music Sync",
  description: "Synchronize your Spotify playlists to YouTube Music seamlessly.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Music Sync",
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo-512.png',
  },
  formatDetection: {
    telephone: false,
  },
  themeColor: "#0070f3",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
