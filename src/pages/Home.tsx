import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useAura } from '../AuraContext';
import { OSProvider, useOS, TRACKS, DESTINATIONS } from '../os/OSContext';
import { APP_META, renderApp, PLACE_QUERIES } from '../os/apps';
import { CORE_HTTP } from '../config';
import { glass, glassStrong, label, Chip, AuraOrb } from '../ui';
import FirstDrive from '../components/FirstDrive';
import {
  Mic, MicOff, ChevronLeft, X, ShieldCheck, Music as MusicIcon,
  Thermometer, Navigation as NavIcon, Send, Play, Pause, SkipForward, SkipBack,
  Wifi, Snowflake, MapPin,
} from 'lucide-react';

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
  const [onboarding, setOnboarding] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('welcome'),
  );
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  const prevAlert = useRef(false);
  useEffect(() => {
    const on = !!alert;
    if (on && !prevAlert.current) os.notify({ kind: 'danger', title: 'Drowsiness Alert', detail: alert!.reason });
    if (!on && prevAlert.current) os.notify({ kind: 'info', title: 'Recovered', detail: 'Driver responded — resuming.' });
    prevAlert.current = on;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert]);

  const activeMeta = APP_META.find((a) => a.id === os.activeApp);
  const clock = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

  // The "First Drive" welcome ceremony (triggered with ?welcome=1) takes over the head unit
  // until the driver is onboarded, then hands back to the normal Aura OS.
  if (onboarding) {
    return <FirstDrive onComplete={(n) => { setWelcomeName(n); setOnboarding(false); }} />;
  }

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Status bar ─────────────────────────────────────────────── */}
      <div className="rise" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <AuraOrb size={46} active={os.listening} danger={!!alert} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {(driver?.name ?? welcomeName) ? `Good drive, ${driver?.name ?? welcomeName}` : 'Aura OS'}
            </div>
            <div style={{ ...label, textTransform: 'none', marginTop: 2 }}>
              {driver ? `${driver.playlist} · on-device persona loaded`
                : welcomeName ? 'Profile loaded · Aura is learning your preferences'
                : 'Take your seat — Aura will recognize you'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SafetyPill score={live?.score ?? 0} alert={!!alert} />
          <StatChip icon={<Snowflake size={13} />}>{os.climate.temp}°</StatChip>
          <StatChip icon={<Wifi size={13} style={{ color: 'var(--success)' }} />}>LTE</StatChip>
          <div style={{ textAlign: 'right', paddingLeft: 4 }}>
            <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1 }}>{clock}</div>
            <div style={{ ...label, textTransform: 'none' }}>{date}</div>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
        {os.activeApp && activeMeta ? (
          <div className="rise">
            <button onClick={os.closeApp} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13, marginBottom: 16 }}>
              <ChevronLeft size={16} /> Home
            </button>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px' }}>{activeMeta.name}</h2>
            {renderApp(os.activeApp)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18 }}>
            <div style={{ gridColumn: 'span 2' }}><MediaCard /></div>
            <NavCard />
            <ClimateCard />
            <div style={{ gridColumn: 'span 2' }}><SafetyStrip /></div>
            <div style={{ gridColumn: 'span 2' }}><AppDock /></div>
          </div>
        )}
      </div>

      {/* ── Ask Aura ───────────────────────────────────────────────── */}
      <AskAura />

      {/* ── Notification toasts ────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', flexDirection: 'column', gap: 8, width: 300, pointerEvents: 'none' }}>
        {os.notifications.slice(0, 4).map((n) => (
          <div key={n.id} className="rise" style={{ ...glassStrong, padding: '11px 13px', pointerEvents: 'auto', borderLeft: `3px solid ${n.kind === 'danger' ? 'var(--danger)' : n.kind === 'warning' ? 'var(--warning)' : 'var(--accent)'}`, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{n.detail}</div>
            </div>
            <button onClick={() => os.dismissNotification(n.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={14} /></button>
          </div>
        ))}
      </div>

      {alert && <AlertOverlay reason={alert.reason} />}
    </div>
  );
}

function StatChip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span style={{ ...glass, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
      {icon} {children}
    </span>
  );
}

function SafetyPill({ score, alert }: { score: number; alert: boolean }) {
  const color = alert ? 'var(--danger)' : score >= 45 ? 'var(--warning)' : score >= 20 ? 'var(--accent)' : 'var(--success)';
  const text = alert ? 'DROWSY' : score >= 45 ? 'ELEVATED' : score >= 20 ? 'MILD' : 'ALERT · OK';
  return <Chip color={color}><ShieldCheck size={13} /> {text}</Chip>;
}

/* ── Media hero ──────────────────────────────────────────────────── */
const ART_GRADIENTS = [
  'linear-gradient(135deg,#e8c99c,#b8894e)',
  'linear-gradient(135deg,#d9a066,#8a5a2b)',
  'linear-gradient(135deg,#e0b0a0,#a0603f)',
  'linear-gradient(135deg,#cbb58a,#7d6a3f)',
];
function MediaCard() {
  const os = useOS();
  const { driver } = useAura();
  const track = TRACKS[os.music.trackIndex];
  const art = ART_GRADIENTS[os.music.trackIndex % ART_GRADIENTS.length];
  const ctrl: CSSProperties = { width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  return (
    <div style={{ ...glass, padding: 26, display: 'flex', gap: 26, alignItems: 'center' }}>
      <div style={{ width: 112, height: 112, borderRadius: 20, background: art, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--elev-2)' }}>
        <MusicIcon size={44} color="#fff" style={{ opacity: 0.9 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...label, color: 'var(--accent)' }}>{driver ? `${driver.playlist}` : 'Now Playing'}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '3px 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{track.artist}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
          <button style={ctrl} onClick={os.prevTrack}><SkipBack size={18} /></button>
          <button style={{ ...ctrl, width: 52, height: 52, background: 'var(--accent-grad)', border: 'none', color: '#fff', boxShadow: 'var(--glow)' }} onClick={() => os.setMusicPlaying(!os.music.playing)}>
            {os.music.playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button style={ctrl} onClick={os.nextTrack}><SkipForward size={18} /></button>
        </div>
      </div>
    </div>
  );
}

/* ── Navigation ──────────────────────────────────────────────────── */
function NavCard() {
  const os = useOS();
  const dest = DESTINATIONS.find((d) => d.id === os.nav.destination);
  return (
    <button onClick={() => os.openApp('navigation')} style={{ ...glass, padding: 0, cursor: 'pointer', textAlign: 'left', overflow: 'hidden', position: 'relative', minHeight: 172 }}>
      <img
        src={dest
          ? `${CORE_HTTP}/maps/static?destination=${encodeURIComponent(PLACE_QUERIES[dest.id] || dest.name)}&size=440x172`
          : `${CORE_HTTP}/maps/static?center=${encodeURIComponent('MG Road, Bengaluru')}&size=440x172`}
        alt="map"
        style={{ width: '100%', height: 172, objectFit: 'cover', display: 'block' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(16,14,11,0.5) 0%, transparent 32%, transparent 58%, rgba(16,14,11,0.78) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 12, left: 14, ...label }}><NavIcon size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Navigation</div>
      <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 700 }}>
          <MapPin size={15} style={{ color: dest ? 'var(--success)' : 'var(--text-tertiary)' }} /> {dest ? dest.name : 'Set route'}
        </div>
        {dest && <span style={{ ...label, textTransform: 'none' }}>{dest.eta} · {dest.dist}</span>}
      </div>
    </button>
  );
}

/* ── Climate ─────────────────────────────────────────────────────── */
function ClimateCard() {
  const os = useOS();
  return (
    <button onClick={() => os.openApp('climate')} style={{ ...glass, padding: 18, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 172 }}>
      <div style={{ ...label }}><Thermometer size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--warning)' }} /> Climate</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 52, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1 }}>{os.climate.temp}</span>
        <span style={{ fontSize: 20, color: 'var(--text-tertiary)' }}>°C</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Chip color={os.climate.ac ? 'var(--accent)' : 'var(--text-tertiary)'}><Snowflake size={12} /> A/C {os.climate.ac ? 'ON' : 'OFF'}</Chip>
        <span style={{ ...label, textTransform: 'none' }}>Fan {os.climate.fan}</span>
      </div>
    </button>
  );
}

/* ── Driver safety strip (live) ──────────────────────────────────── */
function SafetyStrip() {
  const { live, alert } = useAura();
  const score = Math.round(live?.score ?? 0);
  const color = alert ? 'var(--danger)' : score >= 45 ? 'var(--warning)' : score >= 20 ? 'var(--accent)' : 'var(--success)';
  const r = 34, C = 2 * Math.PI * r;
  const off = C * (1 - Math.min(100, score) / 100);
  return (
    <div style={{ ...glass, padding: 18, display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
        <svg width="84" height="84" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="42" cy="42" r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth="7" />
          <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 0.4s, stroke 0.4s' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', color }}>{score}</span>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ ...label }}>Driver Safety · live</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0 4px' }}>
          {alert ? 'Aura is intervening' : score >= 45 ? 'Elevated fatigue' : score >= 20 ? 'Mild fatigue' : 'Alert & focused'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Monitored on-device against {live?.driver ?? 'your'} personal baseline{live?.baseline ? ` · eyes ${live.baseline}s` : ''}.
        </div>
      </div>
    </div>
  );
}

