import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { FaceMesh as FaceMeshType, Results } from '@mediapipe/face_mesh';

// @mediapipe/face_mesh is a UMD global-script package (not a clean ES module), so we load it
// from the CDN at runtime and use the global constructor. The npm package is kept for types only.
type FaceMeshCtor = new (config: { locateFile: (file: string) => string }) => FaceMeshType;
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh';

let scriptPromise: Promise<void> | null = null;
function loadFaceMeshScript(): Promise<void> {
  if ((window as unknown as { FaceMesh?: FaceMeshCtor }).FaceMesh) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${CDN}/face_mesh.js`;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load MediaPipe FaceMesh from CDN'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Runs MediaPipe Face Mesh on a <video> element entirely in the browser (WASM, on-device —
 * no cloud). Calls onResults with the landmarks every animation frame.
 */
export function useFaceMesh(
  videoRef: RefObject<HTMLVideoElement | null>,
  onResults: (results: Results) => void
) {
  const faceMeshRef = useRef<FaceMeshType | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const onResultsRef = useRef(onResults);

  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  const processVideo = useCallback(async () => {
    const v = videoRef.current;
    if (v && faceMeshRef.current && v.readyState === 4) {
      try {
        await faceMeshRef.current.send({ image: v });
      } catch {
        /* transient send error — ignore, next frame retries */
      }
    }
    rafRef.current = requestAnimationFrame(processVideo);
  }, [videoRef]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      await loadFaceMeshScript();
      if (cancelled) return;

      const Ctor = (window as unknown as { FaceMesh: FaceMeshCtor }).FaceMesh;
      const fm = new Ctor({ locateFile: (file) => `${CDN}/${file}` });
      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      fm.onResults((res) => onResultsRef.current(res));
      faceMeshRef.current = fm;

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      } catch (err) {
        console.error('Webcam access error:', err);
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.onloadedmetadata = () => {
          void v.play();
          rafRef.current = requestAnimationFrame(processVideo);
        };
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
      faceMeshRef.current?.close();
      faceMeshRef.current = null;
    };
  }, [videoRef, processVideo]);
}
