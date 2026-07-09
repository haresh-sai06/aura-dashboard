import { useCallback, useEffect, useState } from 'react';
import { User, Check } from 'lucide-react';
import { CORE_HTTP } from '../config';

const CORE = CORE_HTTP;

type PersonaLite = {
  id: string;
  name: string;
  threshold: number;
  baseThreshold?: number;
  accent: string;
  note?: string;
  modality?: string;
  playlist?: string;
};

/**
 * Live driver-persona switcher backed by Aura Core (`/drivers` + `/driver/select`).
 * Switching a driver re-personalizes the whole system — the alert threshold, playlist,
 * and modality all change at once, which is the demo's differentiator in one click.
 * Polls so adaptive-threshold changes (learned live) show up without a refresh.
 */
export default function DriverSelector({ compact = false }: { compact?: boolean }) {
  const [drivers, setDrivers] = useState<PersonaLite[]>([]);
  const [current, setCurrent] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${CORE}/drivers`);
      const j = await r.json();
      setDrivers(Array.isArray(j.drivers) ? j.drivers : []);
      setCurrent(j.current ?? '');
    } catch {
      /* Aura Core offline — leave empty */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const select = useCallback(
    async (id: string) => {
      setCurrent(id); // optimistic
      try {
        await fetch(`${CORE}/driver/select?id=${encodeURIComponent(id)}`, { method: 'POST' });
      } catch {
        /* ignore */
      }
      load();
    },
    [load]
  );

  if (drivers.length === 0) {
    return compact ? null : (
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        Driver personas appear when Aura Core is online.
      </div>
    );
  }

  if (compact) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {drivers.map((d) => {
          const active = d.id === current;
          return (
            <button
              key={d.id}
              onClick={() => select(d.id)}
              title={d.note}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999,
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: active ? `color-mix(in srgb, ${d.accent} 18%, transparent)` : 'var(--bg-tertiary)',
                color: active ? d.accent : 'var(--text-secondary)',
                border: `1px solid ${active ? d.accent : 'transparent'}`,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.accent }} />
              {d.name}
              <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.75 }}>{Math.round(d.threshold)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {drivers.map((d) => {
        const active = d.id === current;
        const tuned = d.baseThreshold != null && Math.round(d.baseThreshold) !== Math.round(d.threshold);
        return (
          <button
            key={d.id}
            onClick={() => select(d.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 14,
              cursor: 'pointer', textAlign: 'left', width: '100%',
              background: active ? `color-mix(in srgb, ${d.accent} 12%, transparent)` : 'var(--bg-tertiary)',
              border: `1px solid ${active ? d.accent : 'var(--border)'}`,
            }}
          >
            <span style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: `color-mix(in srgb, ${d.accent} 22%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={18} style={{ color: d.accent }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.name}</span>
                {active && <Check size={14} style={{ color: d.accent }} />}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{d.note}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: d.accent }}>{Math.round(d.threshold)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {tuned ? `tuned · ${d.modality}` : `alert · ${d.modality}`}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
