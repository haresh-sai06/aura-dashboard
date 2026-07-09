import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Bot, Send, Cpu, BookOpen, User, Sparkles } from 'lucide-react';
import { useAura } from '../AuraContext';
import { CORE_HTTP } from '../config';

const CORE = CORE_HTTP;

const card: CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10 };
const label: CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' };

type Msg = { role: 'user' | 'aura'; text: string; sources?: string[]; pending?: boolean };

type LlmStatus = { ollama: boolean; chatModel: string; embedModel: string; kbChunks: number } | null;

const SUGGESTIONS = [
  'Why did the car take over?',
  'What does AutoCare Level 3 mean?',
  'How is my drowsiness threshold different from a generic system?',
  'What should I do during a takeover?',
  'Does my data leave the car?',
];

export default function Copilot() {
  const { driver, live, telemetry } = useAura();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<LlmStatus>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${CORE}/llm/status`).then((r) => r.json()).then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const ask = async (q: string) => {
    const query = q.trim();
    if (!query || busy) return;
    setInput('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text: query }, { role: 'aura', text: '', pending: true }]);
    try {
      const res = await fetch(`${CORE}/copilot/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          context: {
            score: live?.score,
            speedKmh: telemetry?.speedKmh,
            scenario: telemetry?.scenario,
          },
        }),
      });
      const data = await res.json();
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = {
          role: 'aura',
          text: data.answer ?? 'No response.',
          sources: data.sources ?? [],
        };
        return next;
      });
    } catch {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: 'aura', text: 'Aura Core is offline — start the edge brain to ask questions.', sources: [] };
        return next;
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={22} style={{ color: 'var(--accent)' }} /> Aura Copilot
          </h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4 }}>
            Agentic RAG assistant — grounded in your owner's manual & safety policy, running on-device
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: status?.ollama ? 'rgba(34,197,94,0.1)' : 'var(--bg-tertiary)', color: status?.ollama ? 'var(--success)' : 'var(--text-tertiary)' }}>
            <Cpu size={12} /> {status?.ollama ? `On-device · ${status.chatModel}` : 'LLM offline'}
          </span>
          {status?.kbChunks ? (
            <span style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
              <BookOpen size={12} /> {status.kbChunks} KB chunks
            </span>
          ) : null}
        </div>
      </div>

      {/* Chat surface */}
      <div ref={scrollRef} style={{ ...card, flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 460, color: 'var(--text-tertiary)' }}>
            <Sparkles size={30} style={{ color: 'var(--accent)', marginBottom: 10 }} />
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              Ask Aura about your vehicle, its safety decisions, or what to do next.
              Every answer is grounded in on-device documents and cites its sources — nothing leaves the car.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: '50%', background: m.role === 'user' ? 'var(--bg-tertiary)' : 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {m.role === 'user' ? <User size={15} /> : <Bot size={15} style={{ color: 'var(--accent)' }} />}
            </span>
            <div style={{ maxWidth: '76%', display: 'flex', flexDirection: 'column', gap: 6, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ padding: '10px 14px', borderRadius: 12, background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-tertiary)', color: m.role === 'user' ? '#fff' : 'var(--text-primary)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {m.pending ? <TypingDots /> : m.text}
              </div>
              {m.sources && m.sources.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {m.sources.map((s) => (
                    <span key={s} style={{ ...label, textTransform: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                      <BookOpen size={11} /> {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => ask(s)} disabled={busy} style={{ ...card, padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ display: 'flex', gap: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={driver ? `Ask Aura, ${driver.name}…` : 'Ask Aura anything about your vehicle…'}
          style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}
        />
        <button type="submit" disabled={busy || !input.trim()} style={{ padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', cursor: busy ? 'default' : 'pointer', opacity: busy || !input.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
          <Send size={16} /> Ask
        </button>
      </form>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', height: 18 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-tertiary)', animation: `pulse 1s ${i * 0.15}s infinite` }} />
      ))}
    </span>
  );
}
