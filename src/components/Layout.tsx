import { NavLink, Outlet } from 'react-router-dom';
import { Home, Activity, ShieldCheck, Bot } from 'lucide-react';
import { useAura } from '../AuraContext';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/monitor', label: 'Live Monitor', icon: Activity, end: false },
  { to: '/autocare', label: 'AutoCare AI', icon: ShieldCheck, end: false },
  { to: '/copilot', label: 'Aura Copilot', icon: Bot, end: false },
];

export default function Layout() {
  const { connected } = useAura();

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 8px 22px',
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: 1,
            color: 'var(--text-primary)',
          }}
        >
          <span style={{ color: 'var(--accent)' }}>◆</span> AURA
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                background: isActive ? 'var(--accent-subtle)' : 'transparent',
              })}
            >
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            fontSize: 12,
            color: 'var(--text-tertiary)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: connected ? 'var(--success)' : 'var(--text-tertiary)',
              boxShadow: connected ? '0 0 8px var(--success)' : 'none',
            }}
          />
          {connected ? 'Edge brain online' : 'Offline'}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: 24, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
