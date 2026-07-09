import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CORE_HTTP } from '../config';

export type AppId = 'music' | 'navigation' | 'climate' | 'phone' | 'settings';

export type AuraNotification = {
  id: number;
  kind: 'info' | 'warning' | 'danger';
  title: string;
  detail: string;
  time: string;
};

export const TRACKS = [
  { title: 'Neon Highway', artist: 'Synth Riders' },
  { title: 'Midnight Drive', artist: 'Lumen' },
  { title: 'City Lights', artist: 'Aria Vex' },
  { title: 'Focus Flow', artist: 'Tycho Park' },
];

export const DESTINATIONS = [
  { id: 'home', name: 'Home', eta: '18 min', dist: '12 km' },
  { id: 'office', name: 'Office', eta: '25 min', dist: '19 km' },
  { id: 'airport', name: 'Airport', eta: '42 min', dist: '38 km' },
];

type OSState = {
  activeApp: AppId | null;
  music: { playing: boolean; trackIndex: number; volume: number };
  climate: { temp: number; fan: number; ac: boolean };
  nav: { destination: string | null };
  notifications: AuraNotification[];
};

type OSValue = OSState & {
  openApp: (id: AppId) => void;
  closeApp: () => void;
  setMusicPlaying: (p: boolean) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (v: number) => void;
  setTemp: (t: number) => void;
  setFan: (f: number) => void;
  toggleAc: () => void;
  setDestination: (id: string | null) => void;
  notify: (n: Omit<AuraNotification, 'id' | 'time'>) => void;
  dismissNotification: (id: number) => void;
  // voice
  voiceSupported: boolean;
  listening: boolean;
  transcript: string;
  voiceFeedback: string;
  startVoice: () => void;
  stopVoice: () => void;
  runCommand: (text: string) => string;
};

const Ctx = createContext<OSValue | null>(null);
export const useOS = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOS must be used within OSProvider');
  return v;
};

const CORE = CORE_HTTP;
let nid = 1;

