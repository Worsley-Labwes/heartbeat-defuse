import { useState } from 'react';
import type { Source, Vitals } from '../signal/useVitals';

export default function Consent({ vitals, onReady }: { vitals: Vitals; onReady: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasCamera = !!window.vitals;
  const go = async (src: Source) => { setBusy(true); if (await vitals.start(src)) onReady(); setBusy(false); };

  return (
    <main className="consent">
      <h1>Pulse Defuse</h1>
      <p className="lede">A bomb that listens to your heartbeat. Keep calm and it stays quiet.</p>
      <section className="card">
        <h2>What the camera reads, and why</h2>
        <ul>
          <li><b>Pulse and breathing rate</b>, estimated from tiny colour and motion changes on your face and chest. They drive the game.</li>
          <li>The app <b>never saves or uploads</b> video, images, or readings. Numbers live in memory and vanish when you close it.</li>
          <li>The camera feed is processed by the SmartSpectra SDK, which <b>contacts Presage's servers</b> to measure. We switch its optional telemetry off.</li>
          <li>This is a game. It is <b>not a medical device</b> and says nothing about your health.</li>
        </ul>
        <label className="check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          I agree to use my webcam while this app is open. I can stop at any time with the Stop button.
        </label>
        {vitals.error && <p className="error" role="alert">{vitals.error}</p>}
        <div className="row">
          <button className="primary" disabled={!agreed || busy || !hasCamera} onClick={() => go('camera')}>Turn on camera</button>
          <button disabled={!agreed || busy} onClick={() => go('sim')}>Try with a simulated signal</button>
        </div>
        {!hasCamera && <p className="muted">Camera mode runs in the desktop app (<code>npm run dev</code>). In a browser you can only use the simulated signal, which is always labelled.</p>}
      </section>
    </main>
  );
}
