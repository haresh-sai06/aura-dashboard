import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Sparkles } from 'lucide-react';
import { SURFACE } from '../config';
import { glass } from '../ui';

/**
 * "Aura just learned…" — a live toast on the head unit (System A) that pops the instant a
 * conversation turn captures a new durable fact about the driver, making the "it's learning
 * right now" moment obvious to anyone watching.
 *
 * Event-driven (deterministic + real-time): BuddyChat dispatches a window `aura:learned`
 * CustomEvent whenever Core returns new facts, and this component renders them. No polling,
 * so there's no prime/timing fragility.
 */

type LearnedFact = { text: string; category?: string };
type Toast = { id: number; name: string; text: string; category: string };

const CAT_ACCENT: Record<string, string> = {
  music: '#cfa46a', destination: '#7cc292', climate: '#e3a85c',
  mood: '#bf9fd8', driving: '#e0685f', food: '#d9a066', general: '#a99e8c',
};

export default function LearnedToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    if (SURFACE !== 'a') return; // head unit only — the Driver DNA screen already lives on System B

    const onLearned = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const name = String(detail.name || 'Driver');
      const facts: LearnedFact[] = Array.isArray(detail.facts) ? detail.facts : [];
      const fresh: Toast[] = facts
        .filter((f) => f && f.text)
        .map((f) => ({ id: nextId.current++, name, text: String(f.text), category: String(f.category || 'general').toLowerCase() }));
      if (!fresh.length) return;
      setToasts((t) => [...t, ...fresh].slice(-4));
      fresh.forEach((ft) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== ft.id)), 5600));
    };

    window.addEventListener('aura:learned', onLearned as EventListener);
    return () => window.removeEventListener('aura:learned', onLearned as EventListener);
  }, []);

  if (SURFACE !== 'a' || toasts.length === 0) return null;

  const wrap: CSSProperties = {
    position: 'fixed', top: 20, right: 20, zIndex: 9999,
    display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none',
  };

  return (
    <div style={wrap}>
      {toasts.map((t) => {
        const accent = CAT_ACCENT[t.category] ?? CAT_ACCENT.general;
        return (
          <div key={t.id} className="rise" style={{ ...glass, display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', minWidth: 300, maxWidth: 380, boxShadow: 'var(--elev-2, 0 10px 30px rgba(0,0,0,0.35))', borderLeft: `3px solid ${accent}` }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, background: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={19} style={{ color: accent }} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: accent }}>Aura just learned</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4, marginTop: 3 }}>&ldquo;{t.text}&rdquo;</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, textTransform: 'capitalize' }}>{t.category} &middot; {t.name}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
