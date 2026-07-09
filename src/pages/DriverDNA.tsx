import { useEffect, useMemo, useState } from 'react';
import { Fingerprint, Music, MapPin, Thermometer, Smile, Car, Utensils, Tag, ShieldCheck } from 'lucide-react';
import { AuraOrb, glass, glassStrong, label } from '../ui';
import { CORE_HTTP } from '../config';

type Fact = { text: string; category: string; ts?: string };
type Profile = { id: string; name: string; facts: Fact[] };

const CAT: Record<string, { icon: typeof Music; color: string }> = {
  music: { icon: Music, color: '#cfa46a' },
  destination: { icon: MapPin, color: '#7cc292' },
  climate: { icon: Thermometer, color: '#e3a85c' },
  mood: { icon: Smile, color: '#bf9fd8' },
  driving: { icon: Car, color: '#e0685f' },
  food: { icon: Utensils, color: '#d9a066' },
  general: { icon: Tag, color: '#a99e8c' },
};

/**
 * Driver DNA — the living profile Aura builds through conversation, shown on the Safety
 * Monitor (System B). Polls Core's /driver/knowledge and surfaces the most-recently-active
 * driver, whose preferences grow in real time as they chat on the head unit.
 */
export default function DriverDNA() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${CORE_HTTP}/driver/knowledge`);
        const j = await r.json();
        if (alive && Array.isArray(j.profiles)) setProfiles(j.profiles);
      } catch { /* Core offline */ }
    };
    load();
    const t = setInterval(load, 2000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const lastTs = (p: Profile) => p.facts.reduce((mx, f) => (f.ts && f.ts > mx ? f.ts : mx), '');
  const active = useMemo(() => {
    if (!profiles.length) return null;
    const ordered = [...profiles].sort((a, b) => lastTs(b).localeCompare(lastTs(a)));
    return ordered.find((p) => p.id === selected) ?? ordered[0];
  }, [profiles, selected]);

  const grouped = useMemo(() => {
    const g: Record<string, Fact[]> = {};
    (active?.facts ?? []).forEach((f) => { (g[f.category] ??= []).push(f); });
    return g;
  }, [active]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Fingerprint size={22} style={{ color: 'var(--accent)' }} /> Driver DNA
          </h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4 }}>
            The profile Aura learns through conversation — stored on-device, never in the cloud
          </p>
        </div>
        {profiles.length > 1 && (
          <div style={{ display: 'flex', gap: 8 }}>
            {profiles.map((p) => (
              <button key={p.id} onClick={() => setSelected(p.id)} style={{ ...glass, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: active?.id === p.id ? 'var(--accent)' : 'var(--text-secondary)', border: `1px solid ${active?.id === p.id ? 'var(--accent)' : 'var(--glass-border)'}` }}>{p.name}</button>
            ))}
          </div>
        )}
      </div>

      {!active ? (
        <div style={{ ...glass, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--text-tertiary)' }}>
          <AuraOrb size={64} />
          <div style={{ fontSize: 15, textAlign: 'center', maxWidth: 380, lineHeight: 1.6 }}>
            No driver profile yet. Start a <strong style={{ color: 'var(--accent)' }}>First Drive</strong> on the head unit — as the driver chats, their DNA appears here live.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 18, flex: 1, minHeight: 0 }}>
          {/* Identity */}
          <div style={{ ...glassStrong, width: 280, flexShrink: 0, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
            <AuraOrb size={92} active />
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{active.name}</div>
              <div style={{ ...label, textTransform: 'none', marginTop: 4 }}>{active.facts.length} things learned</div>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--success)' }}>
              <ShieldCheck size={14} /> On-device · private
            </div>
          </div>

          {/* Preferences grouped by category */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, alignContent: 'start' }}>
            {active.facts.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Listening… preferences will appear as {active.name} talks with Aura.</div>
            ) : (
              Object.entries(grouped).map(([cat, facts]) => {
                const meta = CAT[cat] ?? CAT.general;
                const Icon = meta.icon;
                return (
                  <div key={cat} className="rise" style={{ ...glass, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ width: 30, height: 30, borderRadius: 9, background: `${meta.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={16} style={{ color: meta.color }} />
                      </span>
                      <span style={{ ...label, color: meta.color }}>{cat}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {facts.map((f, i) => (
                        <div key={i} style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.45 }}>• {f.text}</div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