/* ── App dock ────────────────────────────────────────────────────── */
function AppDock() {
  const os = useOS();
  return (
    <div style={{ ...glass, padding: 14, display: 'flex', gap: 10, justifyContent: 'space-around' }}>
      {APP_META.map((a) => {
        const Icon = a.icon;
        return (
          <button key={a.id} onClick={() => os.openApp(a.id)} title={a.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px 10px' }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, background: `${a.accent}1f`, border: `1px solid ${a.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={24} style={{ color: a.accent }} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{a.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Ask Aura (voice) ────────────────────────────────────────────── */
function AskAura() {
  const os = useOS();
  const [text, setText] = useState('');
  const submit = () => { if (text.trim()) { os.runCommand(text); setText(''); } };
  return (
    <div style={{ ...glassStrong, padding: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
      <button
        onClick={() => (os.listening ? os.stopVoice() : os.startVoice())}
        disabled={!os.voiceSupported}
        title={os.voiceSupported ? 'Hands-free voice' : 'Voice not supported in this browser'}
        style={{ width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: os.voiceSupported ? 'pointer' : 'not-allowed', flexShrink: 0, color: '#fff', background: os.listening ? 'var(--danger)' : 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: os.listening ? 'none' : 'var(--glow)', animation: os.listening ? 'pulse 1.2s infinite' : 'none' }}
      >
        {os.listening ? <Mic size={20} /> : <MicOff size={20} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        {os.listening || os.transcript ? (
          <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{os.transcript || 'Listening…'}</div>
        ) : (
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={'Ask Aura — “open music”, “navigate to office”, “I’m awake”'}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14 }}
          />
        )}
        {os.voiceFeedback && <div style={{ ...label, textTransform: 'none', marginTop: 2 }}>↳ {os.voiceFeedback}</div>}
      </div>
      {!os.listening && (
        <button onClick={submit} style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={17} /></button>
      )}
    </div>
  );
}

/* ── Drowsiness takeover overlay ─────────────────────────────────── */
function AlertOverlay({ reason }: { reason: string }) {
  const wake = () => { fetch(`${CORE_HTTP}/emit/resume`, { method: 'POST' }).catch(() => {}); };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'radial-gradient(circle at 50% 40%, rgba(160,20,40,0.6), rgba(90,0,15,0.7))', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, border: '12px solid var(--danger)', animation: 'pulse 0.9s infinite', pointerEvents: 'none' }} />
      <div style={{ textAlign: 'center', color: '#fff', maxWidth: 580, padding: 24 }}>
        <AuraOrb size={92} active danger />
        <div style={{ fontSize: 60, fontWeight: 900, letterSpacing: 6, marginTop: 20 }}>WAKE UP</div>
        <p style={{ fontSize: 18, opacity: 0.92, margin: '8px 0 4px' }}>{reason}</p>
        <p style={{ fontSize: 14, opacity: 0.82 }}>Aura is pulling the vehicle over safely.</p>
        <button onClick={wake} style={{ marginTop: 24, padding: '15px 34px', fontSize: 16, fontWeight: 800, borderRadius: 14, border: '2px solid #fff', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>
          I&rsquo;M AWAKE
        </button>
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>or say “I’m awake”</p>
      </div>
    </div>
  );
}
