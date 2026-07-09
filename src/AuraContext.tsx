import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CORE_WS } from "./config";

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

/** Streamed natural-language "why" from the on-device Reasoning Agent (reasoning). */
export type Reasoning = { text: string; streaming: boolean; acted?: boolean; driver?: string };

/** A grounded RAG answer from the Aura Copilot (copilot.response). */
export type CopilotAnswer = {
  query: string;
  answer: string;
  sources: string[];
  grounded: boolean;
  driver?: string;
};

/** Predictive world-model forecast (forecast) — where the driver's state is heading. */
export type Forecast = {
  driver?: string;
  score: number;
  threshold: number;
  trend: "rising" | "falling" | "stable" | string;
  slopePerSec: number;
  secondsToThreshold: number | null;
  risk: "nominal" | "elevated" | "imminent" | string;
  horizonText: string;
};

export type AgentAction = { type: string; detail: string };
export type AgentNode = { id: string; label: string; group: string; status: string; note: string };

/** A full multi-agent decision cycle (orchestration) — the agent-graph trace. */
export type Orchestration = {
  cycle: number;
  trigger: string;
  level: number;
  levelName: string;
  requestedLevel: number;
  vetoed: boolean;
  driver?: string;
  score: number;
  threshold: number;
  forecast: Forecast;
  decision: string;
  actions: AgentAction[];
  nodes: AgentNode[];
  edges: [string, string][];
};

/** A proactive Wellness countermeasure the crew chose (countermeasure). */
export type Countermeasure = { driver?: string; level: number | null; actions: AgentAction[]; source?: string };

/** A vision-LLM description of a camera frame (vision.scene). */
export type VisionScene = { description: string; kind: string; driver?: string; ts: number };

/** Emergency escalation (eCall) status + per-contact delivery results. */
export type ECallResult = { name?: string; phone?: string; channel?: string; ok?: boolean; error?: string; status?: string };
export type ECall = {
  phase: string; // dispatching | dispatched | cancelled
  driver?: string;
  ok?: boolean;
  results?: ECallResult[];
  location?: { lat?: number; lng?: number; label?: string };
  ts: number;
};

type AuraValue = {
  connected: boolean;
  driver: Driver | null;
  alert: SafetyAlert | null;
  live: LiveState | null;
  telemetry: Telemetry | null;
  explain: Explain | null;
  reasoning: Reasoning | null;
  copilot: CopilotAnswer | null;
  forecast: Forecast | null;
  orchestration: Orchestration | null;
  countermeasure: Countermeasure | null;
  vision: VisionScene | null;
  ecall: ECall | null;
  events: AuraEvent[];
};

const AuraCtx = createContext<AuraValue>({
  connected: false,
  driver: null,
  alert: null,
  live: null,
  telemetry: null,
  explain: null,
  reasoning: null,
  copilot: null,
  forecast: null,
  orchestration: null,
  countermeasure: null,
  vision: null,
  ecall: null,
  events: [],
});

// One shared hook for every screen + the sidebar — a single WebSocket for the whole app.
export const useAura = () => useContext(AuraCtx);

const AURA_URL = CORE_WS;

export function AuraProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [alert, setAlert] = useState<SafetyAlert | null>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [explain, setExplain] = useState<Explain | null>(null);
  const [reasoning, setReasoning] = useState<Reasoning | null>(null);
  const [copilot, setCopilot] = useState<CopilotAnswer | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [orchestration, setOrchestration] = useState<Orchestration | null>(null);
  const [countermeasure, setCountermeasure] = useState<Countermeasure | null>(null);
  const [vision, setVision] = useState<VisionScene | null>(null);
  const [ecall, setEcall] = useState<ECall | null>(null);
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
          pushEvent("identified", String(msg.payload.via) === "face-id" ? `Face-ID recognized ${d.name}` : `Welcome ${d.name}`);
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
        case "reasoning": {
          const pl = msg.payload as Record<string, unknown>;
          const phase = String(pl.phase ?? "");
          if (phase === "start") {
            setReasoning({ text: "", streaming: true, acted: Boolean(pl.acted), driver: pl.driver as string });
          } else if (phase === "delta") {
            setReasoning((r) => ({
              text: (pl.text as string) ?? ((r?.text ?? "") + ((pl.delta as string) ?? "")),
              streaming: true,
              acted: r?.acted,
              driver: (pl.driver as string) ?? r?.driver,
            }));
          } else if (phase === "done") {
            setReasoning({ text: String(pl.text ?? ""), streaming: false, acted: Boolean(pl.acted), driver: pl.driver as string });
            pushEvent("reasoning", "Aura explained its decision");
          }
          break;
        }
        case "copilot.response": {
          const pl = msg.payload as Record<string, unknown>;
          setCopilot({
            query: String(pl.query ?? ""),
            answer: String(pl.answer ?? ""),
            sources: (pl.sources as string[]) ?? [],
            grounded: Boolean(pl.grounded),
            driver: pl.driver as string,
          });
          break;
        }
        case "forecast":
          setForecast(msg.payload as unknown as Forecast);
          break;
        case "orchestration":
          setOrchestration(msg.payload as unknown as Orchestration);
          break;
        case "countermeasure": {
          const cm = msg.payload as unknown as Countermeasure;
          setCountermeasure(cm);
          if (cm.actions?.length) pushEvent("countermeasure", cm.actions.map((a) => a.detail).join("; "));
          break;
        }
        case "vision.scene": {
          const pl = msg.payload as Record<string, unknown>;
          setVision({
            description: String(pl.description ?? ""),
            kind: String(pl.kind ?? "cabin"),
            driver: pl.driver as string,
            ts: Date.now(),
          });
          break;
        }
        case "ecall": {
          const pl = msg.payload as Record<string, unknown>;
          setEcall({
            phase: String(pl.phase ?? ""),
            driver: pl.driver as string,
            ok: pl.ok as boolean,
            results: (pl.results as ECallResult[]) ?? undefined,
            location: pl.location as ECall["location"],
            ts: Date.now(),
          });
          if (pl.phase === "dispatched") pushEvent("ecall", pl.ok ? "Emergency alert sent" : "Emergency alert failed");
          break;
        }
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
    <AuraCtx.Provider value={{ connected, driver, alert, live, telemetry, explain, reasoning, copilot, forecast, orchestration, countermeasure, vision, ecall, events }}>
      {children}
    </AuraCtx.Provider>
  );
}
