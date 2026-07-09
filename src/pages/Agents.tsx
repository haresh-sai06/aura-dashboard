import type { CSSProperties } from 'react';
import { useAura, type AgentNode } from '../AuraContext';
import { glass, glassStrong, label, mono, Chip } from '../ui';
import {
  Eye, TrendingUp, MapPin, Shield, CheckCheck, Workflow, HeartPulse, Brain, Bot,
  Activity, AlertTriangle, Gauge,
} from 'lucide-react';

const CORE_ICON: Record<string, typeof Eye> = {
  perception: Eye, forecast: TrendingUp, context: MapPin, policy: Shield,
  critic: CheckCheck, orchestrator: Workflow, wellness: HeartPulse, reasoning: Brain, copilot: Bot,
};

// Fixed graph coordinates (viewBox 1000 x 560). Cards use the same space as % so edges align
// at any size (SVG uses preserveAspectRatio="none").
const POS: Record<string, [number, number]> = {
  perception: [165, 105], forecast: [165, 280], context: [165, 455],
  policy: [500, 105], orchestrator: [500, 280], critic: [500, 455],
  wellness: [835, 105], reasoning: [835, 280], copilot: [835, 455],
};
const EDGES: [string, string][] = [
  ['perception', 'forecast'], ['perception', 'policy'], ['forecast', 'orchestrator'],
  ['context', 'orchestrator'], ['policy', 'orchestrator'], ['orchestrator', 'critic'],
  ['critic', 'orchestrator'], ['orchestrator', 'wellness'], ['orchestrator', 'reasoning'],
  ['orchestrator', 'copilot'],
];

const IDLE_NODES: AgentNode[] = Object.entries(POS).map(([id]) => ({
  id, label: id[0].toUpperCase() + id.slice(1), group: '', status: 'idle', note: 'Waiting for the edge brain…',
}));

function statusColor(status: string): string {
  switch (status) {
    case 'firing': return 'var(--accent)';
    case 'active': return 'var(--info)';
    case 'ok': return 'var(--success)';
    case 'veto': return 'var(--danger)';
    default: return 'var(--text-tertiary)';
  }
}

const RISK_COLOR: Record<string, string> = {
  nominal: 'var(--success)', elevated: 'var(--warning)', imminent: 'var(--danger)',
};

