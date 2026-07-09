// On-device geometric Face-ID signature from MediaPipe Face Mesh landmarks.
//
// This is a lightweight, PRIVATE identity signal: we turn the 468 face landmarks into a small
// vector of pose-normalized facial *ratios* (eye spacing, nose length, mouth width, jaw, …),
// scaled by face width so it is roughly invariant to distance and position. Only these numbers
// ever leave the browser — never an image. It is a Phase-1 prototype; a production system would
// use a CNN face-embedding (see ROADMAP), but this is enough to recognise a handful of enrolled
// drivers on sit-down entirely on-device.

import type { LM } from './faceMetrics';

const W = 640;
const H = 480;

function dist(a: LM, b: LM): number {
  const dx = (a.x - b.x) * W;
  const dy = (a.y - b.y) * H;
  return Math.hypot(dx, dy);
}

// (landmarkA, landmarkB) pairs whose distance/faceWidth is reasonably person-distinctive.
const PAIRS: [number, number][] = [
  [33, 133],   // right eye width
  [362, 263],  // left eye width
  [133, 362],  // inter-ocular
  [10, 152],   // face height (brow-top to chin)
  [168, 2],    // nose length (bridge to base)
  [61, 291],   // mouth width
  [13, 14],    // lip gap
  [105, 334],  // brow span
  [172, 397],  // jaw width
  [159, 105],  // eye-to-brow (brow height)
  [2, 152],    // nose-base to chin
  [133, 13],   // eye to mouth
];

/**
 * Compute a normalized signature vector from Face Mesh landmarks, or null if the mesh is
 * incomplete. Returns ~12 scale-invariant ratios.
 */
export function computeFaceSignature(lm: LM[]): number[] | null {
  if (!lm || lm.length < 468) return null;
  const faceW = dist(lm[234], lm[454]);
  if (!isFinite(faceW) || faceW < 1) return null;
  const out: number[] = [];
  for (const [a, b] of PAIRS) {
    const v = dist(lm[a], lm[b]) / faceW;
    if (!isFinite(v)) return null;
    out.push(Number(v.toFixed(4)));
  }
  return out;
}

/**
 * Exponentially-smoothed running signature — reduces per-frame jitter so enrollment and
 * recognition compare stable vectors.
 */
export class SignatureSmoother {
  private ewma: number[] | null = null;
  private readonly alpha: number;
  constructor(alpha = 0.2) { this.alpha = alpha; }

  update(sig: number[] | null): number[] | null {
    if (!sig) return this.ewma;
    if (!this.ewma || this.ewma.length !== sig.length) {
      this.ewma = sig.slice();
    } else {
      this.ewma = this.ewma.map((v, i) => (1 - this.alpha) * v + this.alpha * sig[i]);
    }
    return this.ewma;
  }

  get value(): number[] | null { return this.ewma; }
  reset() { this.ewma = null; }
}
