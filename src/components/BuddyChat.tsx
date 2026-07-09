import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Mic, Send, Sparkles, ArrowRight } from 'lucide-react';
import { AuraOrb, glass, glassStrong, label, Chip } from '../ui';
import { speak } from '../utils/voice';
import { CORE_HTTP } from '../config';

type Msg = { role: 'user' | 'aura'; text: string; pending?: boolean };
type Fact = { text: string; category: string };

const SUGGESTIONS = ['I’m good, thanks!', 'A bit tired today', 'Head to the office', 'Something calm, please'];

/**
 * Act 4 of First Drive — Aura chats like a buddy and quietly learns the driver. Each turn hits
 * Core's /conversation (reply + extracted preferences); learned facts surface live and are
 * stored per-driver for the Safety Monitor's "Driver DNA" screen.
 */
export default function BuddyChat({ driverId, name, onDone }:
  { driverId: string; name: string; onDone: () => void }) {
  const opener = `Great to have you aboard, ${name}. How are you feeling today?`;
  const [messages, setMessages] = useState<Msg[]>([{ role: 'aura', text: opener }]);
  const [learned, setLearned] = useState<Fact[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  useEffect(() => { if (!opened.current) { opened.current = true; speak(opener, { rate: 0.98 }); } }, [opener]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput('');
    setBusy(true);
    const history = messages.map((m) => ({ role: m.role === 'aura' ? 'assistant' : 'user', content: m.text }));
    setMessages((m) => [...m, { role: 'user', text: msg }, { role: 'aura', text: '', pending: true }]);
    try {
      const r = await fetch(`${CORE_HTTP}/conversation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, name, message: msg, history }),
      });
      const data = await r.json();
      const reply = data.reply || 'I’m with you.';
      setMessages((m) => { const n = [...m]; n[n.length - 1] = { role: 'aura', text: reply }; return n; });
      speak(reply, { rate: 0.98 });
      if (Array.isArray(data.facts) && data.facts.length) setLearned((f) => [...f, ...data.facts]);
    } catch {
      setMessages((m) => { const n = [...m]; n[n.length - 1] = { role: 'aura', text: 'Aura Core is offline right now.' }; return n; });
    } finally {
      setBusy(false);
    }
  };

  const listen = () => {
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown });
    const Ctor = (SR.SpeechRecognition || SR.webkitSpeechRecognition) as (new () => {
      lang: string; interimResults: boolean; start: () => void;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onend: (() => void) | null; onerror: (() => void) | null;
    }) | undefined;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'en-US'; rec.interimResults = false;
    setListening(true);
    rec.onresult = (e) => { const t = e.results[0]?.[0]?.transcript ?? ''; if (t) send(t); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    try { rec.start(); } catch { setListening(false); }
  };

  const wrap: CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column',
    background: 'radial-gradient(900px 620px at 50% 12%, rgba(207,164,106,0.12), transparent 60%), var(--bg-primary)',
    padding: '22px 24px', gap: 16,
  };

  return (
    <div style={wrap}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <AuraOrb size={44} active={busy || listening} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Aura</div>
            <div style={{ ...label, textTransform: 'none' }}>Getting to know you, {name}</div>
          </div>
        </div>
        <button onClick={onDone} style={{ ...glass, padding: '10px 18px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          Continue to Aura OS <ArrowRight size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Conversation */}
        <div style={{ ...glass, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 18 }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 6 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                <div style={{ padding: '11px 15px', borderRadius: 14, fontSize: 14, lineHeight: 1.55, color: m.role === 'user' ? '#fff' : 'var(--text-primary)', background: m.role === 'user' ? 'var(--accent-grad)' : 'var(--bg-tertiary)' }}>
                  {m.pending ? <TypingDots /> : m.text}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Talk to Aura…`}
              style={{ flex: 1, ...glassStrong, padding: '13px 16px', fontSize: 14, color: 'var(--text-primary)', outline: 'none' }} />
            <button type="button" onClick={listen} title="Speak"
              style={{ width: 48, height: 48, borderRadius: 12, border: 'none', cursor: 'pointer', color: '#fff', background: listening ? 'var(--danger)' : 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: listening ? 'pulse 1.1s infinite' : 'none' }}>
              <Mic size={19} />
            </button>
            <button type="submit" disabled={busy || !input.trim()} style={{ width: 48, height: 48, borderRadius: 12, border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'var(--text-primary)', cursor: 'pointer', opacity: busy || !input.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Send size={17} />
            </button>
          </form>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} disabled={busy} style={{ ...glass, padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>{s}</button>
            ))}
          </div>
        </div>

        {/* Live "Aura is learning" panel */}
        <div style={{ ...glass, width: 264, flexShrink: 0, padding: 18, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={15} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>AURA IS LEARNING</span>
          </div>
          {learned.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              As you chat, Aura builds your Driver DNA — your preferences, saved on-device.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              {learned.map((f, i) => (
                <div key={i} className="rise" style={{ ...glassStrong, padding: '9px 12px' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{f.text}</div>
                  <div style={{ marginTop: 4 }}><Chip color="var(--accent)">{f.category}</Chip></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, height: 16, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-tertiary)', animation: `pulse 1s ${i * 0.15}s infinite` }} />)}
    </span>
  );
}