export function OSProvider({ children }: { children: ReactNode }) {
  const [activeApp, setActiveApp] = useState<AppId | null>(null);
  const [music, setMusic] = useState({ playing: false, trackIndex: 0, volume: 60 });
  const [climate, setClimate] = useState({ temp: 22, fan: 2, ac: true });
  const [nav, setNav] = useState<{ destination: string | null }>({ destination: null });
  const [notifications, setNotifications] = useState<AuraNotification[]>([]);

  const notify = useCallback((n: Omit<AuraNotification, 'id' | 'time'>) => {
    const item: AuraNotification = { ...n, id: nid++, time: new Date().toLocaleTimeString() };
    setNotifications((prev) => [item, ...prev].slice(0, 12));
  }, []);
  const dismissNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const openApp = useCallback((id: AppId) => setActiveApp(id), []);
  const closeApp = useCallback(() => setActiveApp(null), []);
  const setMusicPlaying = useCallback((p: boolean) => setMusic((m) => ({ ...m, playing: p })), []);
  const nextTrack = useCallback(() => setMusic((m) => ({ ...m, trackIndex: (m.trackIndex + 1) % TRACKS.length, playing: true })), []);
  const prevTrack = useCallback(() => setMusic((m) => ({ ...m, trackIndex: (m.trackIndex - 1 + TRACKS.length) % TRACKS.length, playing: true })), []);
  const setVolume = useCallback((v: number) => setMusic((m) => ({ ...m, volume: Math.max(0, Math.min(100, v)) })), []);
  const setTemp = useCallback((t: number) => setClimate((c) => ({ ...c, temp: Math.max(16, Math.min(30, t)) })), []);
  const setFan = useCallback((f: number) => setClimate((c) => ({ ...c, fan: Math.max(0, Math.min(5, f)) })), []);
  const toggleAc = useCallback(() => setClimate((c) => ({ ...c, ac: !c.ac })), []);
  const setDestination = useCallback((id: string | null) => setNav({ destination: id }), []);

  // --- Voice command engine -------------------------------------------------
  const runCommand = useCallback(
    (raw: string): string => {
      const t = raw.toLowerCase().trim();
      const fb = (msg: string, kind: AuraNotification['kind'] = 'info') => {
        notify({ kind, title: 'Voice', detail: `“${raw.trim()}” → ${msg}` });
        return msg;
      };

      // Driver-response: clear the drowsiness alert + resume the car
      if (/\b(i'?m awake|wake|resume|i am awake|continue driving)\b/.test(t)) {
        fetch(`${CORE}/emit/resume`, { method: 'POST' }).catch(() => {});
        return fb('Confirmed awake — resuming', 'info');
      }

      // Music
      if (/\b(pause|stop)\b/.test(t) && /music|song|playback/.test(t)) { setMusicPlaying(false); return fb('Paused music'); }
      if (/\bnext|skip\b/.test(t)) { nextTrack(); setActiveApp('music'); return fb('Next track'); }
      if (/\b(previous|last) (track|song)\b/.test(t)) { prevTrack(); setActiveApp('music'); return fb('Previous track'); }
      if (/louder|volume up|turn it up/.test(t)) { setMusic((m) => ({ ...m, volume: Math.min(100, m.volume + 15) })); return fb('Volume up'); }
      if (/quieter|volume down|turn it down/.test(t)) { setMusic((m) => ({ ...m, volume: Math.max(0, m.volume - 15) })); return fb('Volume down'); }
      if (/\b(play|open|start)\b.*\b(music|song|playlist)\b|^play\b/.test(t)) { setActiveApp('music'); setMusicPlaying(true); return fb('Playing music'); }

      // Navigation
      const dest = DESTINATIONS.find((d) => t.includes(d.id) || t.includes(d.name.toLowerCase()));
      if (/navigat|directions|drive to|take me|route to|go to/.test(t) || (dest && /home|office|airport/.test(t))) {
        setActiveApp('navigation');
        if (dest) { setDestination(dest.id); return fb(`Navigating to ${dest.name}`); }
        return fb('Opened Navigation');
      }

      // Climate
      const tempMatch = t.match(/(\d{2})\s*(degrees?|°|c)?/);
      if (/temperature|climate|\bac\b|air ?con|cabin/.test(t) || (tempMatch && /temp|degree|set/.test(t))) {
        setActiveApp('climate');
        if (/warmer|increase|hotter/.test(t)) { setClimate((c) => ({ ...c, temp: Math.min(30, c.temp + 1) })); return fb('Warmer'); }
        if (/cooler|decrease|colder/.test(t)) { setClimate((c) => ({ ...c, temp: Math.max(16, c.temp - 1) })); return fb('Cooler'); }
        if (tempMatch) { const n = parseInt(tempMatch[1], 10); if (n >= 16 && n <= 30) { setTemp(n); return fb(`Set ${n}°C`); } }
        if (/turn off (the )?ac|ac off/.test(t)) { setClimate((c) => ({ ...c, ac: false })); return fb('AC off'); }
        if (/turn on (the )?ac|ac on/.test(t)) { setClimate((c) => ({ ...c, ac: true })); return fb('AC on'); }
        return fb('Opened Climate');
      }

      // Phone / settings / home
      if (/phone|call|dial/.test(t)) { setActiveApp('phone'); return fb('Opened Phone'); }
      if (/settings|profile|preferences/.test(t)) { setActiveApp('settings'); return fb('Opened Settings'); }
      if (/\b(home|launcher|back|close|main menu|dashboard)\b/.test(t)) { setActiveApp(null); return fb('Home'); }

      return fb('Sorry, I didn’t catch that', 'warning');
    },
    [notify, nextTrack, prevTrack, setMusicPlaying, setTemp, setDestination]
  );

  // --- Web Speech API -------------------------------------------------------
  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceFeedback, setVoiceFeedback] = useState('');
  const recRef = useRef<unknown>(null);
  const wantListening = useRef(false);
  const runRef = useRef(runCommand);
  runRef.current = runCommand;

  const startVoice = useCallback(() => {
    if (!supported) return;
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown });
    const Ctor = (SR.SpeechRecognition || SR.webkitSpeechRecognition) as
      | (new () => {
          continuous: boolean;
          interimResults: boolean;
          lang: string;
          start: () => void;
          stop: () => void;
          onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
          onend: (() => void) | null;
          onerror: (() => void) | null;
        })
      | undefined;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      let finalText = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      setTranscript(interim || finalText);
      if (finalText) {
        setVoiceFeedback(runRef.current(finalText));
        setTranscript('');
      }
    };
    rec.onend = () => {
      if (wantListening.current) {
        try { rec.start(); } catch { /* already starting */ }
      } else {
        setListening(false);
      }
    };
    rec.onerror = () => {};
    recRef.current = rec;
    wantListening.current = true;
    try { rec.start(); setListening(true); } catch { /* ignore */ }
  }, [supported]);

  const stopVoice = useCallback(() => {
    wantListening.current = false;
    const rec = recRef.current as { stop: () => void } | null;
    rec?.stop?.();
    setListening(false);
    setTranscript('');
  }, []);

  useEffect(() => () => { wantListening.current = false; (recRef.current as { stop?: () => void } | null)?.stop?.(); }, []);

  const value: OSValue = {
    activeApp, music, climate, nav, notifications,
    openApp, closeApp, setMusicPlaying, nextTrack, prevTrack, setVolume,
    setTemp, setFan, toggleAc, setDestination, notify, dismissNotification,
    voiceSupported: supported, listening, transcript, voiceFeedback, startVoice, stopVoice, runCommand,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
