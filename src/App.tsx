import { useEffect, useState } from 'react';
import { useVitals, type Vitals } from './signal/useVitals';
import Consent from './screens/Consent';
import Defuse from './screens/Defuse';
import Stillpoint from './screens/Stillpoint';
import Scope from './screens/Scope';

type Screen = 'consent' | 'calibrate' | 'menu' | 'defuse' | 'still';

function StatusBar({ v, onStop }: { v: Vitals; onStop: () => void }) {
  const r = v.reading;
  return (
    <header className="status">
      <span className={`pill ${v.source === 'camera' ? 'cam' : 'sim'}`}>
        <i aria-hidden /> {v.source === 'camera' ? (v.cameraOn ? 'Camera on' : 'Starting camera') : 'Simulated signal, no camera'}
      </span>
      <span className="read"><b>{r.pulse !== null ? Math.round(r.pulse) : '--'}</b> pulse/min</span>
      <span className="read"><b>{r.breath !== null ? r.breath.toFixed(1) : '--'}</b> breaths/min</span>
      <span className="read muted">{r.phase === 'live' ? 'live' : r.phase === 'calibrating' ? 'calibrating' : r.phase === 'lost' ? 'signal lost' : 'waiting for a signal'}</span>
      <button onClick={onStop}>Stop</button>
    </header>
  );
}

function Instruments({ v }: { v: Vitals }) {
  const t = v.traceInfo;
  const note = !t.hasTrace ? 'waiting for waveform'
    : t.beatSync ? `sound locked to detected beats${t.delayMs !== null ? ` (${(t.delayMs / 1000).toFixed(1)} s behind live)` : ''}`
    : `sound paced to your average rate${t.delayMs !== null && t.delayMs >= 1500 ? ` (waveform arrives ${(t.delayMs / 1000).toFixed(1)} s late)` : ''}`;
  return (
    <section className="scopes" aria-label="Live signals">
      <Scope data={v.pulseTrace} windowMs={6000} color="#e4572e" label="Pulse wave" />
      <Scope data={v.breathTrace} windowMs={20000} color="#2a9d8f" label="Breathing wave" />
      <p className="muted">{note}</p>
    </section>
  );
}

function SimPanel({ v }: { v: Vitals }) {
  const [p, setP] = useState(70); const [b, setB] = useState(14);
  return (
    <aside className="sim" aria-label="Simulated signal controls">
      <b>Simulated signal</b> (for development only)
      <label>pulse {p}<input type="range" min={55} max={110} value={p} onChange={(e) => { setP(+e.target.value); v.setSim(+e.target.value, b); }} /></label>
      <label>breathing {b}<input type="range" min={5} max={24} value={b} onChange={(e) => { setB(+e.target.value); v.setSim(p, +e.target.value); }} /></label>
    </aside>
  );
}

export default function App() {
  const v = useVitals();
  const [screen, setScreen] = useState<Screen>('consent');

  useEffect(() => { if (screen === 'calibrate' && v.reading.phase === 'live') setScreen('menu'); }, [screen, v.reading.phase]);
  const stop = async () => { await v.stop(); setScreen('consent'); };

  if (screen === 'consent') return <Consent vitals={v} onReady={() => setScreen('calibrate')} />;
  return (
    <div className="app">
      <StatusBar v={v} onStop={stop} />
      <Instruments v={v} />
      {v.error && <p className="error" role="alert">{v.error}</p>}
      {screen === 'calibrate' && (
        <main className="center">
          <h2>Settling in</h2>
          <p>Sit still, face the camera, and breathe normally. We are learning your resting pulse so the game is fair to you.</p>
          <div className="holdbar big"><div style={{ width: `${v.reading.calibrationPct * 100}%` }} /></div>
          <p className="muted">{v.hint || (v.reading.phase === 'waiting' ? 'Waiting for the first reading. Good light on your face helps.' : 'Measuring...')}</p>
        </main>
      )}
      {screen === 'menu' && (
        <main className="center">
          <h2>Pick a mode</h2>
          <div className="row">
            <button className="primary" onClick={() => setScreen('defuse')}>Defuse</button>
            <button onClick={() => setScreen('still')}>Stillpoint (breathing)</button>
          </div>
          <button className="link" onClick={() => { v.recalibrate(); setScreen('calibrate'); }}>Recalibrate my resting pulse</button>
        </main>
      )}
      {screen === 'defuse' && <Defuse vitals={v} onExit={() => setScreen('menu')} />}
      {screen === 'still' && <Stillpoint vitals={v} onExit={() => setScreen('menu')} />}
      {v.source === 'sim' && <SimPanel v={v} />}
    </div>
  );
}