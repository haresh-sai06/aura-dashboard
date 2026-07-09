import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Siren, PhoneCall, MessageCircle, MapPin, Plus, Trash2, X, Check, ChevronDown, ShieldAlert, Send } from 'lucide-react';
import { useAura } from '../AuraContext';
import { glass, glassStrong, label, mono, Chip } from '../ui';
import { CORE_HTTP } from '../config';

type Channel = 'whatsapp' | 'sms' | 'call';
type Contact = { name: string; phone: string; channel: Channel; callmebot_key?: string };
type Twilio = { sid?: string; token?: string; from?: string };

const CHANNEL_META: Record<Channel, { label: string; icon: typeof PhoneCall; color: string }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: 'var(--success)' },
  sms: { label: 'SMS', icon: MessageCircle, color: 'var(--info)' },
  call: { label: 'Voice call', icon: PhoneCall, color: 'var(--accent)' },
};

const DEMO_LOCATION = { lat: 13.0827, lng: 80.2707, label: 'Chennai, TN (demo)' };

/** How the core returns contacts (secrets redacted to a hasKey flag). */
type ServerContact = { name: string; phone: string; channel: Channel; hasKey?: boolean };

function getLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(null),
      { timeout: 4000, enableHighAccuracy: false },
    );
  });
}

const inputStyle: CSSProperties = {
  padding: '9px 12px', borderRadius: 9, border: '1px solid var(--glass-border)',
  background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
};

