// Multi-signal drowsiness fusion (ported from DriveSafer-AI). A weighted ensemble of seven
// research-grounded signals → 0-100 score + level + per-factor breakdown (explainability).

export interface DrowsinessInput {
  ear: number;
  mar: number;
  headPitch: number;
  headYaw: number;
  blinkRate: number;
  blinkDuration: number;
  perclos: number;
  gazeStability: number;
}

export interface DrowsinessFactor {
  name: string;
  contribution: number;
  value: number;
}

export interface DrowsinessOutput {
  score: number;
  level: 'ALERT' | 'MILD' | 'MODERATE' | 'SEVERE';
  confidence: number;
  factors: DrowsinessFactor[];
}

const WEIGHTS = {
  perclos: 0.3,
  ear: 0.2,
  blinkDuration: 0.15,
  mar: 0.1,
  headPitch: 0.1,
  blinkRate: 0.08,
  gazeStability: 0.07,
};

export function computeDrowsinessScore(input: DrowsinessInput): DrowsinessOutput {
  const perclosScore = input.perclos > 0.15 ? Math.min((input.perclos - 0.15) * 200, 100) : 0;
  const earScore = input.ear < 0.22 ? Math.min((0.22 - input.ear) * 500, 100) : 0;
  const blinkDurationScore = input.blinkDuration > 300 ? Math.min((input.blinkDuration - 300) * 0.5, 100) : 0;
  const marScore = input.mar > 0.6 ? Math.min((input.mar - 0.6) * 250, 100) : 0;
  const headPitchScore = Math.abs(input.headPitch) > 20 ? Math.min((Math.abs(input.headPitch) - 20) * 4, 100) : 0;

  const normalBlinkRate = 15;
  const blinkDeviation = Math.abs(input.blinkRate - normalBlinkRate);
  const blinkRateScore = blinkDeviation > 10 ? Math.min((blinkDeviation - 10) * 6, 100) : 0;

  const gazeScore = input.gazeStability < 0.5 ? Math.min((0.5 - input.gazeStability) * 200, 100) : 0;

  const factors: DrowsinessFactor[] = [
    { name: 'PERCLOS', contribution: WEIGHTS.perclos, value: perclosScore },
    { name: 'Eye Closure', contribution: WEIGHTS.ear, value: earScore },
    { name: 'Blink Duration', contribution: WEIGHTS.blinkDuration, value: blinkDurationScore },
    { name: 'Yawning', contribution: WEIGHTS.mar, value: marScore },
    { name: 'Head Nodding', contribution: WEIGHTS.headPitch, value: headPitchScore },
    { name: 'Blink Rate', contribution: WEIGHTS.blinkRate, value: blinkRateScore },
    { name: 'Gaze Stability', contribution: WEIGHTS.gazeStability, value: gazeScore },
  ];

  const weightedScore =
    WEIGHTS.perclos * perclosScore +
    WEIGHTS.ear * earScore +
    WEIGHTS.blinkDuration * blinkDurationScore +
    WEIGHTS.mar * marScore +
    WEIGHTS.headPitch * headPitchScore +
    WEIGHTS.blinkRate * blinkRateScore +
    WEIGHTS.gazeStability * gazeScore;

  const score = Math.min(100, Math.max(0, weightedScore));

  const signalVariance =
    factors.map((f) => f.value).reduce((sum, v) => sum + Math.pow(v - score, 2), 0) / factors.length;
  const confidence = Math.max(0.4, 1 - signalVariance / 5000);

  let level: DrowsinessOutput['level'] = 'ALERT';
  if (score > 70) level = 'SEVERE';
  else if (score > 45) level = 'MODERATE';
  else if (score > 20) level = 'MILD';

  return { score, level, confidence, factors };
}

export class BlinkDetector {
  private earHistory: number[] = [];
  private blinkTimestamps: number[] = [];
  private blinkDurations: number[] = [];
  private isBlinking = false;
  private blinkStartTime = 0;
  private totalFrames = 0;
  private earThreshold = 0.22;

  update(ear: number, timestamp: number) {
    this.earHistory.push(ear);
    this.totalFrames++;
    if (this.earHistory.length > 300) this.earHistory.shift();

    const isClosed = ear < this.earThreshold;
    if (isClosed) {
      if (!this.isBlinking) {
        this.isBlinking = true;
        this.blinkStartTime = timestamp;
      }
    } else if (this.isBlinking) {
      const duration = timestamp - this.blinkStartTime;
      if (duration > 50 && duration < 800) {
        this.blinkTimestamps.push(timestamp);
        this.blinkDurations.push(duration);
        if (this.blinkDurations.length > 30) this.blinkDurations.shift();
      }
      this.isBlinking = false;
    }

    const cutoff = timestamp - 60000;
    this.blinkTimestamps = this.blinkTimestamps.filter((t) => t > cutoff);
  }

  getBlinkRate(): number {
    if (this.blinkTimestamps.length < 2) return 15;
    const span = (this.blinkTimestamps[this.blinkTimestamps.length - 1] - this.blinkTimestamps[0]) / 1000;
    return span > 0 ? (this.blinkTimestamps.length / span) * 60 : 15;
  }

  getAvgBlinkDuration(): number {
    if (this.blinkDurations.length === 0) return 150;
    return this.blinkDurations.reduce((a, b) => a + b, 0) / this.blinkDurations.length;
  }

  getPERCLOS(): number {
    if (this.totalFrames < 30) return 0;
    const recent = this.earHistory.slice(-150);
    const closed = recent.filter((e) => e < this.earThreshold).length;
    return closed / recent.length;
  }

  setThreshold(threshold: number) {
    this.earThreshold = threshold;
  }
}

export class GazeStabilityTracker {
  private history: { x: number; y: number; t: number }[] = [];

  update(gazeX: number, gazeY: number, timestamp: number) {
    this.history.push({ x: gazeX, y: gazeY, t: timestamp });
    const cutoff = timestamp - 3000;
    this.history = this.history.filter((g) => g.t > cutoff);
  }

  getStability(): number {
    if (this.history.length < 10) return 1;
    const xs = this.history.map((g) => g.x);
    const ys = this.history.map((g) => g.y);
    const total = variance(xs) + variance(ys);
    return Math.max(0, 1 - total * 50);
  }
}

function variance(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
}
