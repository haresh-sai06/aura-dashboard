import { useCallback, useEffect, useRef, useState } from "react";

/** Standard Aura envelope shared by every interface: {type, timestamp, payload}. */
export type AuraMessage = {
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

export type Driver = { name: string; playlist: string };

export type SafetyAlert = {
  level: string;
  reason: string;
  action: string;
  modality: string;
  driver?: string;
};

const AURA_URL = "ws://127.0.0.1:8765/";

/**
 * Connects the dashboard to the Aura Core edge brain over WebSocket and exposes
 * the live driver/persona + safety state. Same socket the Unity game listens on,
 * so one Core event updates the game and this dashboard together.
 */
export function useAuraSocket() {
  const [connected, setConnected] = useState(false);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [alert, setAlert] = useState<SafetyAlert | null>(null);
  const [lastEvent, setLastEvent] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);

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
      let msg: AuraMessage;
      try {
        msg = JSON.parse(e.data as string);
      } catch {
        return;
      }
      setLastEvent(`${msg.type} · ${new Date().toLocaleTimeString()}`);
      switch (msg.type) {
        case "driver.identified":
          setDriver({
            name: String(msg.payload.name ?? "Driver"),
            playlist: String(msg.payload.playlist ?? "—"),
          });
          break;
        case "safety.alert":
          setAlert(msg.payload as unknown as SafetyAlert);
          break;
        case "safety.clear":
          setAlert(null);
          break;
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, driver, alert, lastEvent };
}