export default function Agents() {
  const { orchestration, forecast, connected } = useAura();
  const nodes = orchestration?.nodes?.length ? orchestration.nodes : IDLE_NODES;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const level = orchestration?.level ?? 0;
  const fc = forecast ?? orchestration?.forecast ?? null;

  const bezier = (a: [number, number], b: [number, number]) => {
    const [x1, y1] = a, [x2, y2] = b;
    if (Math.abs(x1 - x2) > 80) {
      const mx = (x1 + x2) / 2;
      return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
    }
    // vertical / same-column: bow out to the side so back-edges are visible
    const off = y2 > y1 ? 70 : -70;
    return `M ${x1} ${y1} C ${x1 + off} ${(y1 + y2) / 2}, ${x2 + off} ${(y1 + y2) / 2}, ${x2} ${y2}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Workflow size={22} style={{ color: 'var(--accent)' }} /> Multi-Agent Orchestration
          </h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4 }}>
            Nine specialist agents on one bus — the Supervisor sequences them as risk rises. Live, on-device.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Chip color={connected ? 'var(--success)' : 'var(--text-tertiary)'}>
            <Activity size={12} /> {connected ? 'Edge brain live' : 'Offline'}
          </Chip>
          {orchestration && (
            <Chip color={level >= 3 ? 'var(--danger)' : level >= 1 ? 'var(--warning)' : 'var(--success)'} tone="solid">
              L{level} · {orchestration.levelName}
            </Chip>
          )}
          {orchestration && <Chip>cycle #{orchestration.cycle}</Chip>}
        </div>
      </div>

      {/* Predictive world model strip (feature C) */}
      <div style={{ ...glass, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={16} style={{ color: 'var(--info)' }} />
          <span style={label}>Predictive World Model</span>
        </div>
        <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, flex: 1, minWidth: 240 }}>
          {fc ? fc.horizonText : 'No signal yet — start the Live Monitor or a scenario.'}
        </span>
        {fc && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Chip color={RISK_COLOR[fc.risk] ?? 'var(--text-secondary)'} tone="solid">{String(fc.risk).toUpperCase()}</Chip>
            <Chip color="var(--text-secondary)">
              <Gauge size={12} /> trend {fc.trend}
            </Chip>
            {fc.secondsToThreshold != null && (
              <Chip color="var(--warning)"><span style={mono}>~{fc.secondsToThreshold}s</span> to line</Chip>
            )}
          </div>
        )}
      </div>

      {/* The agent graph */}
      <div style={{ ...glass, flex: 1, minHeight: 420, position: 'relative', overflow: 'hidden', padding: 0 }}>
        {/* lane headers */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none', zIndex: 0 }}>
          {['SENSING', 'DECISION', 'ACTION'].map((lane, i) => (
            <div key={lane} style={{ flex: 1, borderRight: i < 2 ? '1px dashed var(--glass-border)' : 'none', display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
              <span style={{ ...label, opacity: 0.5 }}>{lane}</span>
            </div>
          ))}
        </div>

        {/* edges */}
        <svg viewBox="0 0 1000 560" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}>
          {EDGES.map(([from, to], i) => {
            const s = byId[from], t = byId[to];
            const engaged = s && t && s.status !== 'idle' && t.status !== 'idle';
            const col = statusColor(s?.status ?? 'idle');
            return (
              <path
                key={i}
                d={bezier(POS[from], POS[to])}
                fill="none"
                stroke={engaged ? col : 'var(--glass-border)'}
                strokeWidth={engaged ? 2.4 : 1.4}
                strokeOpacity={engaged ? 0.9 : 0.4}
                strokeDasharray={engaged ? '6 8' : undefined}
                style={engaged ? { animation: 'dashFlow 0.8s linear infinite' } : undefined}
              />
            );
          })}
        </svg>

        {/* nodes */}
        {nodes.map((n) => {
          const [cx, cy] = POS[n.id] ?? [500, 280];
          const Icon = CORE_ICON[n.id] ?? Workflow;
          const col = statusColor(n.status);
          const firing = n.status === 'firing' || n.status === 'ok' || n.status === 'veto';
          const cardStyle: CSSProperties = {
            position: 'absolute',
            left: `${(cx / 1000) * 100}%`,
            top: `${(cy / 560) * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: 236, zIndex: 2,
            ...glassStrong,
            padding: '12px 14px',
            border: `1.5px solid ${firing ? col : 'var(--glass-border)'}`,
            boxShadow: firing ? `0 0 0 1px ${col}, 0 0 22px color-mix(in srgb, ${col} 40%, transparent)` : 'var(--elev-1)',
            transition: 'border-color 0.3s, box-shadow 0.3s',
          };
          return (
            <div key={n.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: `color-mix(in srgb, ${col} 18%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} style={{ color: col }} />
                </span>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{n.label}</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, boxShadow: firing ? `0 0 8px ${col}` : 'none', animation: firing ? 'pulse 1.1s infinite' : 'none' }} />
              </div>
              <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: 'var(--text-secondary)', minHeight: 33 }}>{n.note}</p>
            </div>
          );
        })}
      </div>

      {/* Supervisor decision + countermeasures */}
      <div style={{ ...glassStrong, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderLeft: `3px solid ${level >= 3 ? 'var(--danger)' : level >= 1 ? 'var(--warning)' : 'var(--accent)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200, flex: 1 }}>
          {level >= 3 ? <AlertTriangle size={20} style={{ color: 'var(--danger)' }} /> : <Workflow size={20} style={{ color: 'var(--accent)' }} />}
          <div>
            <div style={{ ...label, marginBottom: 2 }}>Supervisor decision</div>
            <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
              {orchestration?.decision ?? 'Awaiting the first decision cycle…'}
            </div>
          </div>
        </div>
        {orchestration?.vetoed && <Chip color="var(--danger)"><CheckCheck size={12} /> Critic vetoed takeover</Chip>}
        {orchestration?.actions?.map((a, i) => (
          <Chip key={i} color="var(--accent)">{a.detail}</Chip>
        ))}
      </div>
    </div>
  );
}
