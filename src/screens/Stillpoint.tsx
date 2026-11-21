import { useEffect, useRef, useState } from 'react';
import type { Vitals } from '../signal/useVitals';

const SESSION_S = 180; const CYCLE_S = 10; const IN_S = 4; // 6 breaths per minute
const WARMUP_S = 20;                                        // breathing readings lag, so skip the start

export default function Stillpoint({ vitals, onExit }: { vitals: Vitals; onExit: () => void }) {
  const { readingRef } = vitals;
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [view, setView] = useState({ elapsed: 0, scale: 0.6, inhale: true, match: 0, avg: null as number | null });
  const acc = useRef({ total: 0, hit: 0, sum: 0 });

  useEffect(() => {
    if (!running) return;
    const t0 = performance.now(); let lastSecond = -1; let raf = 0;
    const frame = (now: number) => {
      const e = (now - t0) / 1000; const p = e % CYCLE_S;
      const inhale = p < IN_S;
      const k = inhale ? p / IN_S : 1 - (p - IN_S) / (CYCLE_S - IN_S);
      const sec = Math.floor(e);
      if (sec !== lastSecond) {
        lastSecond = sec;
        const b = readingRef.current.breath;
        if (e > WARMUP_S && b !== null) { acc.current.total++; acc.current.sum += b; if (Math.abs(b - 6) <= 2) acc.current.hit++; }
      }
      const a = acc.current;
      setView({ elapsed: e, scale: 0.6 + 0.4 * k, inhale, match: a.total ? a.hit / a.total : 0, avg: a.total ? a.sum / a.total : null });
      if (e >= SESSION_S) { setRunning(false); setDone(true); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, readingRef]);

  const begin = () => { acc.current = { total: 0, hit: 0, sum: 0 }; setDone(false); setRunning(true); };
  const left = Math.max(0, Math.ceil(SESSION_S - view.elapsed));
  const b = readingRef.current.breath;

  return (
    <div className="mode still">
      <div className="pacer-wrap">
        <div className="pacer" style={{ transform: `scale(${view.scale})` }} />
        <div className="pacer-label">{!running ? (done ? 'Done' : 'Ready') : view.inhale ? 'Breathe in' : 'Breathe out'}</div>
      </div>
      <div className="stats">
        <div><span className="big">{b !== null ? b.toFixed(1) : '--'}</span> breaths/min now <span className="muted">(target 6)</span></div>
        <div><span className="big">{Math.round(view.match * 100)}%</span> pace match <span className="muted">(a game score)</span></div>
        <div className="muted">{running ? `${left}s left` : '3 minutes. In for 4 seconds, out for 6.'}</div>
      </div>
      {!running && (
        <p className="coach">
          {done
            ? `Your breathing averaged ${view.avg?.toFixed(1) ?? '--'} per minute over the scored part. This is a game, not a health measure or treatment.`
            : 'Follow the circle. Breathing readings lag by many seconds, so scoring starts after the first 20 seconds.'}
        </p>
      )}
      <div className="row">
        {!running && <button className="primary" onClick={begin}>{done ? 'Go again' : 'Start'}</button>}
        <button onClick={onExit}>Back to menu</button>
      </div>
    </div>
  );
}