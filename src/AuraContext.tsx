import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Standard Aura envelope shared by every interface: {type, timestamp, payload}. */
export type Driver = { name: string; playlist: string };

export type SafetyAlert = {
  level: string;
  reason: string;
  action: string;
  modality: string;
  driver?: string;
};

export type DrowsinessFactor = { name: string; contribution: number; value: number };

export type LiveState = {
  facePresent: boolean;
  score: number;
  level?: string;
  ear?: number;
  mar?: number;
  perclos?: number;
  headPitch?: number;
  headYaw?: number;
  headRoll?: number;
  gazeStability?: number;
  gazeDirection?: string;
  blinkRate?: number;
  blinkDuration?: number;
  factors?: DrowsinessFactor[];
  ml?: { class: string; confidence: number };
  eyeClosureS?: number; // legacy field from the Python camera
  baseline?: number;
  driver?: string;
};

export type AuraEvent = { time: string; type: string; detail: string };

/** Live vehicle state streamed from the Unity car (vehicle.telemetry). */
export type Telemetry = {
  speedKmh: number;
  throttle?: number;
  steer?: number;
  autonomous?: boolean;
  pullingOver?: boolean;
  scenario?: string;
  wpIndex?: number;
  wpTotal?: number;
};

/** The personalized "why did Aura act for ME?" payload (explain). */
export type ExplainFactor = { name: string; value: number };
export type Explain = {
  driver?: string;
  decision: string;
  personalThreshold?: number;
  genericThreshold?: number;
  modality?: string;
  factors?: ExplainFactor[];
};

type AuraValue = {
  connected: boolean;
  driver: Driver | null;
  alert: SafetyAlert | null;
  live: LiveState | null;
  telemetry: Telemetry | null;
  explain: Explain | null;
  events: AuraEvent[];
};

const AuraCtx = createContext<AuraValue>({
  connected: false,
  driver: null,
  alert: null,
  live: null,
  telemetry: null,
  explain: null,
  events: [],
});

// One shared hook for every screen + the sidebar — a single WebSocket for the whole app.
export const useAura = () => useContext(AuraCtx);

const AURA_URL = "ws://127.0.0.1:8765/";

export function AuraProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [alert, setAlert] = useState<SafetyAlert | null>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [explain, setExplain] = useState<Explain | null>(null);
  const [events, setEvents] = useState<AuraEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);

  const pushEvent = useCallback((type: string, detail: string) => {
    setEvents((prev) =>
      [{ time: new Date().toLocaleTimeString(), type, detail }, ...prev].slice(0, 30)
    );
  }, []);

  const connect = useCallback(() => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(AURA_URL);
    } catch {
      reconnectRef.current = window.setTimeout(connect, 2000);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      setConnected(false);
      reconnectRef.current = window.setTimeout(connect, 2000);
    };
    ws.onmessage = (e) => {
      let msg: { type: string; payload: Record<string, unknown> };
      try {
        msg = JSON.parse(e.data as string);
      } catch {
        return;
      }
      switch (msg.type) {
        case "driver.identified": {
          const d: Driver = {
            name: String(msg.payload.name ?? "Driver"),
            playlist: String(msg.payload.playlist ?? "—"),
          };
          setDriver(d);
          pushEvent("identified", `Welcome ${d.name}`);
          break;
        }
        case "driver.state":
          setLive(msg.payload as unknown as LiveState);
          break;
        case "vehicle.telemetry":
          setTelemetry(msg.payload as unknown as Telemetry);
          break;
        case "explain":
          setExplain(msg.payload as unknown as Explain);
          break;
        case "safety.alert": {
          const a = msg.payload as unknown as SafetyAlert;
          setAlert(a);
          pushEvent("alert", a.reason);
          break;
        }
        case "safety.clear":
          setAlert(null);
          pushEvent("clear", "Driver responded — resuming");
          break;
      }
    };
  }, [pushEvent]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return (
    <AuraCtx.Provider value={{ connected, driver, alert, live, telemetry, explain, events }}>
      {children}
    </AuraCtx.Provider>
  );
}
