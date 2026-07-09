import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAura } from '../AuraContext';
import Sparkline from '../components/Sparkline';
import DriverSelector from '../components/DriverSelector';
import { Activity, ShieldAlert, Car, Cpu, Brain, Eye, ScanFace } from 'lucide-react';
import { CORE_HTTP } from '../config';

const card: CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 };
const label: CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' };

function scoreLevel(score: number): { name: string; color: string } {
  if (score >= 70) return { name: 'SEVERE', color: 'var(--danger)' };
  if (score >= 45) return { name: 'MODERATE', color: 'var(--warning)' };
  if (score >= 20) return { name: 'MILD', color: 'var(--accent)' };
  return { name: 'ALERT (ok)', color: 'var(--success)' };
}
const barColor = (v: number) => (v > 60 ? 'var(--danger)' : v > 30 ? 'var(--warning)' : 'var(--success)');

function Metric({ name, value, alert }: { name: string; value: string; alert?: boolean }) {
  return (
    <div style={card}>
      <span style={label}>{name}</span>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: alert ? 'var(--danger)' : 'var(--text-primary)', marginTop: 4 }}>{value}</div>
    </div>
  );
}

// A 0–100 track showing the live drowsiness score (fill) against a threshold marker.
// Two of these side by side make the personal-vs-generic differentiator obvious.
function ThresholdBar({ labelText, value, score, color }: { labelText: string; value: number; score: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const sc = Math.max(0, Math.min(100, score));
  const fires = sc >= value;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{labelText}</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color }}>{Math.round(value)}</span>
      </div>
      <div style={{ position: 'relative', height: 8, background: 'var(--bg-tertiary)', borderRadius: 4 }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${sc}%`, background: fires ? 'var(--danger)' : 'var(--success)', borderRadius: 4, transition: 'width 0.2s' }} />
        <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${pct}%`, width: 2, background: color, transform: 'translateX(-1px)' }} title={`threshold ${Math.round(value)}`} />
      </div>
    </div>
  );
}

