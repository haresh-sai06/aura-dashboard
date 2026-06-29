import { useState, useEffect, useRef } from 'react';
import { Shield, AlertTriangle, Car, Brain, ChevronRight, Eye, Volume2, Navigation, Thermometer, Radio } from 'lucide-react';
import { useAura } from '../AuraContext';
import {
  AutocareProtocol as AutocareEngine,
  LEVEL_DESCRIPTIONS,
  type AutocareState,
  type InterventionLevel,
} from '../utils/autocareProtocol';

const LEVEL_COLORS: Record<InterventionLevel, string> = {
  0: '#22c55e',
  1: '#3b82f6',
  2: '#f59e0b',
  3: '#fb923c',
  4: '#ef4444',
};

const LEVEL_ICONS: Record<InterventionLevel, typeof Shield> = {
  0: Eye,
  1: Volume2,
  2: Navigation,
  3: AlertTriangle,
  4: Car,
};

export default function AutoCare() {
  const { connected, live } = useAura();
  const liveRef = useRef(live);
  liveRef.current = live;

  const [autocareState, setAutocareState] = useState<AutocareState>({
    level: 0,
    levelName: 'MONITORING',
    activeInterventions: LEVEL_DESCRIPTIONS[0].interventions,
    escalationCountdown: null,
    deescalationCountdown: null,
    confidenceRequired: 0,
    triggerSignals: [],
    worldModelPrediction: 'NOMINAL: All signals within expected parameters.',
    autonomyPercentage: 0,
    timeSinceLastEscalation: 0,
  });

  const [displayScore, setDisplayScore] = useState(0);
  const [simScenario, setSimScenario] = useState<string | null>(null);
  const engine = useRef(new AutocareEngine());

  const scenarios = [
    { name: 'Gradual Fatigue', description: 'Score rises slowly (realistic highway driving)', pattern: 'gradual' },
    { name: 'Sudden Microsleep', description: 'Score spikes suddenly (microsleep event)', pattern: 'spike' },
    { name: 'Recovery', description: 'High score drops after driver takes action', pattern: 'recovery' },
    { name: 'False Alarm Test', description: 'Brief spike that should NOT escalate', pattern: 'false_alarm' },
  ];

  // Single ticker: drive the engine from the live camera score, or from a scripted scenario.
  useEffect(() => {
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      let score: number;
      let confidence = 0.85;

      if (simScenario === 'gradual') {
        score = Math.min(95, 10 + frame * 1.2);
      } else if (simScenario === 'spike') {
        score = frame < 12 ? 15 : 88;
      } else if (simScenario === 'recovery') {
        score = frame < 18 ? 75 : Math.max(8, 75 - (frame - 18) * 4);
      } else if (simScenario === 'false_alarm') {
        score = frame === 8 || frame === 9 ? 60 : 12;
        confidence = frame === 8 || frame === 9 ? 0.5 : 0.7;
      } else {
        // LIVE mode: use the real drowsiness score streamed from Aura Core.
        const l = liveRef.current;
        score = l && l.facePresent ? l.score : 0;
      }

      setDisplayScore(Math.round(score));

      const l = liveRef.current;
      const ear = simScenario || !l ? 0.3 - (score / 100) * 0.15 : l.ear ?? 0.3;
      const signals = [
        { name: 'PERCLOS', value: (score / 100) * 0.3, isAbnormal: score > 40 },
        { name: 'EAR', value: ear, isAbnormal: ear < 0.21 },
        { name: 'Eye Closure', value: (score / 80) * (l?.baseline ?? 2.4), isAbnormal: score > 55 },
      ];

      setAutocareState(engine.current.update(score, confidence, signals));

      // Auto-stop scripted scenarios after a run.
      if (simScenario && frame > 90) {
        setSimScenario(null);
        frame = 0;
      }
    }, 200);

    return () => clearInterval(interval);
  }, [simScenario]);

  const startSimulation = (pattern: string) => {
    engine.current.reset();
    setSimScenario(pattern);
  };

  const levelColor = LEVEL_COLORS[autocareState.level];
  const LevelIcon = LEVEL_ICONS[autocareState.level];
  const liveActive = !simScenario && connected && !!live?.facePresent;

  // Vehicle telemetry — reacts to the autocare level (mirrors the Unity car).
  const lvl = autocareState.level;
  const vehicleSpeed = lvl === 0 ? 80 : lvl === 1 ? 75 : lvl === 2 ? 65 : lvl === 3 ? 40 : 0;
  const steeringAngle = lvl === 4 ? 15 : lvl === 3 ? 5 : 0;
  const laneKeeping = lvl >= 2;
  const hazardLights = lvl >= 3;
  const windowsOpen = lvl >= 3;
  const ecallActive = lvl >= 4;

  const card: React.CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 };
  const tele = (v: string | number, unit: string, color = 'var(--text-primary)') => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{v}</div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{unit}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>AutoCare AI</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4 }}>
            Preventive escalation — SAE J3016 automation levels
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: liveActive ? 'rgba(34,197,94,0.1)' : 'var(--bg-tertiary)', color: liveActive ? 'var(--success)' : 'var(--text-tertiary)' }}>
            <Radio size={12} /> {liveActive ? 'LIVE · your camera' : simScenario ? 'SIMULATION' : 'IDLE'}
          </span>
          <div style={{ textAlign: 'center', padding: '10px 22px', borderRadius: 8, ...card }}>
            <LevelIcon size={20} style={{ color: levelColor, margin: '0 auto 4px', display: 'block' }} />
            <div style={{ color: levelColor, fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>LEVEL {lvl}</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500 }}>{autocareState.levelName}</div>
          </div>
        </div>
      </div>

      {/* Vehicle telemetry strip */}
      <div style={{ ...card, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Car size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vehicle Telemetry (live response)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          {tele(vehicleSpeed, 'km/h', vehicleSpeed === 0 ? 'var(--danger)' : vehicleSpeed < 60 ? 'var(--warning)' : 'var(--text-primary)')}
          {tele(`${steeringAngle}°`, steeringAngle > 0 ? 'pulling over' : 'straight', steeringAngle > 0 ? 'var(--warning)' : 'var(--text-primary)')}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, padding: '4px 8px', borderRadius: 4, background: laneKeeping ? 'rgba(34,197,94,0.1)' : 'var(--bg-tertiary)', color: laneKeeping ? 'var(--success)' : 'var(--text-tertiary)' }}>{laneKeeping ? 'ACTIVE' : 'OFF'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>lane assist</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, padding: '4px 8px', borderRadius: 4, background: hazardLights ? 'rgba(239,68,68,0.1)' : 'var(--bg-tertiary)', color: hazardLights ? 'var(--danger)' : 'var(--text-tertiary)' }}>{hazardLights ? 'FLASHING' : 'OFF'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>hazards</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, padding: '4px 8px', borderRadius: 4, background: windowsOpen ? 'rgba(59,130,246,0.1)' : 'var(--bg-tertiary)', color: windowsOpen ? 'var(--accent)' : 'var(--text-tertiary)' }}>{windowsOpen ? 'OPEN' : 'CLOSED'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>windows</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, padding: '4px 8px', borderRadius: 4, background: ecallActive ? 'rgba(239,68,68,0.15)' : 'var(--bg-tertiary)', color: ecallActive ? 'var(--danger)' : 'var(--text-tertiary)' }}>{ecallActive ? 'DIALING 112' : 'STANDBY'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>eCall</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Left: world model + levels */}
        <div style={{ width: '60%', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          <div style={{ ...card, padding: '18px 22px', border: '2px solid rgba(139,92,246,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Brain size={18} style={{ color: 'var(--info)' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 800 }}>WORLD MODEL PREDICTION</span>
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{autocareState.worldModelPrediction}</p>
            <div style={{ marginTop: 12, display: 'flex', gap: 18 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 11 }}>
                <Thermometer size={13} /> Drowsiness Score: <strong style={{ color: levelColor }}>{displayScore}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 11 }}>
                <Car size={13} /> Autonomy: <strong style={{ color: levelColor }}>{autocareState.autonomyPercentage}%</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
            {([0, 1, 2, 3, 4] as InterventionLevel[]).map((level) => {
              const config = LEVEL_DESCRIPTIONS[level];
              const color = LEVEL_COLORS[level];
              const Icon = LEVEL_ICONS[level];
              const isActive = lvl === level;
              const isPast = lvl > level;
              return (
                <div key={level} style={{ background: isActive ? `${color}14` : 'var(--bg-secondary)', padding: '14px 18px', borderRadius: 8, border: isActive ? `2px solid ${color}` : '1px solid var(--border)', opacity: isPast ? 0.5 : 1, transition: 'all 0.3s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>Level {level}: {config.name}</span>
                        {isActive && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, animation: 'pulse 1s infinite' }} />}
                      </div>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                        Confidence ≥ {(config.confidenceThreshold * 100).toFixed(0)}% · Autonomy {config.autonomyPct}%
                      </span>
                    </div>
                    {isActive && <span style={{ color, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 8, background: `${color}20` }}>ACTIVE</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 44 }}>
                    {config.interventions.map((intervention, i) => (
                      <span key={i} style={{ padding: '4px 10px', borderRadius: 6, background: isActive ? `${color}15` : 'var(--bg-primary)', color: isActive ? color : 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, border: `1px solid ${isActive ? `${color}30` : 'transparent'}` }}>{intervention}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: simulation + logic */}
        <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ ...card, padding: '18px 22px' }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 800, margin: '0 0 14px' }}>SIMULATION SCENARIOS</h3>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 11, margin: '0 0 12px' }}>
              {liveActive ? 'Live mode active — or run a scripted scenario:' : 'Run a scenario, or close your eyes on camera to drive it live.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {scenarios.map((s) => (
                <button key={s.pattern} onClick={() => startSimulation(s.pattern)} style={{ padding: '12px 16px', borderRadius: 10, background: simScenario === s.pattern ? 'var(--accent-subtle)' : 'var(--bg-primary)', border: simScenario === s.pattern ? '1px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}>{s.name}</span>
                    <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{s.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ ...card, padding: '18px 22px' }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 800, margin: '0 0 14px' }}>ESCALATION LOGIC</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { c: 'var(--accent)', t: 'Multi-Signal Confirmation', d: 'Requires 2+ abnormal signals before escalation — cuts false positives.' },
                { c: 'var(--warning)', t: 'Sustained Detection', d: 'Each level needs the signal held for several seconds before triggering.' },
                { c: 'var(--danger)', t: 'Confidence Gating', d: 'Higher levels need higher confidence (55% → 85%) to escalate.' },
                { c: 'var(--info)', t: 'Personal Baseline', d: 'Judged against THIS driver’s baseline, not a fixed threshold.' },
              ].map((row) => (
                <div key={row.t} style={{ padding: 10, borderRadius: 8, background: 'var(--bg-primary)' }}>
                  <span style={{ color: row.c, fontSize: 11, fontWeight: 700 }}>{row.t}</span>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 11, margin: '4px 0 0' }}>{row.d}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...card, padding: '18px 22px' }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 800, margin: '0 0 14px' }}>COMPLEMENTARY TO WORLD MODELS</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <span style={{ color: 'var(--info)', fontSize: 11, fontWeight: 700 }}>Road world models (e.g. V-JEPA)</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: 11, margin: '4px 0 0' }}>Predict the <strong>road/environment</strong>: “What will happen on the road?”</p>
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--accent-subtle)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <span style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 700 }}>Aura (ours)</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: 11, margin: '4px 0 0' }}>Predicts the <strong>driver</strong>: “Is the human fit to drive?”</p>
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg-primary)' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: 11, margin: 0, lineHeight: 1.5 }}>
                  When Aura detects drowsiness → autonomous fallback takes over driving. The hybrid future: human monitoring + safe autonomous pull-over.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