export default function Emergency() {
  const { orchestration, driver, vision } = useAura();
  const [contacts, setContacts] = useState<ServerContact[]>([]);
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [twilio, setTwilio] = useState<Twilio>({});
  const [showTwilio, setShowTwilio] = useState(false);
  const [form, setForm] = useState<Contact>({ name: '', phone: '', channel: 'whatsapp', callmebot_key: '' });

  const [phase, setPhase] = useState<'idle' | 'arming' | 'sending' | 'done'>('idle');
  const [countdown, setCountdown] = useState(5);
  const [location, setLocation] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [results, setResults] = useState<{ name?: string; channel?: string; ok?: boolean; error?: string }[] | null>(null);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const manualRef = useRef(false);
  const [testing, setTesting] = useState<number | null>(null);
  const [testMsg, setTestMsg] = useState<{ i: number; ok: boolean; text: string } | null>(null);

  const sendTest = async (i: number) => {
    setTesting(i); setTestMsg(null);
    try {
      const r = await fetch(`${CORE_HTTP}/emergency/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index: i }) }).then((res) => res.json());
      setTestMsg({ i, ok: !!r.ok, text: r.ok ? 'Test sent ✓' : (r.result?.error ?? 'failed') });
    } catch { setTestMsg({ i, ok: false, text: 'Core offline' }); }
    setTesting(null);
  };

  // The core (emergency.json) is the source of truth for dispatch; the dashboard reflects it.
  const refresh = useCallback(() => {
    fetch(`${CORE_HTTP}/emergency/config`).then((r) => r.json()).then((d) => {
      setContacts(d.contacts ?? []);
      setTwilioConfigured(!!d.twilioConfigured);
    }).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const addContact = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    await fetch(`${CORE_HTTP}/emergency/contact/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: form }) }).catch(() => {});
    setForm({ name: '', phone: '', channel: 'whatsapp', callmebot_key: '' });
    refresh();
  };
  const removeContact = async (i: number) => {
    await fetch(`${CORE_HTTP}/emergency/contact/remove`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index: i }) }).catch(() => {});
    refresh();
  };
  const saveTwilio = async () => {
    await fetch(`${CORE_HTTP}/emergency/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ twilio }) }).catch(() => {});
    setTwilio({}); setShowTwilio(false); refresh();
  };

  const cancel = useCallback(() => {
    setPhase('idle'); setCountdown(5); manualRef.current = false;
    fetch(`${CORE_HTTP}/emergency/cancel`, { method: 'POST' }).catch(() => {});
  }, []);

  const arm = useCallback(async (manual: boolean) => {
    if (phaseRef.current !== 'idle') return;
    manualRef.current = manual;
    setResults(null);
    setPhase('arming'); setCountdown(5);
    const loc = await getLocation();
    setLocation(loc ? { ...loc } : DEMO_LOCATION);
  }, []);

  const dispatch = useCallback(async () => {
    setPhase('sending');
    try {
      const res = await fetch(`${CORE_HTTP}/emergency/dispatch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, reason: 'Unresponsive driver — drowsiness takeover' }),
      }).then((r) => r.json());
      setResults(res.results ?? []);
    } catch {
      setResults([{ ok: false, error: 'Aura Core offline' }]);
    }
    setPhase('done');
  }, [location]);

  // Countdown ticker → dispatch at zero.
  useEffect(() => {
    if (phase !== 'arming') return;
    if (countdown <= 0) { void dispatch(); return; }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, countdown, dispatch]);

  // Auto-trigger on a sustained Level-4 takeover; auto-stand-down if the driver recovers.
  const level = orchestration?.level ?? 0;
  useEffect(() => {
    if (level >= 4 && phaseRef.current === 'idle' && contacts.length > 0) void arm(false);
    if (level < 4 && phaseRef.current === 'arming' && !manualRef.current) cancel();
  }, [level, contacts.length, arm, cancel]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16, position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Siren size={22} style={{ color: 'var(--danger)' }} /> Emergency eCall
          </h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4 }}>
            On a sustained Level-4 takeover, Aura alerts your contacts with location + what the camera sees. EU-eCall style.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Chip color={level >= 4 ? 'var(--danger)' : level >= 1 ? 'var(--warning)' : 'var(--success)'} tone={level >= 4 ? 'solid' : 'ghost'}>
            L{level} {orchestration?.levelName ?? ''}
          </Chip>
          <button onClick={() => arm(true)} disabled={phase !== 'idle'} style={{ ...btn('var(--danger)'), opacity: phase !== 'idle' ? 0.5 : 1 }}>
            <ShieldAlert size={14} /> Test eCall
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Contacts */}
        <div style={{ ...glass, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <span style={{ ...label, display: 'flex', alignItems: 'center', gap: 6 }}><PhoneCall size={13} /> Emergency contacts</span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
            {contacts.length === 0 && <span style={{ ...label, textTransform: 'none' }}>No contacts yet — add one below.</span>}
            {contacts.map((c, i) => {
              const M = CHANNEL_META[c.channel];
              return (
                <div key={i} style={{ ...glassStrong, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${M.color} 16%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <M.icon size={15} style={{ color: M.color }} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ ...label, textTransform: 'none' }}>{M.label} · +{c.phone}{c.channel === 'whatsapp' && !c.hasKey ? ' · ⚠ no key' : ''}</div>
                    {testMsg?.i === i && <div style={{ fontSize: 11, fontWeight: 600, color: testMsg.ok ? 'var(--success)' : 'var(--danger)', marginTop: 2 }}>{testMsg.text}</div>}
                  </div>
                  <button onClick={() => sendTest(i)} disabled={testing === i} title="Send a test alert" style={btn('var(--info)')}>
                    <Send size={13} /> {testing === i ? '…' : 'Test'}
                  </button>
                  <button onClick={() => removeContact(i)} style={btn('var(--text-tertiary)')}><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>

          {/* Add form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
              <input placeholder="Phone (91…)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ ...inputStyle, width: 130 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Channel })} style={{ ...inputStyle, flex: 1 }}>
                <option value="whatsapp">WhatsApp (CallMeBot)</option>
                <option value="sms">SMS (Twilio)</option>
                <option value="call">Voice call (Twilio)</option>
              </select>
              {form.channel === 'whatsapp' && (
                <input placeholder="CallMeBot key" value={form.callmebot_key} onChange={(e) => setForm({ ...form, callmebot_key: e.target.value })} style={{ ...inputStyle, width: 130 }} />
              )}
            </div>
            <button onClick={addContact} style={{ ...btn('var(--accent)'), justifyContent: 'center' }}><Plus size={14} /> Add contact</button>
            <button onClick={() => setShowTwilio((s) => !s)} style={{ ...label, textTransform: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
              <ChevronDown size={12} /> Twilio settings (for SMS / voice call){twilioConfigured ? ' · configured ✓' : ''}
            </button>
            {showTwilio && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input placeholder="Account SID" value={twilio.sid ?? ''} onChange={(e) => setTwilio({ ...twilio, sid: e.target.value })} style={inputStyle} />
                <input placeholder="Auth token" type="password" value={twilio.token ?? ''} onChange={(e) => setTwilio({ ...twilio, token: e.target.value })} style={inputStyle} />
                <input placeholder="From number (+1…)" value={twilio.from ?? ''} onChange={(e) => setTwilio({ ...twilio, from: e.target.value })} style={inputStyle} />
                <button onClick={saveTwilio} style={{ ...btn('var(--accent)'), justifyContent: 'center' }}><Check size={14} /> Save Twilio</button>
              </div>
            )}
          </div>
        </div>

        {/* Status / preview */}
        <div style={{ ...glass, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ ...label, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={13} /> Alert preview</span>
          <div style={{ ...glassStrong, padding: 14, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, color: 'var(--danger)' }}>🚨 AURA EMERGENCY — {driver?.name ?? 'Driver'} may be in danger.</div>
            <div>The vehicle detected an unresponsive driver and is performing a safe stop.</div>
            <div style={{ marginTop: 8 }}>Location: <span style={mono}>{location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'acquired at dispatch (GPS)'}</span></div>
            {vision?.description && <div style={{ marginTop: 8 }}>Cabin camera: <em>{vision.description}</em></div>}
          </div>
          {results && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={label}>Delivery</span>
              {results.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  {r.ok ? <Check size={14} style={{ color: 'var(--success)' }} /> : <X size={14} style={{ color: 'var(--danger)' }} />}
                  <span style={{ color: 'var(--text-secondary)' }}>{r.name ?? 'contact'} · {r.channel}</span>
                  {!r.ok && <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Countdown overlay */}
      {(phase === 'arming' || phase === 'sending') && (
        <div style={{ position: 'absolute', inset: 0, background: 'color-mix(in srgb, var(--bg-primary) 82%, transparent)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, zIndex: 10, borderRadius: 'var(--radius)' }}>
          <Siren size={54} style={{ color: 'var(--danger)', animation: 'pulse 0.8s infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {phase === 'sending' ? 'Sending emergency alert…' : 'Emergency detected — alerting contacts in'}
            </div>
            {phase === 'arming' && <div style={{ fontSize: 72, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--danger)', lineHeight: 1 }}>{countdown}</div>}
            <div style={{ ...label, textTransform: 'none' }}>{location ? `Location ${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}` : 'acquiring GPS…'}</div>
          </div>
          {phase === 'arming' && (
            <button onClick={cancel} style={{ ...btn('var(--success)'), padding: '14px 32px', fontSize: 16 }}>
              <Check size={18} /> I'm OK — cancel
            </button>
          )}
        </div>
      )}

      {phase === 'done' && (
        <button onClick={() => { setPhase('idle'); setResults(null); }} style={{ ...btn('var(--text-tertiary)'), position: 'absolute', bottom: 8, right: 8 }}>Reset</button>
      )}
    </div>
  );
}

function btn(color = 'var(--text-secondary)'): CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9,
    fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color,
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
    border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
  };
}
