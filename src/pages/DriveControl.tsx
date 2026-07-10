import { useEffect, useRef, useState } from 'react';
import { Gauge, AlertTriangle, Car } from 'lucide-react';
import { useAura } from '../AuraContext';
import { glass, glassStrong, label, mono, Chip } from '../ui';
import { CORE_HTTP } from '../config';
import { speak } from '../utils/voice';

const LIMIT = 50; // km/h — matches Aura Core + the Unity AuraSpeedLimit sign
const MAX = 120;

export default function DriveControl() {
  const { telemetry } = useAura();
  const [speed, setSpeed] = useState(45);
  const sendTimer = useRef<number | undefined>(undefined);
  const prevOver = useRef(false);

  // Seed from the core's current commanded speed on mount.
  useEffect(() => {
    fetch(`${CORE_HTTP}/control/speed`).then((r) => r.json()).then((d) => {
      if (typeof d?.speedKmh === 'number') setSpeed(Math.round(d.speedKmh));
    }).catch(() => {});
  }, []);

  const send = (v: number) => {
    fetch(`${CORE_HTTP}/control/speed`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speedKmh: v }),
    }).catch(() => {});
  };
  const setSpeedAndSend = (v: number, immediate = false) => {
    setSpeed(v);
    if (sendTimer.current) window.clearTimeout(sendTimer.current);
    if (immediate) send(v);
    else sendTimer.current = window.setTimeout(() => send(v), 110);
  };

  const over = speed > LIMIT;

  // Natural spoken alert the moment the driver crosses the limit (once per crossing).
  useEffect(() => {
    if (over && !prevOver.current) speak(`Careful — you're over the ${LIMIT} kilometre speed limit. Please ease off.`);
    prevOver.current = over;
  }, [over]);

  const dial = over ? 'var(--danger)' : speed > LIMIT - 10 ? 'var(--warning)' : 'var(--success)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16, position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Gauge size={22} style={{ color: 'var(--accent)' }} /> Drive Control
          </h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4 }}>
            Set the car's speed. Over {LIMIT} km/h, Aura warns you — by voice, here, and in the car.
          </p>
        </div>
        <Chip color={over ? 'var(--danger)' : 'var(--success)'} tone={over ? 'solid' : 'ghost'}>
          {over ? `OVER LIMIT · +${Math.round(speed - LIMIT)}` : 'WITHIN LIMIT'}
        </Chip>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Speed dial + slider */}
        <div style={{ ...glass, padding: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, borderLeft: `3px solid ${dial}`, transition: 'border-color 0.25s' }}>
          <div style={{ ...label }}>Commanded speed</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 96, fontWeight: 800, fontFamily: 'var(--font-mono)', color: dial, lineHeight: 1, transition: 'color 0.25s' }}>{speed}</span>
            <span style={{ fontSize: 20, color: 'var(--text-tertiary)', fontWeight: 700 }}>km/h</span>
          </div>

          <input
            type="range" min={0} max={MAX} value={speed}
            onChange={(e) => setSpeedAndSend(Number(e.target.value))}
            style={{ width: '100%', accentColor: dial, height: 6 }}
          />
          {/* limit marker under the track */}
          <div style={{ width: '100%', position: 'relative', height: 16, marginTop: -8 }}>
            <div style={{ position: 'absolute', left: `${(LIMIT / MAX) * 100}%`, transform: 'translateX(-50%)', textAlign: 'center' }}>
              <div style={{ width: 2, height: 8, background: 'var(--danger)', margin: '0 auto' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)' }}>limit {LIMIT}</span>
            </div>
          </div>

          {/* quick presets */}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {[30, 50, 70, 90].map((v) => (
              <button key={v} onClick={() => setSpeedAndSend(v, true)}
                style={{ ...glassStrong, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: v > LIMIT ? 'var(--danger)' : 'var(--text-primary)' }}>
                {v}
              </button>
            ))}
          </div>
          {telemetry?.speedKmh != null && (
            <div style={{ ...label, textTransform: 'none', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)' }}>
              <Car size={13} /> Car reports {Math.round(telemetry.speedKmh)} km/h in the sim
            </div>
          )}
        </div>

        {/* Speed-limit sign + status */}
        <div style={{ ...glass, padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          {/* road-style speed-limit sign */}
          <div style={{ position: 'relative', width: 150, height: 150, borderRadius: '50%', background: '#f4f4f4', border: '10px solid #d11', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: over ? '0 0 30px var(--danger)' : 'var(--elev-2)', transition: 'box-shadow 0.25s' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#333', letterSpacing: 1 }}>LIMIT</span>
            <span style={{ fontSize: 58, fontWeight: 900, color: '#111', lineHeight: 1 }}>{LIMIT}</span>
          </div>
          {over ? (
            <div style={{ textAlign: 'center', animation: 'pulse 0.9s infinite' }}>
              <AlertTriangle size={26} style={{ color: 'var(--danger)' }} />
              <div style={{ color: 'var(--danger)', fontWeight: 800, fontSize: 16, marginTop: 6 }}>SLOW DOWN</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{speed} km/h · +{Math.round(speed - LIMIT)} over the limit</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--success)' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Within the limit</div>
              <div style={{ ...label, textTransform: 'none', color: 'var(--text-tertiary)' }}><span style={mono}>{LIMIT - speed}</span> km/h of headroom</div>
            </div>
          )}
        </div>
      </div>

      {/* Full-width over-speed banner */}
      {over && (
        <div style={{ ...glassStrong, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '4px solid var(--danger)', animation: 'pulse 1.1s infinite' }}>
          <AlertTriangle size={22} style={{ color: 'var(--danger)' }} />
          <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            Over the {LIMIT} km/h limit — Aura is alerting you by voice and in the car.
          </div>
        </div>
      )}
    </div>
  );
}
