import { useAuraSocket } from "./useAuraSocket";
import "./App.css";

export default function App() {
  const { connected, driver, alert, lastEvent } = useAuraSocket();

  return (
    <div className={`aura ${alert ? "alarm" : ""}`}>
      <header className="bar">
        <div className="brand">
          <span className="logo">◆</span> AURA
          <span className="sub">driver HMI · edge</span>
        </div>
        <div className={`status ${connected ? "on" : "off"}`}>
          <span className="dot" />
          {connected ? "Edge brain connected" : "Offline"}
        </div>
      </header>

      <main className="grid">
        <section className="card welcome">
          {driver ? (
            <>
              <p className="eyebrow">Driver recognized · on-device</p>
              <h1>
                Welcome, <span className="name">{driver.name}</span>
              </h1>
              <p className="muted">Face matched locally — no cloud, no login.</p>

              <div className="playlist">
                <span className="ic">♪</span>
                <div>
                  <p className="muted small">Your playlist</p>
                  <p className="big">{driver.playlist}</p>
                </div>
              </div>

              <div className="trip">
                <p className="muted small">Where are you traveling today?</p>
                <div className="chips">
                  <span className="chip">Home</span>
                  <span className="chip">Office</span>
                  <span className="chip">Airport</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">Waiting</p>
              <h1>Take your seat</h1>
              <p className="muted">
                Aura will recognize you and load your profile automatically.
              </p>
            </>
          )}
        </section>

        <section className={`card safety ${alert ? "active" : ""}`}>
          {alert ? (
            <>
              <p className="eyebrow danger">Safety · {alert.level}</p>
              <h2 className="wake">WAKE UP</h2>
              <p className="reason">{alert.reason}</p>

              <div className="why">
                <p className="muted small">Why did Aura act?</p>
                <ul>
                  <li>
                    Action: <b>{alert.action.replace("_", " ")}</b>
                  </li>
                  <li>
                    Warned via <b>{alert.modality}</b> — your reaction profile
                  </li>
                  <li className="muted">
                    Judged against {alert.driver ?? "your"}&rsquo;s personal
                    baseline, not a generic threshold.
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow ok">Safety · nominal</p>
              <h2>All clear</h2>
              <p className="muted">
                Monitoring attention against your personal baseline.
              </p>
            </>
          )}
        </section>
      </main>

      <footer className="foot">
        <span>{lastEvent || "no events yet"}</span>
        <span className="muted">ws://127.0.0.1:8765</span>
      </footer>
    </div>
  );
}
