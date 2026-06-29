// Feature extractors operating on MediaPipe FaceMesh landmarks (normalized coords).
// Formulas match DriveSafer-AI so the calibrated thresholds in drowsinessModel transfer.

export type LM = { x: number; y: number; z: number };

const dist = (a: LM, b: LM) => Math.hypot(a.x - b.x, a.y - b.y);

/** Eye Aspect Ratio — low when eyes close. Average of both eyes. */
export function calculateEAR(lm: LM[]): number {
  const A = dist(lm[385], lm[380]);
  const B = dist(lm[387], lm[373]);
  const C = dist(lm[362], lm[263]);
  const leftEAR = (A + B) / (2.0 * C);

  const D = dist(lm[160], lm[144]);
  const E = dist(lm[158], lm[153]);
  const F = dist(lm[33], lm[133]);
  const rightEAR = (D + E) / (2.0 * F);

  return (leftEAR + rightEAR) / 2.0;
}

/** Mouth Aspect Ratio — high when yawning. */
export function calculateMAR(lm: LM[]): number {
  const H1 = dist(lm[0], lm[17]);
  const H2 = dist(lm[13], lm[14]);
  const W = dist(lm[61], lm[291]);
  return (H1 + H2) / (2.0 * W);
}

export interface HeadPose {
  pitch: number;
  yaw: number;
  roll: number;
  isDistracted: boolean;
}

const NOSE_TIP = 1;
const CHIN = 152;
const LEFT_EYE_OUTER = 263;
const RIGHT_EYE_OUTER = 33;
const FOREHEAD = 10;

/** Approximate head pitch/yaw/roll from facial geometry. */
export function estimateHeadPose(lm: LM[]): HeadPose {
  const nose = lm[NOSE_TIP];
  const chin = lm[CHIN];
  const leftEye = lm[LEFT_EYE_OUTER];
  const rightEye = lm[RIGHT_EYE_OUTER];
  const forehead = lm[FOREHEAD];

  const eyeCenter = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };

  const yaw = (nose.x - eyeCenter.x) * 180;
  const noseVerticalRatio = (nose.y - forehead.y) / (chin.y - forehead.y);
  const pitch = (noseVerticalRatio - 0.4) * 120;
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

  const isDistracted = Math.abs(yaw) > 40 || Math.abs(pitch) > 35 || Math.abs(roll) > 30;
  return { pitch, yaw, roll, isDistracted };
}

/** Iris-based gaze direction (requires refineLandmarks). */
export function getGazeDirection(lm: LM[]): { x: number; y: number; direction: string } {
  const leftIris = lm[468];
  const rightIris = lm[473];
  if (!leftIris || !rightIris) return { x: 0.5, y: 0.5, direction: 'CENTER' };

  const leftGazeX = (leftIris.x - lm[263].x) / (lm[362].x - lm[263].x);
  const rightGazeX = (rightIris.x - lm[33].x) / (lm[133].x - lm[33].x);
  const leftGazeY = (leftIris.y - lm[386].y) / (lm[374].y - lm[386].y);
  const rightGazeY = (rightIris.y - lm[159].y) / (lm[145].y - lm[159].y);

  const gazeX = (leftGazeX + rightGazeX) / 2;
  const gazeY = (leftGazeY + rightGazeY) / 2;

  let direction = 'CENTER';
  if (gazeX < 0.35) direction = 'LEFT';
  else if (gazeX > 0.65) direction = 'RIGHT';
  if (gazeY < 0.3) direction = 'UP';
  else if (gazeY > 0.7) direction = 'DOWN';

  return { x: gazeX, y: gazeY, direction };
}
