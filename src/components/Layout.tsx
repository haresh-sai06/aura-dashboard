import { NavLink, Outlet } from 'react-router-dom';
import { Home, Activity, ShieldCheck, Bot, Workflow, Fingerprint } from 'lucide-react';
import { useAura } from '../AuraContext';
import { AuraOrb } from '../ui';
import { SURFACE } from '../config';
import HeadUnitVoice from './HeadUnitVoice';

// System A — in-car head unit: clean, driver-facing.
const HEAD_UNIT_NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/agents', label: 'Agents', icon: Workflow, end: false },
  { to: '/copilot', label: 'Aura Copilot', icon: Bot, end: false },
];

// System B — Safety Monitor laptop (camera): the perception + safety views.
const MONITOR_NAV = [
  { to: '/monitor', label: 'Live Monitor', icon: Activity, end: false },
  { to: '/autocare', label: 'AutoCare AI', icon: ShieldCheck, end: false },
  { to: '/dna', label: 'Driver DNA', icon: Fingerprint, end: false },
];

// Head unit by default; System B opts in with ?surface=b (see config.ts).
const NAV = SURFACE === 'b' ? MONITOR_NAV : HEAD_UNIT_NAV;

export default function Layout() {
  const { connected } = useAura();

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <HeadUnitVoice />
      <aside
        style={{
          width: 232,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03), transparent)',
          display: 'flex',
          flexDirection: 'column',
          padding: '22px 16px',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 6px 26px' }}>
          <AuraOrb size={34} />
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: 3, color: 'var(--text-primary)', lineHeight: 1 }}>AURA</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 3 }}>Edge AI Co-Pilot</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 14px',
                borderRadius: 14,
                fontSize: 13.5,
                fontWeight: 600,
                textDecoration: 'none',
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                background: isActive ? 'var(--glass-strong)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--glass-border)' : 'transparent'}`,
                boxShadow: isActive ? 'var(--elev-1)' : 'none',
                transition: 'background 0.2s, color 0.2s',
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, borderRadius: 2, background: 'var(--accent-grad)', boxShadow: 'var(--glow)' }} />
                  )}
                  <Icon size={17} style={{ color: isActive ? 'var(--accent)' : 'var(--text-tertiary)' }} /> {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Status footer */}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--glass-border)', fontSize: 12, color: 'var(--text-secondary)' }}>
          <span
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: connected ? 'var(--success)' : 'var(--text-tertiary)',
              boxShadow: connected ? '0 0 10px var(--success)' : 'none',
              animation: connected ? 'pulse 2s infinite' : 'none',
            }}
          />
          {connected ? 'Edge brain online' : 'Reconnecting…'}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: 26, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
