import type { CSSProperties, ReactNode } from 'react';

// Shared visual language for Aura OS — warm solid surfaces, chips, and the assistant emblem.
// Import these everywhere so the head unit reads as one designed system.
// (`glass`/`glassStrong` keep their names for compatibility but are now solid warm
//  surfaces with a brushed top-highlight and soft shadow — depth without any blur.)

export const glass: CSSProperties = {
  backgroundColor: 'var(--glass)',
  backgroundImage: 'var(--highlight)',
  border: '1px solid var(--glass-border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--elev-1)',
};

export const glassStrong: CSSProperties = {
  ...glass,
  backgroundColor: 'var(--glass-strong)',
  boxShadow: 'var(--elev-2)',
};

// Aliases with clearer names for new code.
export const surface = glass;
export const surfaceRaised = glassStrong;

export const label: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

export const mono: CSSProperties = { fontFamily: 'var(--font-mono)' };

export function Chip({ children, color = 'var(--text-secondary)', tone = 'ghost' }:
  { children: ReactNode; color?: string; tone?: 'ghost' | 'solid' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      color: tone === 'solid' ? '#fff' : color,
      background: tone === 'solid' ? color : `color-mix(in srgb, ${color} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
    }}>
      {children}
    </span>
  );
}

/**
 * The Aura assistant presence — a breathing gradient orb with an orbiting ring.
 * `active` speeds up the breathing (listening/speaking); `danger` turns it red.
 */
export function AuraOrb({ size = 64, active = false, danger = false }:
  { size?: number; active?: boolean; danger?: boolean }) {
  const core = danger
    ? 'radial-gradient(circle at 32% 30%, #f6c2b0, #d9534a 55%, #9c3a34)'
    : 'radial-gradient(circle at 32% 30%, #f4e2c4, #cfa46a 52%, #a87a42)';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%', background: core,
        animation: `orbBreathe ${active ? 1.5 : 3.6}s ease-in-out infinite`,
      }} />
      <div style={{
        position: 'absolute', inset: -Math.round(size * 0.09), borderRadius: '50%',
        border: '1.5px solid rgba(232,201,156,0.16)',
        borderTopColor: 'rgba(244,226,196,0.55)',
        animation: `orbSpin ${active ? 3 : 9}s linear infinite`,
      }} />
    </div>
  );
}
