import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAura } from '../AuraContext';
import { OSProvider, useOS } from '../os/OSContext';
import { APP_META, Launcher, renderApp } from '../os/apps';
import {
  Mic, MicOff, ChevronLeft, X, AlertTriangle, ShieldCheck, Music as MusicIcon,
  Thermometer, Navigation as NavIcon, Send,
} from 'lucide-react';

const CORE = 'http://127.0.0.1:8765';
const card: CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12 };
const label: CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' };

export default function Home() {
  return (
    <OSProvider>
      <HomeShell />
    </OSProvider>
  );
}

function HomeShell() {
  const { driver, alert, live } = useAura();
  const os = useOS();
  const [clock, setClock] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 10000);
    return () => clearInterval(t);
  }, []);

  // Bridge safety alerts into the OS notification center.
  const prevAlert = useRef(false);
  useEffect(() => {
    const now = !!alert;
    if (now && !prevAlert.current) os.notify({ kind: 'danger', title: 'Drowsiness Alert', detail: alert!.reason });
    if (!now && prevAlert.current) os.notify({ kind: 'info', title: 'Recovered', detail: 'Driver responded — resuming.' });
    prevAlert.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert]);

  const activeMeta = APP_META.find((a) => a.id === os.activeApp);

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {driver ? `Welcome, ${driver.name}` : 'Aura OS'}
          </h1>
          <p style={{ ...label, textTransform: 'none', marginTop: 2 }}>
            {driver ? 'On-device persona loaded' : 'Take your seat — Aura will recognize you'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <SafetyPill score={live?.score ?? 0} alert={!!alert} />
          <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{clock}</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
        {os.activeApp && activeMeta ? (
          <div>
            <button onClick={os.closeApp} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13, marginBottom: 16 }}>
              <ChevronLeft size={16} /> Home
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>{activeMeta.name}</h2>
            {renderApp(os.activeApp)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <QuickWidgets />
            <div>
              <p style={{ ...label, marginBottom: 12 }}>Apps</p>
              <Launcher />
            </div>
          </div>
        )}
      </div>

      {/* Voice bar */}
      <VoiceBar />

      {/* Notification toasts */}
      <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', flexDirection: 'column', gap: 8, width: 280, pointerEvents: 'none' }}>
        {os.notifications.slice(0, 4).map((n) => (
          <div key={n.id} style={{ ...card, padding: '10px 12px', pointerEvents: 'auto', boxShadow: `inset 3px 0 0 ${n.kind === 'danger' ? 'var(--danger)' : n.kind === 'warning' ? 'var(--warning)' : 'var(--accent)'}`, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{n.detail}</div>
            </div>
            <button onClick={() => os.dismissNotification(n.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={14} /></button>
          </div>
        ))}
      </div>

      {/* Drowsiness takeover */}
      {alert && <AlertOverlay reason={alert.reason} />}
    </div>
  );
}

function SafetyPill({ score, alert }: { score: number; alert: boolean }) {
  const color = alert ? 'var(--danger)' : score >= 45 ? 'var(--warning)' : score >= 20 ? 'var(--accent)' : 'var(--success)';
  const text = alert ? 'DROWSY' : score >= 45 ? 'ELEVATED' : score >= 20 ? 'MILD' : 'ALERT';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: `color-mix(in srgb, ${color} 12%, transparent)`, color, fontSize: 12, fontWeight: 700 }}>
      <ShieldCheck size={14} /> {text}
    </span>
  );
}

function QuickWidgets() {
  const os = useOS();
  const { live } = useAura();
  const widgets = [
    { icon: MusicIcon, label: 'Now Playing', value: os.music.playing ? 'Playing' : 'Paused', accent: '#3b82f6', onClick: () => os.openApp('music') },
    { icon: Thermometer, label: 'Climate', value: `${os.climate.temp}°C`, accent: '#f59e0b', onClick: () => os.openApp('climate') },
    { icon: NavIcon, label: 'Navigation', value: os.nav.destination ? os.nav.destination : 'Set route', accent: '#22c55e', onClick: () => os.openApp('navigation') },
    { icon: ShieldCheck, label: 'Driver Risk', value: `${Math.round(live?.score ?? 0)}`, accent: '#8b5cf6', onClick: () => {} },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
      {widgets.map((w) => {
        const Icon = w.icon;
        return (
          <button key={w.label} onClick={w.onClick} style={{ ...card, padding: 16, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-primary)' }}>
            <Icon size={18} style={{ color: w.accent }} />
            <div style={{ ...label }}>{w.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{w.value}</div>
          </button>
        );
      })}
    </div>
  );
}

function VoiceBar() {
  const os = useOS();
  const [text, setText] = useState('');
  const submit = () => { if (text.trim()) { os.runCommand(text); setText(''); } };

  return (
    <div style={{ ...card, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={() => (os.listening ? os.stopVoice() : os.startVoice())}
        disabled={!os.voiceSupported}
        title={os.voiceSupported ? 'Toggle hands-free voice' : 'Voice not supported in this browser'}
        style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: os.voiceSupported ? 'pointer' : 'not-allowed', flexShrink: 0, color: '#fff', background: os.listening ? 'var(--danger)' : os.voiceSupported ? 'var(--accent)' : 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: os.listening ? 'pulse 1.2s infinite' : 'none' }}
      >
        {os.listening ? <Mic size={20} /> : <MicOff size={20} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        {os.listening || os.transcript ? (
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{os.transcript || 'Listening…'}</div>
        ) : (
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={os.voiceSupported ? 'Tap mic to talk, or type: “open music”, “navigate to office”, “I’m awake”' : 'Type a command: “open music”, “set temperature to 24”, “I’m awake”'}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13 }}
          />
        )}
        {os.voiceFeedback && <div style={{ ...label, textTransform: 'none', marginTop: 2 }}>↳ {os.voiceFeedback}</div>}
      </div>
      {!os.listening && (
        <button onClick={submit} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={16} /></button>
      )}
    </div>
  );
}

function AlertOverlay({ reason }: { reason: string }) {
  const wake = () => { fetch(`${CORE}/emit/resume`, { method: 'POST' }).catch(() => {}); };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(120,0,0,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, border: '12px solid var(--danger)', animation: 'pulse 0.9s infinite', pointerEvents: 'none' }} />
      <div style={{ textAlign: 'center', color: '#fff', maxWidth: 560, padding: 24 }}>
        <AlertTriangle size={72} style={{ margin: '0 auto 16px', display: 'block' }} />
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: 6 }}>WAKE UP</div>
        <p style={{ fontSize: 18, opacity: 0.9, margin: '8px 0 4px' }}>{reason}</p>
        <p style={{ fontSize: 14, opacity: 0.8 }}>Aura is pulling the vehicle over safely.</p>
        <button onClick={wake} style={{ marginTop: 24, padding: '14px 32px', fontSize: 16, fontWeight: 700, borderRadius: 12, border: '2px solid #fff', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
          I&rsquo;M AWAKE
        </button>
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>or say “I’m awake”</p>
      </div>
    </div>
  );
}
