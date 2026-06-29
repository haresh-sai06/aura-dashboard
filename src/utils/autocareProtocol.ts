/**
 * AutoCare Protocol — Aura's preventive-safety escalation engine.
 *
 * Adapted for the Aura prototype from the DriveSafer-AI concept. When the on-device
 * driver-state score rises, Aura progressively takes control to prevent an accident —
 * the same escalation the Unity car demonstrates when it pulls itself over.
 *
 *   Level 0 — MONITORING : passive, baseline adaptation
 *   Level 1 — ADVISORY   : gentle alerts, haptic suggestion
 *   Level 2 — CORRECTIVE : lane-keeping, speed reduction
 *   Level 3 — PROTECTIVE : emergency slowdown, hazard lights
 *   Level 4 — EMERGENCY  : autonomous pull-over + emergency services (eCall)
 *
 * Escalation requires sustained, confidence-gated, multi-signal evidence to avoid
 * false alarms. Timings here are tuned for a live demo (seconds, not minutes).
 *
 * References: Euro NCAP 2025 DMS requirements; SAE J3016 automation levels;
 * world-model / predictive-state concepts (e.g. LeCun's JEPA).
 */

export type InterventionLevel = 0 | 1 | 2 | 3 | 4;

export interface AutocareState {
  level: InterventionLevel;
  levelName: string;
  activeInterventions: string[];
  escalationCountdown: number | null;
  deescalationCountdown: number | null;
  confidenceRequired: number;
  triggerSignals: string[];
  worldModelPrediction: string;
  autonomyPercentage: number;
  timeSinceLastEscalation: number;
}

interface SignalConfirmation {
  signal: string;
  timestamp: number;
  value: number;
  confirmed: boolean;
}

const LEVEL_CONFIG = {
  0: {
    name: 'MONITORING',
    interventions: ['Passive sensor monitoring', 'Baseline adaptation', 'Circadian risk assessment'],
    confidenceThreshold: 0,
    autonomyPct: 0,
    minDuration: 0,
    escalationDelay: 1500,
  },
  1: {
    name: 'ADVISORY',
    interventions: ['Audio alert tone', 'Dashboard warning light', 'Seat vibration (haptic)', 'Voice: "Consider taking a break"'],
    confidenceThreshold: 0.55,
    autonomyPct: 5,
    minDuration: 800,
    escalationDelay: 2000,
  },
  2: {
    name: 'CORRECTIVE',
    interventions: ['Lane-keeping assist ACTIVE', 'Adaptive cruise: speed -10 km/h', 'Window opens 2cm (fresh air)', 'Cabin light intensity +30%', 'Navigation: nearest rest stop shown'],
    confidenceThreshold: 0.65,
    autonomyPct: 30,
    minDuration: 1500,
    escalationDelay: 2500,
  },
  3: {
    name: 'PROTECTIVE',
    interventions: ['Emergency speed reduction to 40 km/h', 'Hazard lights ACTIVATED', 'All windows open', 'Continuous alarm tone', 'V2X: broadcast caution to nearby vehicles', 'Seatbelt pre-tensioner armed'],
    confidenceThreshold: 0.75,
    autonomyPct: 70,
    minDuration: 2000,
    escalationDelay: 3000,
  },
  4: {
    name: 'EMERGENCY',
    interventions: ['FULL AUTONOMOUS CONTROL', 'Gradual deceleration to 0 km/h', 'Steering to hard shoulder / safe zone', 'Hazard lights + horn pattern', 'Emergency services contacted (eCall)', 'Doors unlock after stop', 'Interior camera records for insurance'],
    confidenceThreshold: 0.85,
    autonomyPct: 100,
    minDuration: 2500,
    escalationDelay: 0,
  },
};

export class AutocareProtocol {
  private currentLevel: InterventionLevel = 0;
  private levelTimestamp = Date.now();
  private pendingSignals: SignalConfirmation[] = [];
  private scoreHistory: { score: number; timestamp: number }[] = [];
  private consecutiveHighFrames = 0;
  private worldModelState = 'Normal driving conditions';

