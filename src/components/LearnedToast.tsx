import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Sparkles } from 'lucide-react';
import { CORE_HTTP, SURFACE } from '../config';
import { glass } from '../ui';

/**
 * "Aura just learned…" — a live toast on the head unit (System A) that pops each time the
 * conversation captures a new durable fact about the driver, making the "it's learning right
 * now" moment obvious to anyone watching. It simply watches Core's /driver/knowledge for
 * newly-appeared facts (the same source the Driver DNA screen renders), so it fires no matter
 * where the driver talked — voice buddy, chat, anywhere — with zero backend plumbing.
 *
 * On first poll it primes its "seen" set silently (so the existing profile history never
 * spam-toasts), then toasts only facts that appear afterwards.
 */

type Fact = { text: string; category: string; ts?: string };
type Profile = { id: string; name: string; facts: Fact[] };
type Toast = { id: number; name: string; text: string; category: string };

const CAT_ACCENT: Record<string, string> = {
  music: '#cfa46a', destination: '#7cc292', climate: '#e3a85c',
  mood: '#bf9fd8', driving: '#e0685f', food: '#d9a066', general: '#a99e8c',
};

export default function LearnedToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const nextId = useRef(1);

  useEffect(() => {
    if (SURFACE !== 'a') return; // head unit only — the Driver DNA screen already shows System B
    let alive = true;
    const key = (name: string, f: Fact) => `${name}::${(f.text || '').toLowerCase()}`;

    const poll = async () => {
      try {
        const r = await fetch(`${CORE_HTTP}/driver/knowledge`);
        const j = await r.json();
        const profiles: Profile[] = Array.isArray(j.profiles) ? j.profiles : [];
        const fresh: Toast[] = [];
        for (const p of profiles) {
          for (const f of p.facts ?? []) {
            const k = key(p.name, f);
            if (seen.current.has(k)) continue;
            seen.current.add(k);
            if (primed.current) fresh.push({ id: nextId.current++, name: p.name, text: f.text, category: (f.category || 'general').toLowerCase() });
          }
        }
        primed.current = true;
        if (alive && fresh.length) {
          setToasts((t) => [...t, ...fresh].slice(-4));
          fresh.forEach((ft) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== ft.id)), 5400));
        }
      } catch { /* Core offline — stay quiet */ }
    };

    poll();
    const iv = setInterval(poll, 1800);
    return () => { alive = false; clearInterval(iv); };
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
