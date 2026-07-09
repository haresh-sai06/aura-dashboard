import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Mic, Play, ChevronRight } from 'lucide-react';
import { AuraOrb, glass } from '../ui';
import { speak } from '../utils/voice';
import { CORE_HTTP } from '../config';
import SpiralLoader from './SpiralLoader';
import BuddyChat from './BuddyChat';

/**
 * "First Drive" — the welcome ceremony on the head unit (System A).
 *   name     → Aura meets a new driver and asks their name (voice or type)
 *   booting  → the luxury spiral loader personalizes the cabin
 *   greeting → Aura welcomes them and asks to start the engine
 *   igniting → ignition flourish (Unity car start is stubbed for now)
 * onComplete(name) hands control to the normal Aura OS (and, next, the buddy conversation).
 */
type Stage = 'name' | 'booting' | 'greeting' | 'igniting' | 'chatting';

function cleanName(raw: string): string {
  let s = raw.trim().replace(/^(my name is|i am|i'm|it's|call me|this is)\s+/i, '');
  s = s.replace(/[.!,?]/g, '').trim().split(/\s+/)[0] || raw.trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : raw.trim();
}

export default function FirstDrive({ onComplete }: { onComplete: (name: string) => void }) {
  const [stage, setStage] = useState<Stage>('name');
  const [name, setName] = useState('');
  const [driverId, setDriverId] = useState('');
  const [typed, setTyped] = useState('');
  const [listening, setListening] = useState(false);
  const spokeName = useRef(false);
  const spokeGreet = useRef(false);

  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Aura asks for the name once, on entry.
  useEffect(() => {
    if (stage === 'name' && !spokeName.current) {
      spokeName.current = true;
      speak("Hello — I don't think we've met. What should I call you?", { rate: 0.98 });
    }
    if (stage === 'greeting' && !spokeGreet.current) {
      spokeGreet.current = true;
      speak(`Welcome aboard, ${name}. Shall I start the engine?`, { rate: 0.98 });
    }
  }, [stage, name]);

  const confirmName = (n: string) => {
    const clean = cleanName(n);
    if (!clean) return;
    setName(clean);
    setStage('booting');
    // Register the driver in Core so their Driver DNA profile exists for the conversation.
    fetch(`${CORE_HTTP}/driver/name`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: clean }),
    }).then((r) => r.json()).then((d) => setDriverId(d?.id || '')).catch(() => {});
  };

  const listenForName = () => {
    if (!speechSupported) return;
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown });
    const Ctor = (SR.SpeechRecognition || SR.webkitSpeechRecognition) as
      | (new () => {
          lang: string; interimResults: boolean; maxAlternatives: number;
          start: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
          onend: (() => void) | null; onerror: (() => void) | null;
        })
      | undefined;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (e) => { const t = e.results[0]?.[0]?.transcript ?? ''; if (t) confirmName(t); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    try { rec.start(); } catch { setListening(false); }
  };

  const startEngine = () => {
    setStage('igniting');
    speak(`Starting the engine. Let's drive.`, { rate: 0.98 });
    window.setTimeout(() => setStage('chatting'), 2200);
  };

  if (stage === 'booting') {
    return <SpiralLoader name={name} onDone={() => setStage('greeting')} />;
  }

  if (stage === 'chatting') {
    return <BuddyChat driverId={driverId} name={name} onDone={() => onComplete(name)} />;
  }

  const wrap: CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 2000,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26,
    background: 'radial-gradient(900px 620px at 50% 40%, rgba(207,164,106,0.13), transparent 60%), var(--bg-primary)',
    padding: 24, textAlign: 'center',
  };

  return (
    <div style={wrap}>
      <AuraOrb size={96} active={stage !== 'igniting'} />

      {stage === 'name' && (
        <>
          <div className="rise" style={{ maxWidth: 460 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.3em', color: 'var(--accent)', textTransform: 'uppercase' }}>Aura</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 10, lineHeight: 1.35 }}>
              I don't think we've met.<br />What should I call you?
            </div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); confirmName(typed); }} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Say or type your name"
              style={{ ...glass, padding: '14px 18px', fontSize: 16, color: 'var(--text-primary)', outline: 'none', width: 260 }}
            />
            {speechSupported && (
              <button type="button" onClick={listenForName} title="Say your name"
                style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer', color: '#fff', background: listening ? 'var(--danger)' : 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--glow)', animation: listening ? 'pulse 1.1s infinite' : 'none' }}>
                <Mic size={22} />
              </button>
            )}
            <button type="submit" disabled={!typed.trim()} style={{ ...ctaStyle, opacity: typed.trim() ? 1 : 0.5 }}>
              <ChevronRight size={20} />
            </button>
          </form>
          {listening && <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Listening…</div>}
        </>
      )}

      {stage === 'greeting' && (
        <>
          <div className="rise" style={{ maxWidth: 480 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.3em', color: 'var(--accent)', textTransform: 'uppercase' }}>Welcome aboard</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>{name}</div>
            <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 12 }}>Shall I start the engine?</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={startEngine} style={{ ...ctaStyle, width: 'auto', padding: '14px 28px', gap: 10, fontSize: 15, fontWeight: 700 }}>
              <Play size={18} /> Start the engine
            </button>
            <button onClick={() => onComplete(name)} style={{ ...glass, padding: '14px 22px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>
              Not yet
            </button>
          </div>
        </>
      )}

      {stage === 'igniting' && (
        <div className="rise" style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.3em', color: 'var(--accent)', textTransform: 'uppercase' }}>Ignition</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>Engine started</div>
          <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 10 }}>Let's drive, {name}.</div>
        </div>
      )}
    </div>
  );
}

const ctaStyle: CSSProperties = {
  width: 52, height: 52, borderRadius: 14, border: 'none', cursor: 'pointer', color: '#fff',
  background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: 'var(--glow)', fontWeight: 700,
};
