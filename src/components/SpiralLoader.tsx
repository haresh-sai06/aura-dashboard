import { useEffect, useMemo, useRef, useState } from 'react';
import { AuraOrb } from '../ui';

/**
 * Luxury boot sequence — a slowly-rotating champagne-gold spiral that resolves into the
 * personalized Aura OS. Shown when the head unit "wakes up" for a driver (see FirstDrive).
 * Self-contained: cycles elegant boot phrases, then calls onDone.
 */
function spiralPath(cx: number, cy: number, turns: number, a: number, b: number, pts = 260): string {
  let d = '';
  for (let i = 0; i <= pts; i++) {
    const t = (i / pts) * turns * 2 * Math.PI;
    const r = a + b * t;
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  }
  return d;
}

export default function SpiralLoader({
  name,
  durationMs = 4200,
  onDone,
}: {
  name?: string;
  durationMs?: number;
  onDone?: () => void;
}) {
  const phases = useMemo(
    () => [
      'Waking up',
      name ? `Loading ${name}'s profile` : 'Loading your profile',
      'Personalizing the cabin',
      'Calibrating safety baseline',
      'Ready',
    ],
    [name],
  );
  const [phase, setPhase] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const step = durationMs / phases.length;
    const timers = phases.map((_, i) => window.setTimeout(() => setPhase(i), step * i));
    const leave = window.setTimeout(() => setLeaving(true), durationMs - 500);
    const done = window.setTimeout(() => doneRef.current?.(), durationMs);
    return () => { timers.forEach(clearTimeout); clearTimeout(leave); clearTimeout(done); };
  }, [durationMs, phases]);

  const outer = spiralPath(150, 150, 3.4, 6, 6.4);
  const inner = spiralPath(150, 150, 3.0, 3, 5.6);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background:
          'radial-gradient(900px 620px at 50% 42%, rgba(207,164,106,0.14), transparent 60%), var(--bg-primary)',
        opacity: leaving ? 0 : 1,
        transition: 'opacity 0.5s ease',
      }}
    >
      <div style={{ position: 'relative', width: 300, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="300" height="300" viewBox="0 0 300 300" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <linearGradient id="goldSpiral" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f0dcc0" />
              <stop offset="55%" stopColor="#cfa46a" />
              <stop offset="100%" stopColor="#8a5a2b" stopOpacity="0.15" />
            </linearGradient>
          </defs>
          <g style={{ transformOrigin: '150px 150px', animation: 'orbSpin 14s linear infinite' }}>
            <path d={outer} fill="none" stroke="url(#goldSpiral)" strokeWidth="1.6" strokeLinecap="round" />
          </g>
          <g style={{ transformOrigin: '150px 150px', animation: 'orbSpin 9s linear infinite reverse' }}>
            <path d={inner} fill="none" stroke="url(#goldSpiral)" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
          </g>
        </svg>
        <AuraOrb size={64} active />
      </div>

      <div style={{ marginTop: 34, textAlign: 'center', minHeight: 56 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.34em', textTransform: 'uppercase', color: 'var(--accent)' }}>AURA</div>
        <div key={phase} className="rise" style={{ marginTop: 10, fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
          {phases[phase]}
          <span style={{ animation: 'pulse 1.2s infinite' }}>…</span>
        </div>
      </div>
    </div>
  );
}
