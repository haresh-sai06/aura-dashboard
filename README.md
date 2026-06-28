# Aura Dashboard

The in-car **HMI** interface for the Aura prototype — a Vite + React + TypeScript app that
connects to the **Aura Core** edge brain over WebSocket and reacts live to driver-state events.
It's the third interface alongside the camera and the Unity game; all three share one Aura Core socket.

## What it shows
- **Welcome card** — on `driver.identified`: "Welcome, &lt;name&gt;", personalized playlist, and a
  "where are you traveling today?" trip prompt.
- **Safety card** — on `safety.alert`: a red "WAKE UP" state with the reason and a
  "why did Aura act?" explanation (personalized to the driver's baseline). Clears on `safety.clear`.
- **Connection status** — live indicator for the edge-brain socket.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

Aura Core must be running (`../aura-core` → `python run.py`). Then fire events from there:

```bash
python tools/send_test_event.py identify   # dashboard greets the driver
python tools/send_test_event.py drowsy      # dashboard shows WAKE UP
python tools/send_test_event.py resume      # dashboard clears
```

The same events also drive the Unity game — one Core event updates both at once.

## Where things live
- [`src/useAuraSocket.ts`](src/useAuraSocket.ts) — the WebSocket hook (connection + parsing + state).
  The message types must stay in sync with `aura-core/aura_core/messages.py`.
- [`src/App.tsx`](src/App.tsx) — the HMI layout.
- [`src/App.css`](src/App.css) — styling.

## Next
- Add a live telemetry panel (speed/position) once Unity streams `vehicle.telemetry`.
- Wire the trip chips to actually set a destination (send a command back to Core).
- Replace the faked drowsiness with the real camera/CV signal in Aura Core.
