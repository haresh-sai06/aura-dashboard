import type { CSSProperties } from 'react';
import {
  Music, Navigation, Thermometer, Phone, Settings as SettingsIcon,
  Play, Pause, SkipForward, SkipBack, Volume2, Plus, Minus, Wind, Snowflake,
  PhoneCall, User, ShieldCheck,
} from 'lucide-react';
import { useOS, TRACKS, DESTINATIONS, type AppId } from './OSContext';
import { useAura } from '../AuraContext';
import DriverSelector from '../components/DriverSelector';

export const APP_META: { id: AppId; name: string; icon: typeof Music; accent: string }[] = [
  { id: 'music', name: 'Music', icon: Music, accent: '#3b82f6' },
  { id: 'navigation', name: 'Navigation', icon: Navigation, accent: '#22c55e' },
  { id: 'climate', name: 'Climate', icon: Thermometer, accent: '#f59e0b' },
  { id: 'phone', name: 'Phone', icon: Phone, accent: '#8b5cf6' },
  { id: 'settings', name: 'Settings', icon: SettingsIcon, accent: '#a1a1aa' },
];

const card: CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12 };
const iconBtn: CSSProperties = {
  width: 48, height: 48, borderRadius: '50%', border: '1px solid var(--border)',
  background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const label: CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' };

export function Launcher() {
  const { openApp } = useOS();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
      {APP_META.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.id}
            onClick={() => openApp(a.id)}
            style={{ ...card, padding: 22, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--text-primary)' }}
          >
            <span style={{ width: 56, height: 56, borderRadius: 16, background: `${a.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={26} style={{ color: a.accent }} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function renderApp(id: AppId) {
  switch (id) {
    case 'music': return <MusicApp />;
    case 'navigation': return <NavApp />;
    case 'climate': return <ClimateApp />;
    case 'phone': return <PhoneApp />;
    case 'settings': return <SettingsApp />;
  }
}

function MusicApp() {
  const { music, setMusicPlaying, nextTrack, prevTrack, setVolume } = useOS();
  const { driver } = useAura();
  const track = TRACKS[music.trackIndex];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
      <div style={{ ...card, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 120, height: 120, borderRadius: 16, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Music size={48} color="#fff" />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{track.title}</div>
        <div style={{ color: 'var(--text-tertiary)' }}>{track.artist}</div>
        <div style={{ ...label, color: 'var(--accent)' }}>{driver ? `${driver.playlist} · ${driver.name}` : 'Playlist'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 8 }}>
          <button style={iconBtn} onClick={prevTrack}><SkipBack size={20} /></button>
          <button style={{ ...iconBtn, width: 60, height: 60, background: 'var(--accent)', border: 'none', color: '#fff' }} onClick={() => setMusicPlaying(!music.playing)}>
            {music.playing ? <Pause size={26} /> : <Play size={26} />}
          </button>
          <button style={iconBtn} onClick={nextTrack}><SkipForward size={20} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginTop: 10 }}>
          <Volume2 size={16} style={{ color: 'var(--text-tertiary)' }} />
          <input type="range" min={0} max={100} value={music.volume} onChange={(e) => setVolume(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
          <span style={{ ...label, width: 32, textAlign: 'right' }}>{music.volume}</span>
        </div>
      </div>
    </div>
  );
}

function NavApp() {
  const { nav, setDestination } = useOS();
  const dest = DESTINATIONS.find((d) => d.id === nav.destination);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 620 }}>
      <div style={{ ...card, padding: 0, height: 220, overflow: 'hidden', position: 'relative', background: '#0d1622' }}>
        {/* faux map */}
        <svg width="100%" height="100%" viewBox="0 0 600 220" preserveAspectRatio="none">
          <rect width="600" height="220" fill="#0d1622" />
          {[40, 90, 140, 190].map((y) => <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#1e2a3a" strokeWidth="1" />)}
          {[120, 260, 400, 520].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="220" stroke="#1e2a3a" strokeWidth="1" />)}
          <polyline points="40,200 120,170 260,150 400,90 520,40" fill="none" stroke={dest ? '#22c55e' : '#3b82f6'} strokeWidth="4" strokeLinecap="round" />
          <circle cx="40" cy="200" r="6" fill="#3b82f6" />
          <circle cx="520" cy="40" r="7" fill={dest ? '#22c55e' : '#71717a'} />
        </svg>
        {dest && (
          <div style={{ position: 'absolute', top: 12, left: 12, ...card, padding: '8px 14px' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{dest.name}</div>
            <div style={{ ...label }}>{dest.eta} · {dest.dist}</div>
          </div>
        )}
      </div>
      <div>
        <p style={{ ...label, marginBottom: 8 }}>Where to?</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {DESTINATIONS.map((d) => (
            <button key={d.id} onClick={() => setDestination(d.id)} style={{ ...card, padding: '12px 18px', cursor: 'pointer', border: nav.destination === d.id ? '1px solid var(--success)' : '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <div style={{ fontWeight: 600 }}>{d.name}</div>
              <div style={{ ...label }}>{d.eta}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClimateApp() {
  const { climate, setTemp, setFan, toggleAc } = useOS();
  return (
    <div style={{ ...card, padding: 28, maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <p style={label}>Cabin Temperature</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <button style={iconBtn} onClick={() => setTemp(climate.temp - 1)}><Minus size={20} /></button>
        <div style={{ fontSize: 56, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>{climate.temp}°</div>
        <button style={iconBtn} onClick={() => setTemp(climate.temp + 1)}><Plus size={20} /></button>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Wind size={16} style={{ color: 'var(--text-tertiary)' }} />
        {[0, 1, 2, 3, 4, 5].map((f) => (
          <button key={f} onClick={() => setFan(f)} style={{ width: 28, height: 28, borderRadius: 6, cursor: 'pointer', border: 'none', background: f <= climate.fan && f > 0 ? 'var(--accent)' : 'var(--bg-tertiary)', color: '#fff', fontSize: 11 }}>{f}</button>
        ))}
      </div>
      <button onClick={toggleAc} style={{ ...card, padding: '10px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: climate.ac ? 'var(--accent)' : 'var(--text-tertiary)', border: climate.ac ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
        <Snowflake size={16} /> A/C {climate.ac ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

function PhoneApp() {
  const contacts = [
    { name: 'Kiran (Team)', num: '+91 90000 11111' },
    { name: 'Mallika (Team)', num: '+91 90000 22222' },
    { name: 'Home', num: '+91 90000 33333' },
    { name: 'Roadside Assist', num: '1800-AURA' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 460 }}>
      <p style={label}>Recent &amp; Contacts</p>
      {contacts.map((c) => (
        <div key={c.num} style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={18} /></span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
              <div style={{ ...label, textTransform: 'none' }}>{c.num}</div>
            </div>
          </div>
          <button style={{ ...iconBtn, width: 42, height: 42, background: 'var(--success)', border: 'none', color: '#fff' }}><PhoneCall size={18} /></button>
        </div>
      ))}
    </div>
  );
}

function SettingsApp() {
  const { driver, live } = useAura();
  const { voiceSupported } = useOS();
  const rows = [
    { k: 'Driver', v: driver?.name ?? 'Unidentified' },
    { k: 'Playlist', v: driver?.playlist ?? '—' },
    { k: 'Personal drowsiness threshold', v: live?.baseline != null ? `eyes ${live.baseline}s baseline` : '—' },
    { k: 'Voice control', v: voiceSupported ? 'Web Speech API (Chrome/Edge)' : 'Not supported in this browser' },
    { k: 'Inference', v: 'On-device · MediaPipe + 7-signal fusion' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560 }}>
      <div style={{ ...card, padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShieldCheck size={22} style={{ color: 'var(--accent)' }} /></span>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Aura OS</div>
          <div style={{ ...label, textTransform: 'none' }}>Edge driver-persona system · private, offline</div>
        </div>
      </div>

      <div style={{ ...card, padding: 18 }}>
        <p style={{ ...label, marginBottom: 12 }}>Driver profile · each carries their own adaptive safety baseline</p>
        <DriverSelector />
      </div>

      {rows.map((r) => (
        <div key={r.k} style={{ ...card, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>{r.k}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right' }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}