export default function LiveMonitor() {
  const { connected, live, alert, driver, events, telemetry, explain, vision } = useAura();
  const [scoreHist, setScoreHist] = useState<number[]>([]);
  const lastTick = useRef(0);

  // Face-ID enrollment status (polled) + one-click enroll of the active driver.
  const [enrolled, setEnrolled] = useState<string[]>([]);
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);
  useEffect(() => {
    const load = () => fetch(`${CORE_HTTP}/faceid/status`).then((r) => r.json()).then((d) => setEnrolled(d.enrolled ?? [])).catch(() => {});
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);
  const enrollCurrent = () => {
    fetch(`${CORE_HTTP}/driver/enroll_current`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => r.json())
      .then((d) => { setEnrollMsg(d.ok ? 'Enrolled ✓' : (d.error ?? 'failed')); if (d.enrolled) setEnrolled(d.enrolled); setTimeout(() => setEnrollMsg(null), 2600); })
      .catch(() => { setEnrollMsg('Core offline'); setTimeout(() => setEnrollMsg(null), 2600); });
  };

  useEffect(() => {
    if (!live) return;
    const now = Date.now();
    if (now - lastTick.current < 150) return;
    lastTick.current = now;
    setScoreHist((p) => [...p, live.score].slice(-60));
  }, [live]);

  const score = live?.score ?? 0;
  const lvl = scoreLevel(score);
  const hasTele = !!telemetry;
  const pullingOver = alert?.action === 'pull_over' || !!telemetry?.pullingOver;
  const vehicleSpeed = hasTele ? Math.round(telemetry!.speedKmh) : pullingOver ? 0 : 64;
  const factors = live?.factors ?? [];
  const faceOn = !!live?.facePresent;
  const earAlert = (live?.ear ?? 1) < 0.22;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Live Monitor</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6 }}>
            <span style={{ ...label, color: connected ? 'var(--success)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--success)' : 'var(--text-tertiary)' }} />
              {connected ? 'Edge brain' : 'Offline'}
            </span>
            <span style={{ ...label, display: 'flex', alignItems: 'center', gap: 6 }}><Cpu size={12} /> On-device CV · separate Python process</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <DriverSelector compact />
          <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={13} /> LIVE</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '54% 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Left: external Python CV process (camera runs off the browser UI thread) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, borderLeft: pullingOver ? '3px solid var(--danger)' : '3px solid var(--accent)', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
            <span style={{ ...label, display: 'flex', alignItems: 'center', gap: 8 }}><Cpu size={16} /> On-device CV · separate process</span>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 1, color: faceOn ? 'var(--success)' : 'var(--text-tertiary)' }}>
              {faceOn ? 'FACE DETECTED' : 'NO FACE'}
            </div>
            <div style={{ display: 'flex', gap: 26 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: earAlert ? 'var(--danger)' : 'var(--text-primary)' }}>{live?.ear != null ? live.ear.toFixed(3) : '--'}</div>
                <div style={label}>EAR</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: (live?.eyeClosureS ?? 0) > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{live?.eyeClosureS != null ? `${live.eyeClosureS.toFixed(1)}s` : '--'}</div>
                <div style={label}>eyes closed</div>
              </div>
            </div>
            <span style={{ ...label, color: (connected && live) ? 'var(--success)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: (connected && live) ? 'var(--success)' : 'var(--text-tertiary)' }} />
              {live ? 'Camera streaming' : 'Waiting for camera_monitor.py…'}
            </span>
          </div>
          <p style={{ ...label, textTransform: 'none', textAlign: 'center' }}>
            OpenCV + MediaPipe run in a separate Python process (camera_monitor.py) — true edge, off the UI thread → Aura Core → the Unity car.
          </p>
        </div>

        {/* Right: live signal panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
          {/* Risk score */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={label}>Drowsiness Risk (fused)</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: lvl.color }}>{lvl.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <span style={{ fontSize: 40, fontWeight: 700, fontFamily: 'var(--font-mono)', color: lvl.color, lineHeight: 1 }}>{Math.round(score)}</span>
              <div style={{ flex: 1, paddingBottom: 4 }}><Sparkline data={scoreHist} min={0} max={100} color={lvl.color} height={30} /></div>
            </div>
            {live?.ml && (
              <p style={{ ...label, textTransform: 'none', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Brain size={11} /> TinyML 2nd opinion: <b style={{ color: 'var(--text-secondary)' }}>{live.ml.class}</b> ({Math.round(live.ml.confidence * 100)}%)
              </p>
            )}
          </div>

          {/* Vision-LLM scene understanding (out of the safety loop) */}
          <div style={{ ...card, borderLeft: '3px solid var(--info)' }}>
            <span style={{ ...label, display: 'flex', alignItems: 'center', gap: 6 }}><Eye size={12} /> Scene Understanding · Vision-LLM</span>
            <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
              {vision?.description || 'Waiting for the camera to read the cabin scene… (llava, on-device — layered over MediaPipe).'}
            </p>
            {vision && (
              <span style={{ ...label, textTransform: 'none', color: 'var(--text-tertiary)' }}>
                llava · on-device · {new Date(vision.ts).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Face-ID (on-device geometric recognition) */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ ...label, display: 'flex', alignItems: 'center', gap: 6 }}><ScanFace size={12} /> Face-ID · on-device</span>
              <button onClick={enrollCurrent} style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--glass-border)' }}>
                Enroll {driver?.name ?? 'driver'}
              </button>
            </div>
            <div style={{ marginTop: 9, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['haresh', 'priya', 'arjun', 'guest'].map((id) => {
                const on = enrolled.includes(id);
                return (
                  <span key={id} style={{ fontSize: 10, fontWeight: 700, textTransform: 'capitalize', padding: '3px 9px', borderRadius: 999, background: on ? 'color-mix(in srgb, var(--success) 16%, transparent)' : 'var(--bg-tertiary)', color: on ? 'var(--success)' : 'var(--text-tertiary)', border: `1px solid ${on ? 'color-mix(in srgb, var(--success) 30%, transparent)' : 'var(--border)'}` }}>
                    {on ? '● ' : '○ '}{id}
                  </span>
                );
              })}
            </div>
            <span style={{ ...label, textTransform: 'none', color: 'var(--text-tertiary)', marginTop: 8, display: 'block' }}>
              {enrollMsg ?? 'Look at the camera and enroll — recognition auto-loads the driver on sit-down.'}
            </span>
          </div>

          {/* Risk factors — explainability */}
          <div style={card}>
            <span style={label}>Risk Factors (weighted fusion)</span>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {factors.length === 0 ? (
                <span style={{ ...label, textTransform: 'none' }}>EAR-based signal from the Python camera — no per-factor fusion.</span>
              ) : (
                factors.map((f) => (
                  <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 92, flexShrink: 0 }}>{f.name}</span>
                    <div style={{ flex: 1, height: 5, background: 'var(--bg-tertiary)', borderRadius: 3 }}>
                      <div style={{ width: `${Math.min(f.value, 100)}%`, height: '100%', background: barColor(f.value), borderRadius: 3, transition: 'width 0.2s' }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 30, textAlign: 'right' }}>×{f.contribution.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Metric grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Metric name="EAR" value={live?.ear != null ? live.ear.toFixed(3) : '--'} alert={(live?.ear ?? 1) < 0.22} />
            <Metric name="PERCLOS" value={live?.perclos != null ? `${Math.round(live.perclos * 100)}%` : '--'} alert={(live?.perclos ?? 0) > 0.15} />
            <Metric name="Yawn (MAR)" value={live?.mar != null ? live.mar.toFixed(2) : '--'} alert={(live?.mar ?? 0) > 0.6} />
            <Metric name="Blink/min" value={live?.blinkRate != null ? `${Math.round(live.blinkRate)}` : '--'} />
            <Metric name="Head pitch" value={live?.headPitch != null ? `${Math.round(live.headPitch)}°` : '--'} alert={Math.abs(live?.headPitch ?? 0) > 20} />
            <Metric name="Gaze" value={live?.gazeDirection ?? '--'} alert={(live?.gazeStability ?? 1) < 0.5} />
          </div>

          {/* Safety state */}
          <div style={{ ...card, border: alert ? '1px solid var(--danger)' : '1px solid var(--border)', background: alert ? 'rgba(239,68,68,0.06)' : 'var(--bg-secondary)' }}>
            <span style={{ ...label, color: alert ? 'var(--danger)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={12} /> Safety state {driver ? `· ${driver.name}` : ''}
            </span>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, color: alert ? 'var(--danger)' : 'var(--success)', marginTop: 6 }}>{alert ? 'WAKE UP' : 'ALL CLEAR'}</div>
            {alert && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 0' }}>{alert.reason}</p>}
          </div>

          {/* Why Aura acts — personalized explainability (the differentiator, made visible) */}
          {explain && (
            <div style={card}>
              <span style={{ ...label, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Brain size={12} /> Why Aura acts {driver ? `· ${driver.name}` : ''}
              </span>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 10px', lineHeight: 1.5 }}>{explain.decision}</p>
              <ThresholdBar labelText="Your adaptive threshold" value={explain.personalThreshold ?? 0} score={score} color="var(--accent)" />
              <ThresholdBar labelText="Generic fixed threshold" value={explain.genericThreshold ?? 50} score={score} color="var(--text-tertiary)" />
            </div>
          )}

          {/* Vehicle response */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...label, display: 'flex', alignItems: 'center', gap: 6 }}><Car size={12} /> Vehicle response (Unity car)</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: hasTele ? 'var(--success)' : 'var(--text-tertiary)' }}>{hasTele ? '● LIVE LINK' : '○ SIM'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 10 }}>
              <div><div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: vehicleSpeed === 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{vehicleSpeed}</div><div style={label}>km/h</div></div>
              <div><div style={{ fontSize: 12, fontWeight: 600, color: pullingOver ? 'var(--danger)' : 'var(--success)' }}>{pullingOver ? 'PULLING OVER' : hasTele ? 'AUTONOMOUS' : 'CRUISING'}</div><div style={label}>status</div></div>
              <div><div style={{ fontSize: 12, fontWeight: 600, color: pullingOver ? 'var(--danger)' : 'var(--text-tertiary)' }}>{pullingOver ? 'FLASHING' : 'OFF'}</div><div style={label}>hazards</div></div>
            </div>
            {hasTele && (
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{telemetry!.scenario ?? 'Scenario'}</span>
                <span>steer {Math.round(telemetry!.steer ?? 0)}° · throttle {Math.round((telemetry!.throttle ?? 0) * 100)}%</span>
              </div>
            )}
          </div>

          {/* Event log */}
          <div style={{ ...card, flex: 1, minHeight: 90, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={label}>Event Log</span>
              <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 500 }}>LIVE</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {events.length === 0 ? (
                <span style={{ ...label, textTransform: 'none' }}>Monitoring active…</span>
              ) : (
                events.map((evt, i) => (
                  <div key={i} style={{ padding: '6px 10px', borderRadius: 4, background: 'var(--bg-primary)', borderLeft: `2px solid ${evt.type === 'alert' ? 'var(--danger)' : evt.type === 'identified' ? 'var(--accent)' : 'var(--success)'}` }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{evt.time}</span>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{evt.detail}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
