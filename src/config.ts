// Resolves the Aura Core address so the SAME dashboard build can run on both laptops.
//
//   • System A (in-car head unit) runs Core locally → default 127.0.0.1.
//   • System B (Safety Monitor laptop) points at System A over Wi-Fi:
//       http://<systemB>:5173/monitor?core=192.168.1.23
//     The ?core=<ip> is remembered in localStorage, so you only pass it once.
//
// Core always listens on port 8765 (see aura-core/run.py, bound to 0.0.0.0).

const CORE_PORT = 8765;

function resolveCoreHost(): string {
  if (typeof window === 'undefined') return '127.0.0.1';
  const fromQuery = new URLSearchParams(window.location.search).get('core');
  if (fromQuery) {
    try { localStorage.setItem('aura_core_host', fromQuery); } catch { /* ignore */ }
    return fromQuery;
  }
  try {
    return localStorage.getItem('aura_core_host') || '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

export const CORE_HOST = resolveCoreHost();
export const CORE_HTTP = `http://${CORE_HOST}:${CORE_PORT}`;
export const CORE_WS = `ws://${CORE_HOST}:${CORE_PORT}/`;

// Which "surface" this screen is:
//   • 'a' = in-car head unit (default)      → Home, Agents, Copilot
//   • 'b' = Safety Monitor laptop (camera)  → Live Monitor, AutoCare
// System B launches with ?surface=b (remembered), e.g. /monitor?core=192.168.1.23&surface=b
export type Surface = 'a' | 'b';
function resolveSurface(): Surface {
  if (typeof window === 'undefined') return 'a';
  const q = new URLSearchParams(window.location.search).get('surface');
  if (q === 'a' || q === 'b') {
    try { localStorage.setItem('aura_surface', q); } catch { /* ignore */ }
    return q;
  }
  try {
    return localStorage.getItem('aura_surface') === 'b' ? 'b' : 'a';
  } catch {
    return 'a';
  }
}
export const SURFACE: Surface = resolveSurface();
