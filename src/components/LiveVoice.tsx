import { useEffect, useRef, useState } from 'react';
import { PhoneOff, Loader2 } from 'lucide-react';
import { AuraOrb, glass, label } from '../ui';
import { CORE_WS } from '../config';
import { useOS, DESTINATIONS } from '../os/OSContext';

type ToolMsg = { name: string; args: Record<string, unknown> };

/** Apply an Aoede tool-call to the head-unit OS; returns a short chip label of what changed. */
function applyTool(m: ToolMsg, os: ReturnType<typeof useOS>): string {
  const a = m.args || {};
  if (m.name === 'set_climate') {
    if (typeof a.temp === 'number') os.setTemp(a.temp as number);
    if (typeof a.ac === 'boolean' && (a.ac as boolean) !== os.climate.ac) os.toggleAc();
    return `🌡️ ${(a.temp as number) ?? os.climate.temp}°${a.ac === false ? ' · A/C off' : ''}`;
  }
  if (m.name === 'play_music') { os.setMusicPlaying(true); return `🎵 ${(a.mood as string) || 'music'}`; }
  if (m.name === 'navigate_to') {
    const place = String(a.place || '').toLowerCase();
    const dest = DESTINATIONS.find((d) => place.includes(d.id) || place.includes(d.name.toLowerCase()));
    if (dest) { os.setDestination(dest.id); return `🧭 ${dest.name}`; }
    return `🧭 ${a.place}`;
  }
  return m.name;
}

/**
 * Aoede live voice — real-time audio-to-audio with Gemini Live, proxied through Aura Core
 * (the API key never reaches the browser). Captures mic PCM @16kHz, streams it to Core, and
 * plays back Aoede's 24kHz audio, with live captions. This is the natural, interruptible voice
 * buddy; if it can't connect it simply exits back to the text buddy (never strands the demo).
 */
type Caption = { role: 'user' | 'aoede'; text: string };

function floatTo16kPCM(input: Float32Array, inRate: number): Int16Array {
  const outRate = 16000;
  const ratio = inRate / outRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)] || 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}
function b64FromInt16(int16: Int16Array): string {
  const u8 = new Uint8Array(int16.buffer);
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}
function int16FromB64(s: string): Int16Array {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Int16Array(u8.buffer);
}

