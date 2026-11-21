import { useEffect, useRef, useState } from 'react';
import type { Vitals } from '../signal/useVitals';
import { createHeartbeat } from '../audio/heartbeat';

const START_SECONDS = 90;
const HOLD_MS = 5000;     // calm time needed to cut one wire
const CALM_BELOW = 0.35;  // tension must stay under this to count as calm
const WIRES = [
  { name: 'red', color: '#e4572e' }, { name: 'yellow', color: '#e9b44c' },
  { name: 'blue', color: '#3e7cb1' }, { name: 'white', color: '#ece6d3' },
];
type Status = 'ready' | 'running' | 'won' | 'lost';

export default function Defuse({ vitals, onExit }: { vitals: Vitals; onExit: () => void }) {
  const { readingRef, beatSyncRef, subscribeBeat } = vitals;
  const [status, setStatus] = useState<Status>('ready');
  const [view, setView] = useState({ time: START_SECONDS, hold: 0, cut: 0, tension: 0, beat: 0 });
  const st = useRef({ time: START_SECONDS, hold: 0, cut: 0, status: 'ready' as Status, beat: 0 });
  const beatPlayer = useRef<ReturnType<typeof createHeartbeat> | null>(null);

  useEffect(() => {
    const player = createHeartbeat(
      () => (st.current.status === 'running' ? readingRef.current.pulse : null),
      () => readingRef.current.tension,
      () => { st.current.beat++; },
      () => beatSyncRef.current,
    );
    beatPlayer.current = player;
    const unsub = subscribeBeat(() => { if (st.current.status === 'running') player.trigger(); });
    return () => { unsub(); player.stop(); };
  }, [readingRef, beatSyncRef, subscribeBeat]);

  useEffect(() => {
    if (status !== 'running') return;
    let raf = 0; let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(100, now - last); last = now;
      const r = readingRef.current; const s = st.current;
      if (r.phase === 'live') {
        s.time -= (dt / 1000) * (1 + 2.5 * r.tension);          // tension drains the clock faster
        if (r.tension < CALM_BELOW) s.hold += dt; else s.hold = Math.max(0, s.hold - dt * 0.5);
        if (s.hold >= HOLD_MS) { s.cut++; s.hold = 0; }
      }                                                         // signal lost: the clock pauses (fair play)
      if (s.cut >= WIRES.length) { s.status = 'won'; setStatus('won'); beatPlayer.current?.stop(); }
      else if (s.time <= 0) { s.time = 0; s.status = 'lost'; setStatus('lost'); beatPlayer.current?.stop(); }
      setView({ time: s.time, hold: s.hold, cut: s.cut, tension: r.tension, beat: s.beat });
      if (s.status === 'running') raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [status, readingRef]);

  const begin = () => {
    Object.assign(st.current, { time: START_SECONDS, hold: 0, cut: 0, status: 'running' as Status, beat: 0 });
    beatPlayer.current?.start(); setStatus('running');
  };

  const mm = String(Math.floor(view.time / 60)).padStart(2, '0');
  const ss = String(Math.floor(view.time % 60)).padStart(2, '0');
  const amp = 2 + view.tension * 14;
  const t = performance.now() / 1000;

  return (
    <div className="mode">
      <div className="case" aria-label="Bomb">
        <div className={`clock ${view.tension > 0.6 ? 'hot' : ''}`} aria-live="off">{mm}:{ss}</div>
        <svg viewBox="0 0 520 300" role="img" aria-label={`${view.cut} of 4 wires cut`}>
          <circle key={view.beat} className="led" cx="40" cy="30" r="9" />
          {WIRES.map((w, i) => {
            const y = 70 + i * 62; const isCut = i < view.cut; const active = i === view.cut && status === 'running';
            const w1 = Math.sin(t * 9 + i * 1.7) * amp; const w2 = Math.cos(t * 7 + i) * amp;
            const d = `M 50 ${y} C 190 ${y + w1}, 330 ${y + w2}, 470 ${y}`;
            return (
              <g key={w.name}>
                <rect x="30" y={y - 12} width="28" height="24" rx="4" className="term" />
                <rect x="462" y={y - 12} width="28" height="24" rx="4" className="term" />
                {isCut
                  ? (<><path d={`M 50 ${y} C 90 ${y + 8}, 130 ${y + 14}, 200 ${y + 20}`} stroke={w.color} className="wire" />
                       <path d={`M 470 ${y} C 430 ${y - 8}, 390 ${y - 14}, 320 ${y - 20}`} stroke={w.color} className="wire" /></>)
                  : <path d={d} stroke={w.color} className={`wire ${active ? 'active' : ''}`} />}
              </g>
            );
          })}
        </svg>
        <div className="holdbar" aria-label="Calm hold"><div style={{ width: `${(view.hold / HOLD_MS) * 100}%` }} /></div>
        <p className="coach">
          {status === 'ready' && 'Cut each wire by staying calm: keep your pulse near your resting level for 5 seconds. The more you panic, the faster the clock runs.'}
          {status === 'running' && (readingRef.current.phase === 'lost' ? 'Signal lost. The clock is paused. Face the camera and sit still.' : view.tension < CALM_BELOW ? 'Steady. Hold it.' : 'Slow your breathing. The reading takes a few seconds to catch up.')}
          {status === 'won' && `Defused with ${Math.ceil(view.time)}s to spare.`}
          {status === 'lost' && 'Boom. (It is a game.) Settle yourself and try again.'}
        </p>
        <div className="row">
          {status !== 'running' && <button className="primary" onClick={begin}>{status === 'ready' ? 'Start defusing' : 'Play again'}</button>}
          <button onClick={() => { beatPlayer.current?.stop(); onExit(); }}>Back to menu</button>
        </div>
      </div>
    </div>
  );
}