import { useEffect, useRef } from 'react';
import { useAura } from '../AuraContext';
import { speak } from '../utils/voice';
import { SURFACE } from '../config';

/**
 * Head-unit voice — Aura speaks to the driver IN THE CAR (System A), driven by the live bus
 * rather than by any single screen. This matters now that AutoCare lives on the Safety Monitor
 * (System B): the spoken co-pilot must still come from the head unit.
 *
 * Sources (all from Aura Core):
 *   • countermeasure  → graded advisories at levels 1–3 (the multi-agent Wellness actions)
 *   • safety.alert    → the takeover ("pulling over")
 *   • safety.clear    → handback ("you're alert again")
 *
 * Renders nothing; only active on the head-unit surface so the monitor laptop stays quiet.
 */
function levelLine(level: number, name?: string): string {
  const who = name ? `${name}, ` : '';
  switch (level) {
    case 1: return `${who}I'm noticing early signs of fatigue. Consider taking a short break.`;
    case 2: return `${who}fatigue confirmed. I'm easing off the speed and holding the lane. Please respond.`;
    case 3: return `${who}you're not responding. Hazard lights on — I'm preparing to pull over.`;
    default: return '';
  }
}

export default function HeadUnitVoice() {
  const { alert, countermeasure, driver } = useAura();
  const prevCmLevel = useRef<number | null>(null);
  const prevAlert = useRef(false);

  // Graded escalation (levels 1–3) from the Wellness agent's countermeasures.
  useEffect(() => {
    if (SURFACE !== 'a' || !countermeasure) return;
    const lvl = countermeasure.level;
    if (typeof lvl === 'number' && lvl !== prevCmLevel.current && lvl >= 1 && lvl <= 3) {
      speak(levelLine(lvl, countermeasure.driver ?? driver?.name), { rate: lvl >= 3 ? 1.03 : 0.98 });
      prevCmLevel.current = lvl;
    }
  }, [countermeasure, driver]);

  // The takeover + handback.
  useEffect(() => {
    if (SURFACE !== 'a') return;
    const on = !!alert;
    const name = driver?.name ? `${driver.name}, ` : '';
    if (on && !prevAlert.current) {
      speak(`${name}engaging a safe stop now. Pulling over.`, { rate: 1.03 });
      prevCmLevel.current = null;
    } else if (!on && prevAlert.current) {
      speak(`${name}you're alert again. Handing control back to you.`);
      prevCmLevel.current = null;
    }
    prevAlert.current = on;
  }, [alert, driver]);

  return null;
}
