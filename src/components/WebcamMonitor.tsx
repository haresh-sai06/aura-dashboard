import { useCallback, useRef, useState, type CSSProperties } from 'react';
import type { Results } from '@mediapipe/face_mesh';
import { useFaceMesh } from '../hooks/useFaceMesh';
import { calculateEAR, calculateMAR, estimateHeadPose, getGazeDirection, type LM } from '../utils/faceMetrics';
import { computeDrowsinessScore, BlinkDetector, GazeStabilityTracker } from '../utils/drowsinessModel';
import { predictDrowsiness } from '../utils/tinyMLModel';
import { computeFaceSignature, SignatureSmoother } from '../utils/faceSignature';
import { CORE_HTTP } from '../config';

const CORE = CORE_HTTP;
const LEFT_CONTOUR = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 362];
const RIGHT_CONTOUR = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33];
const W = 640;
const H = 480;

async function post(path: string, body?: object): Promise<string> {
  try {
    const r = await fetch(CORE + path, {
      method: 'POST',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    return await r.text();
  } catch {
    return '';
  }
}

interface Props {
  /** Score above this (sustained) is reported to Aura Core, which applies the driver's personal threshold. */
  reportThreshold?: number;
}

/**
 * The in-cabin camera, rendered inside the dashboard. Runs MediaPipe + the full 7-signal
 * drowsiness pipeline locally (on-device, no cloud), then feeds Aura Core — which applies the
 * driver's PERSONAL adaptive threshold and drives the Unity car + every dashboard panel.
 */
export default function WebcamMonitor({ reportThreshold = 35 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [score, setScore] = useState(0);
  const [closed, setClosed] = useState(false);
  const [hasFace, setHasFace] = useState(false);

  const blink = useRef(new BlinkDetector());
  const gaze = useRef(new GazeStabilityTracker());
  const facePresent = useRef(false);
  const drowsySince = useRef<number | null>(null);
  const alerted = useRef(false);
  const lastReport = useRef(0);
  const lastState = useRef(0);

  // Face-ID + vision-LLM state.
  const sig = useRef(new SignatureSmoother());
  const lastRecognize = useRef(0);
  const lastVision = useRef(0);
  const autoIdRef = useRef(true);
  const [autoId, setAutoId] = useState(true);
  autoIdRef.current = autoId;
  const [recognized, setRecognized] = useState<string | null>(null);
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);
  const [visionBusy, setVisionBusy] = useState(false);

  // Capture the current frame and ask the vision-LLM to describe it (out of the safety loop).
  const captureScene = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.readyState < 2) return;
    const c = document.createElement('canvas');
    c.width = 512; c.height = 384;
    const cx = c.getContext('2d');
    if (!cx) return;
    cx.drawImage(v, 0, 0, c.width, c.height);
    const image = c.toDataURL('image/jpeg', 0.6);
    setVisionBusy(true);
    void post('/vision/scene', { image, kind: 'cabin' }).finally(() => setVisionBusy(false));
  }, []);
  const captureSceneRef = useRef(captureScene);
  captureSceneRef.current = captureScene;

  // Enroll the current face signature for whoever is the active driver (server-side default).
  const enrollFace = useCallback(() => {
    const s = sig.current.value;
    if (!s) { setEnrollMsg('No face detected'); setTimeout(() => setEnrollMsg(null), 2000); return; }
    void post('/driver/enroll', { signature: s }).then((t) => {
      let ok = false;
      try { ok = JSON.parse(t)?.ok; } catch { /* ignore */ }
      setEnrollMsg(ok ? 'Face enrolled ✓' : 'Enroll failed');
      setTimeout(() => setEnrollMsg(null), 2500);
    });
  }, []);

  const onResults = useCallback(
    (results: Results) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, W, H);
      const now = Date.now();
      const faces = results.multiFaceLandmarks;

      if (faces && faces.length > 0) {
        const lm = faces[0] as unknown as LM[];
        if (!facePresent.current) {
          facePresent.current = true;
          setHasFace(true);
          void post('/emit/identify');
        }

        // --- Face-ID: geometric signature (numbers only, never an image) ---
        const faceSig = sig.current.update(computeFaceSignature(lm));
        if (autoIdRef.current && faceSig && now - lastRecognize.current > 2500) {
          lastRecognize.current = now;
          void post('/driver/recognize', { signature: faceSig }).then((t) => {
            try {
              const r = JSON.parse(t);
              if (r?.match) setRecognized(`${r.name} · ${Math.round((r.confidence ?? 0) * 100)}%`);
              else setRecognized(null);
            } catch { /* ignore */ }
          });
        }

        // --- Vision-LLM scene understanding, periodically (out of the safety loop) ---
        if (now - lastVision.current > 12000) {
          lastVision.current = now;
          captureSceneRef.current();
        }

        // --- Feature extraction ---
        const ear = calculateEAR(lm);
        const mar = calculateMAR(lm);
        const pose = estimateHeadPose(lm);
        const g = getGazeDirection(lm);
        blink.current.update(ear, now);
        gaze.current.update(g.x, g.y, now);

        const perclos = blink.current.getPERCLOS();
        const blinkRate = blink.current.getBlinkRate();
        const blinkDuration = blink.current.getAvgBlinkDuration();
        const gazeStability = gaze.current.getStability();

        // --- 7-signal fusion + TinyML second opinion ---
        const fused = computeDrowsinessScore({
          ear, mar, headPitch: pose.pitch, headYaw: pose.yaw,
          blinkRate, blinkDuration, perclos, gazeStability,
        });
        const ml = predictDrowsiness(ear, mar, perclos, pose.pitch, blinkRate, blinkDuration, gazeStability);

        setScore(fused.score);
        setClosed(ear < 0.22);

        // --- Drowsy-episode detection (Core makes the final personal-threshold call) ---
        if (fused.score > reportThreshold) {
          if (drowsySince.current === null) drowsySince.current = now;
          if (now - drowsySince.current > 1000 && now - lastReport.current >= 400) {
            lastReport.current = now;
            void post(`/emit/drowsy?score=${fused.score.toFixed(0)}`).then((t) => {
              if (t.includes('safety.alert')) alerted.current = true;
            });
          }
        } else {
          drowsySince.current = null;
          if (fused.score < 20 && alerted.current) {
            void post('/emit/resume');
            alerted.current = false;
          }
        }

        // --- Rich live state for the Live Monitor (throttled) ---
        if (now - lastState.current >= 200) {
          lastState.current = now;
          void post('/emit/state', {
            facePresent: true,
            ear, mar, perclos,
            headPitch: pose.pitch, headYaw: pose.yaw, headRoll: pose.roll,
            gazeStability, gazeDirection: g.direction,
            blinkRate, blinkDuration,
            score: fused.score, level: fused.level, factors: fused.factors,
            ml: { class: ml.class, confidence: ml.confidence },
          });
        }

        if (ctx) drawEyes(ctx, lm, ear < 0.22);
      } else {
        if (facePresent.current) {
          facePresent.current = false;
          setHasFace(false);
          sig.current.reset();
          setRecognized(null);
        }
        if (alerted.current) {
          void post('/emit/resume');
          alerted.current = false;
        }
        drowsySince.current = null;
        if (now - lastState.current >= 200) {
          lastState.current = now;
          void post('/emit/state', { facePresent: false, score: 0 });
        }
      }
    },
    [reportThreshold]
  );

  useFaceMesh(videoRef, onResults);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', borderRadius: 8, overflow: 'hidden', minHeight: 0 }}>
      <video ref={videoRef} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      <canvas ref={canvasRef} width={W} height={H} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', pointerEvents: 'none' }} />

      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.6)', color: score > 45 ? 'var(--danger)' : score > 20 ? 'var(--warning)' : 'var(--success)' }}>
          RISK {Math.round(score)}
        </span>
        <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: 'rgba(0,0,0,0.6)', color: closed ? 'var(--danger)' : 'var(--text-secondary)' }}>
          {closed ? 'EYES CLOSED' : 'EYES OPEN'}
        </span>
      </div>
      {recognized && (
        <div style={{ position: 'absolute', top: 12, right: 12, padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(0,0,0,0.6)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} /> Face-ID: {recognized}
        </div>
      )}

      {!hasFace && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          Looking for a face… (allow camera access)
        </div>
      )}

      {/* Face-ID + Vision controls */}
      <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={enrollFace} style={ctrlBtn()}>Enroll face</button>
        <button onClick={() => setAutoId((a) => !a)} style={ctrlBtn(autoId ? 'var(--success)' : 'var(--text-tertiary)')}>
          Auto-ID {autoId ? 'ON' : 'OFF'}
        </button>
        <button onClick={() => captureSceneRef.current()} disabled={visionBusy} style={ctrlBtn(visionBusy ? 'var(--text-tertiary)' : 'var(--accent)')}>
          {visionBusy ? 'Reading…' : 'Read scene'}
        </button>
        {enrollMsg && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-2)', background: 'rgba(0,0,0,0.6)', padding: '5px 9px', borderRadius: 6 }}>{enrollMsg}</span>}
      </div>
    </div>
  );
}

function ctrlBtn(color = 'var(--text-secondary)'): CSSProperties {
  return {
    padding: '6px 11px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
    background: 'rgba(0,0,0,0.6)', color, border: '1px solid rgba(255,255,255,0.14)',
  };
}

function drawEyes(ctx: CanvasRenderingContext2D, lm: LM[], closed: boolean) {
  const color = closed ? '#ef4444' : '#22c55e';
  for (const contour of [LEFT_CONTOUR, RIGHT_CONTOUR]) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(lm[contour[0]].x * W, lm[contour[0]].y * H);
    for (let i = 1; i < contour.length; i++) ctx.lineTo(lm[contour[i]].x * W, lm[contour[i]].y * H);
    ctx.stroke();
  }
}
