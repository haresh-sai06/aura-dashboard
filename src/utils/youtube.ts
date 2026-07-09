// YouTube integration for the in-car music player.
//
//   • SEARCH uses the YouTube Data API v3 (needs your key in VITE_YOUTUBE_API_KEY) to turn a
//     song name into a playable video.
//   • PLAYBACK uses the YouTube IFrame Player API (no key) to actually stream the audio.
//
// The key is read from Vite env at build/dev time: put it in aura-dashboard/.env.local as
//   VITE_YOUTUBE_API_KEY=AIza...
// (restart `npm run dev` after adding it). Without a key, search is disabled and the player shows
// a hint — everything else in the app is unaffected.

const KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;

export function youtubeKeyPresent(): boolean {
  return !!KEY && KEY.length > 10;
}

export type YtVideo = { id: string; title: string; thumb?: string };

const searchCache = new Map<string, YtVideo | null>();

/** Find the top embeddable video for a query. Cached; returns null if no key / no result. */
export async function searchVideo(query: string): Promise<YtVideo | null> {
  const q = query.trim();
  if (!q) return null;
  if (searchCache.has(q)) return searchCache.get(q)!;
  if (!youtubeKeyPresent()) { searchCache.set(q, null); return null; }
  try {
    const url =
      'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true' +
      `&maxResults=1&q=${encodeURIComponent(q)}&key=${KEY}`;
    const r = await fetch(url);
    const d = await r.json();
    const item = d.items?.[0];
    const res: YtVideo | null = item
      ? { id: item.id.videoId, title: item.snippet.title, thumb: item.snippet.thumbnails?.medium?.url }
      : null;
    searchCache.set(q, res);
    return res;
  } catch {
    searchCache.set(q, null);
    return null;
  }
}

// Minimal typing for the bits of the IFrame API we use.
export interface YTPlayer {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (v: number) => void;
}
type YTGlobal = { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };

let apiPromise: Promise<void> | null = null;

/** Load the IFrame Player API script once and resolve when it's ready. */
export function loadYouTubeApi(): Promise<void> {
  const w = window as unknown as { YT?: YTGlobal; onYouTubeIframeAPIReady?: () => void };
  if (w.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    w.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return apiPromise;
}

export function getYT(): YTGlobal | undefined {
  return (window as unknown as { YT?: YTGlobal }).YT;
}
