import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Fingerprint, Music, MapPin, Thermometer, Smile, Car, Utensils, Tag,
  ShieldCheck, Sparkles, Brain, Layers, Radio,
} from 'lucide-react';
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

function relTime(ts?: string): string {
  if (!ts) return '';
  const then = Date.parse(ts);
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

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

  const latest = useMemo(() => {
    if (!active?.facts?.length) return null;
    return [...active.facts].sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))[0];
  }, [active]);

  const catCount = Object.keys(grouped).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Fingerprint size={22} style={{ color: 'var(--accent)' }} /> Driver DNA
          </h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4 }}>
            The profile Aura learns through conversation — stored on-device, never in the cloud
          </p>
        </div>
        {profiles.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {profiles.map((p) => {
              const on = active?.id === p.id;
              return (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  style={{ ...glass, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: on ? 'var(--accent)' : 'var(--text-secondary)', border: `1px solid ${on ? 'var(--accent)' : 'var(--glass-border)'}`, boxShadow: on ? 'var(--glow)' : 'none' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: on ? 'var(--accent)' : 'var(--text-tertiary)' }} />
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!active ? (
        <div style={{ ...glass, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-tertiary)' }}>
          <AuraOrb size={72} />
          <div style={{ fontSize: 15, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
            No driver profile yet. Start a <strong style={{ color: 'var(--accent)' }}>First Drive</strong> on the head unit — as the driver chats, their DNA appears here live.
          </div>
        </div>
      ) : (
        <>
          {/* Identity hero */}
          <div style={{ ...glassStrong, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 22, padding: '20px 24px' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(520px 200px at 12% 0%, rgba(207,164,106,0.14), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', flexShrink: 0 }}><AuraOrb size={68} active /></div>
            <div style={{ position: 'relative', minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{active.name}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Stat icon={Brain}>{active.facts.length} {active.facts.length === 1 ? 'thing' : 'things'} learned</Stat>
                <Stat icon={Layers}>{catCount} {catCount === 1 ? 'category' : 'categories'}</Stat>
                <Stat icon={ShieldCheck} color="var(--success)">On-device · private</Stat>
              </div>
            </div>
            {latest && (
              <div style={{ position: 'relative', flexShrink: 0, maxWidth: 300, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 22, borderLeft: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...label, color: 'var(--accent)' }}>
                  <Sparkles size={13} /> Latest insight
                </div>
                <div style={{ fontSize: 14.5, color: 'var(--text-primary)', lineHeight: 1.45, marginTop: 6 }}>&ldquo;{latest.text}&rdquo;</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, textTransform: 'capitalize' }}>{latest.category}{relTime(latest.ts) ? ` · ${relTime(latest.ts)}` : ''}</div>
              </div>
            )}
          </div>

          {/* Preferences grid */}
          {active.facts.length === 0 ? (
            <div style={{ ...glass, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-tertiary)' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', boxShadow: 'var(--glow)', animation: 'pulse 1.6s infinite' }} />
              <div style={{ fontSize: 14.5 }}>Listening… preferences will appear as {active.name} talks with Aura.</div>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, alignContent: 'start' }}>
              {Object.entries(grouped).map(([cat, facts]) => {
                const meta = CAT[cat] ?? CAT.general;
                const Icon = meta.icon;
                return (
                  <div key={cat} className="rise" style={{ ...glass, position: 'relative', overflow: 'hidden', padding: '16px 18px', minHeight: 148, borderLeft: `3px solid ${meta.color}`, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${meta.color}12, transparent 55%)`, pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, background: `${meta.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={17} style={{ color: meta.color }} />
                      </span>
                      <span style={{ ...label, color: meta.color, flex: 1 }}>{cat}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, background: `${meta.color}1e`, borderRadius: 8, padding: '2px 8px' }}>{facts.length}</span>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {facts.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, marginTop: 7, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.45 }}>{f.text}</div>
                            {relTime(f.ts) && <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1 }}>learned {relTime(f.ts)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Always-listening tile — keeps the grid feeling alive + intentional */}
              <div style={{ minHeight: 148, borderRadius: 16, border: '1px dashed var(--glass-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-tertiary)', textAlign: 'center', padding: 16 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
                  <Radio size={16} /><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: 'var(--glow)', animation: 'pulse 1.6s infinite' }} />
                </span>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, maxWidth: 200 }}>Aura keeps listening — new preferences land here every drive</div>
              </div>
            </div>
          )}

          {/* Privacy footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
            <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
            This profile is built and stored entirely on the vehicle — nothing leaves the car.
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, children, color }: { icon: typeof Music; children: ReactNode; color?: string }) {
  const s: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 10,
    background: 'var(--glass)', border: '1px solid var(--glass-border)', fontSize: 12.5, fontWeight: 600,
    color: color || 'var(--text-secondary)',
  };
  return <span style={s}><Icon size={14} /> {children}</span>;
}