export default function LiveVoice({ name, onExit }: { name?: string; onExit: () => void }) {
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [error, setError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const os = useOS();
  const osRef = useRef(os);
  osRef.current = os;

  const wsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextTimeRef = useRef(0);
  const speakTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const playChunk = (int16: Int16Array) => {
      const ctx = playCtxRef.current;
      if (!ctx) return;
      const f32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
      const buf = ctx.createBuffer(1, f32.length, 24000);
      buf.getChannelData(0).set(f32);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      const t = Math.max(ctx.currentTime, nextTimeRef.current);
      src.start(t);
      nextTimeRef.current = t + buf.duration;
      setSpeaking(true);
      if (speakTimer.current) window.clearTimeout(speakTimer.current);
      speakTimer.current = window.setTimeout(() => setSpeaking(false), (nextTimeRef.current - ctx.currentTime) * 1000 + 150);
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        playCtxRef.current = new AudioContext();
        const micCtx = new AudioContext();
        micCtxRef.current = micCtx;

        const ws = new WebSocket(`${CORE_WS}ws/aoede`);
        wsRef.current = ws;

        ws.onopen = () => {
          const src = micCtx.createMediaStreamSource(stream);
          const proc = micCtx.createScriptProcessor(4096, 1, 1);
          proc.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const pcm = floatTo16kPCM(e.inputBuffer.getChannelData(0), micCtx.sampleRate);
            ws.send(JSON.stringify({ type: 'audio', data: b64FromInt16(pcm) }));
          };
          const mute = micCtx.createGain();
          mute.gain.value = 0; // route through a silent gain so onaudioprocess fires without echo
          src.connect(proc); proc.connect(mute); mute.connect(micCtx.destination);
        };
        ws.onmessage = (ev) => {
          let m: { type: string; data?: string; role?: string; text?: string; error?: string; name?: string; args?: Record<string, unknown> };
          try { m = JSON.parse(ev.data as string); } catch { return; }
          if (m.type === 'ready') {
            setStatus('live');
            const driverId = (name || 'guest').toLowerCase().split(/\s+/)[0];
            try { ws.send(JSON.stringify({ type: 'init', name, driverId })); } catch { /* */ }
            try { ws.send(JSON.stringify({ type: 'text', data: `Greet ${name || 'the driver'} warmly in one short sentence and invite them to talk.` })); } catch { /* */ }
          }
          else if (m.type === 'tool' && m.name) {
            const chip = applyTool({ name: m.name, args: m.args || {} }, osRef.current);
            setActions((a) => [chip, ...a].slice(0, 5));
          }
          else if (m.type === 'audio' && m.data) playChunk(int16FromB64(m.data));
          else if (m.type === 'transcript' && m.role && m.text) {
            setCaptions((c) => {
              const last = c[c.length - 1];
              if (last && last.role === m.role) return [...c.slice(0, -1), { role: last.role, text: last.text + m.text }];
              return [...c, { role: m.role as 'user' | 'aoede', text: m.text! }].slice(-6);
            });
          }
          else if (m.type === 'error') { setError(m.error || 'Live voice error'); setStatus('error'); }
        };
        ws.onerror = () => { setError('Could not reach Aoede (check Gemini key / network).'); setStatus('error'); };
        ws.onclose = () => { if (!cancelled) setStatus((s) => (s === 'error' ? s : 'error')); };
      } catch (e) {
        setError((e as Error)?.message || 'Microphone unavailable');
        setStatus('error');
      }
    };

    start();
    return () => {
      cancelled = true;
      try { wsRef.current?.close(); } catch { /* */ }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      micCtxRef.current?.close().catch(() => {});
      playCtxRef.current?.close().catch(() => {});
      if (speakTimer.current) window.clearTimeout(speakTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wrap: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 26,
    background: 'radial-gradient(900px 640px at 50% 38%, rgba(207,164,106,0.14), transparent 60%), var(--bg-primary)',
    padding: 24, textAlign: 'center',
  };

  return (
    <div style={wrap}>
      <AuraOrb size={128} active={speaking || status === 'live'} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.3em', color: 'var(--accent)', textTransform: 'uppercase' }}>Aoede · live</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>
          {status === 'connecting' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Loader2 size={20} style={{ animation: 'orbSpin 1s linear infinite' }} /> Connecting…</span>}
          {status === 'live' && (speaking ? 'Aoede is speaking…' : 'Listening…')}
          {status === 'error' && 'Live voice unavailable'}
        </div>
      </div>

      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 560 }}>
          {actions.map((a, i) => (
            <span key={i} className="rise" style={{ ...glass, padding: '7px 14px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{a}</span>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div style={{ ...glass, padding: 16, maxWidth: 420, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{error}</div>
      )}

      {captions.length > 0 && (
        <div style={{ ...glass, padding: 16, maxWidth: 560, width: '100%', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
          {captions.map((c, i) => (
            <div key={i} style={{ textAlign: c.role === 'user' ? 'right' : 'left' }}>
              <span style={{ ...label, color: c.role === 'aoede' ? 'var(--accent)' : 'var(--text-tertiary)' }}>{c.role === 'aoede' ? 'Aoede' : 'You'}</span>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{c.text}</div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onExit} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 24px', borderRadius: 14, border: 'none', cursor: 'pointer', color: '#fff', background: 'var(--danger)', fontWeight: 700, fontSize: 14 }}>
        <PhoneOff size={18} /> {status === 'error' ? 'Back to buddy' : 'End live chat'}
      </button>
    </div>
  );
}