  update(
    drowsinessScore: number,
    confidence: number,
    signals: { name: string; value: number; isAbnormal: boolean }[]
  ): AutocareState {
    const now = Date.now();
    this.scoreHistory.push({ score: drowsinessScore, timestamp: now });
    if (this.scoreHistory.length > 300) this.scoreHistory.shift();

    const abnormalSignals = signals.filter((s) => s.isAbnormal);
    const confirmedAbnormal = abnormalSignals.length >= 2;

    if (drowsinessScore > 45) {
      this.consecutiveHighFrames++;
    } else {
      this.consecutiveHighFrames = Math.max(0, this.consecutiveHighFrames - 2);
    }

    this.updateWorldModel(drowsinessScore, abnormalSignals);

    const targetLevel = this.computeTargetLevel(drowsinessScore, confidence, confirmedAbnormal);

    if (targetLevel > this.currentLevel) {
      this.escalate(targetLevel, abnormalSignals.map((s) => s.name));
    } else if (targetLevel < this.currentLevel && drowsinessScore < 20) {
      this.deescalate();
    }

    const config = LEVEL_CONFIG[this.currentLevel];
    const timeSinceEscalation = now - this.levelTimestamp;

    return {
      level: this.currentLevel,
      levelName: config.name,
      activeInterventions: config.interventions,
      escalationCountdown: null,
      deescalationCountdown: null,
      confidenceRequired: config.confidenceThreshold,
      triggerSignals: abnormalSignals.map((s) => `${s.name}: ${s.value.toFixed(2)}`),
      worldModelPrediction: this.worldModelState,
      autonomyPercentage: config.autonomyPct,
      timeSinceLastEscalation: timeSinceEscalation,
    };
  }

  private computeTargetLevel(score: number, confidence: number, confirmed: boolean): InterventionLevel {
    if (score >= 80 && confidence >= 0.85 && this.consecutiveHighFrames > 18) return 4;
    if (score >= 60 && confidence >= 0.75 && confirmed && this.consecutiveHighFrames > 12) return 3;
    if (score >= 45 && confidence >= 0.65 && confirmed && this.consecutiveHighFrames > 6) return 2;
    if (score >= 22 && confidence >= 0.55 && this.consecutiveHighFrames > 3) return 1;
    return 0;
  }

  private escalate(targetLevel: InterventionLevel, triggers: string[]): void {
    const config = LEVEL_CONFIG[this.currentLevel];
    const timeSince = Date.now() - this.levelTimestamp;
    if (timeSince < config.minDuration) return;

    this.currentLevel = Math.min(this.currentLevel + 1, targetLevel) as InterventionLevel;
    this.levelTimestamp = Date.now();

    this.pendingSignals.push(
      ...triggers.map((t) => ({ signal: t, timestamp: Date.now(), value: 1, confirmed: true }))
    );
  }

  private deescalate(): void {
    if (this.currentLevel === 0) return;
    const timeSince = Date.now() - this.levelTimestamp;
    const config = LEVEL_CONFIG[this.currentLevel];
    if (timeSince > config.minDuration * 2) {
      this.currentLevel = Math.max(0, this.currentLevel - 1) as InterventionLevel;
      this.levelTimestamp = Date.now();
    }
  }

  private updateWorldModel(score: number, abnormalSignals: { name: string; value: number; isAbnormal: boolean }[]): void {
    const recentScores = this.scoreHistory.slice(-30);
    const avgScore = recentScores.reduce((s, e) => s + e.score, 0) / recentScores.length;
    const trend =
      recentScores.length > 10
        ? (recentScores[recentScores.length - 1].score - recentScores[0].score) / recentScores.length
        : 0;

    if (score > 70) {
      this.worldModelState = 'CRITICAL: Driver incapacitation predicted within 2-5 minutes. World model recommends immediate autonomous takeover.';
    } else if (score > 50 && trend > 0.5) {
      this.worldModelState = 'WARNING: Fatigue trajectory indicates drowsiness onset in ~10 minutes. Predictive model recommends preemptive intervention.';
    } else if (score > 30 && abnormalSignals.length > 0) {
      this.worldModelState = `CAUTION: ${abnormalSignals[0].name} anomaly detected. Internal world model monitoring for confirmation signals.`;
    } else if (avgScore > 20) {
      this.worldModelState = 'ADVISORY: Mild fatigue indicators present. World model maintaining elevated monitoring state.';
    } else {
      this.worldModelState = 'NOMINAL: All signals within expected parameters. World model predicts safe driving conditions.';
    }
  }

  getLevel(): InterventionLevel {
    return this.currentLevel;
  }

  reset(): void {
    this.currentLevel = 0;
    this.levelTimestamp = Date.now();
    this.pendingSignals = [];
    this.consecutiveHighFrames = 0;
    this.scoreHistory = [];
    this.worldModelState = 'Normal driving conditions';
  }
}

export const LEVEL_DESCRIPTIONS = LEVEL_CONFIG;
