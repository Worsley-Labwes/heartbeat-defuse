import { useCallback, useEffect, useRef, useState } from 'react';
import { VitalsFilter } from './filter';
import { BeatDetector } from './beats';
import type { Reading, TraceBatch, TracePoint } from './types';

export type Source = 'camera' | 'sim';
const EMPTY: Reading = { phase: 'waiting', pulse: null, breath: null, basePulse: null, baseBreath: null, calibrationPct: 0, tension: 0 };
const MAX_SYNC_DELAY_MS = 1500;   // beats that arrive later than this would feel disconnected: fall back
export interface TraceInfo { hasTrace: boolean; beatSync: boolean; delayMs: number | null }

const trim = (a: TracePoint[], keepMs: number) => {
  if (!a.length) return;
  const end = a[a.length - 1].t; let i = 0;
  while (i < a.length && end - a[i].t > keepMs) i++;
  if (i) a.splice(0, i);
};

export function useVitals() {
  const filter = useRef(new VitalsFilter());
  const detector = useRef(new BeatDetector());
  const readingRef = useRef<Reading>(EMPTY);
  const pulseTrace = useRef<TracePoint[]>([]);
  const breathTrace = useRef<TracePoint[]>([]);
  const beatArrivals = useRef<number[]>([]);
  const beatSyncRef = useRef(false);
  const lastTraceAt = useRef<{ arrived: number; sampleT: number } | null>(null);
  const beatListeners = useRef(new Set<() => void>());
  const [reading, setReading] = useState<Reading>(EMPTY);
  const [traceInfo, setTraceInfo] = useState<TraceInfo>({ hasTrace: false, beatSync: false, delayMs: null });
  const [source, setSource] = useState<Source | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sim = useRef({ pulse: 70, breath: 14, tp: 70, tb: 14, pPhase: 0, bPhase: 0 });
  const cleanup = useRef<Array<() => void>>([]);

  const ingestTrace = useCallback((b: TraceBatch) => {
    const now = Date.now();
    if (b.pulse.length) {
      pulseTrace.current.push(...b.pulse); trim(pulseTrace.current, 12000);
      lastTraceAt.current = { arrived: now, sampleT: b.pulse[b.pulse.length - 1].t };
      for (const _t of detector.current.push(b.pulse)) {
        beatArrivals.current.push(now); trim_ms(beatArrivals.current, now, 8000);
        if (beatSyncRef.current) beatListeners.current.forEach((f) => f());
      }
    }
    if (b.breath.length) { breathTrace.current.push(...b.breath); trim(breathTrace.current, 40000); }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const r = filter.current.read(now);
      readingRef.current = r; setReading(r);
      // Is the detected beat train trustworthy enough to drive the sound?
      const last = lastTraceAt.current;
      const delayMs = last ? now - last.sampleT : null;
      const arr = beatArrivals.current.filter((t) => now - t <= 8000);
      let ok = false;
      if (arr.length >= 4 && r.pulse && delayMs !== null && delayMs >= -500 && delayMs < MAX_SYNC_DELAY_MS) {
        const iv = (arr[arr.length - 1] - arr[0]) / (arr.length - 1); const expect = 60000 / r.pulse;
        ok = Math.abs(iv - expect) / expect < 0.25;
      }
      beatSyncRef.current = ok;
      setTraceInfo((p) => {
        const n = { hasTrace: !!last && now - last.arrived < 5000, beatSync: ok, delayMs: delayMs !== null && delayMs >= 0 && delayMs < 120000 ? Math.round(delayMs) : null };
        return p.hasTrace === n.hasTrace && p.beatSync === n.beatSync && p.delayMs === n.delayMs ? p : n;
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  const teardown = () => { cleanup.current.forEach((f) => f()); cleanup.current = []; };
  const resetTraces = () => {
    detector.current = new BeatDetector(); pulseTrace.current.length = 0; breathTrace.current.length = 0;
    beatArrivals.current.length = 0; beatSyncRef.current = false; lastTraceAt.current = null;
  };

  const start = useCallback(async (src: Source) => {
    teardown(); filter.current = new VitalsFilter(); resetTraces(); setError(null); setHint('');
    if (src === 'sim') {
      sim.current = { pulse: 70, breath: 14, tp: 70, tb: 14, pPhase: 0, bPhase: 0 };
      const slow = setInterval(() => {
        const s = sim.current; // lags toward the target, like the real SDK's averaged values
        s.pulse += (s.tp - s.pulse) * 0.18; s.breath += (s.tb - s.breath) * 0.08;
        filter.current.push({ pulse: s.pulse + (Math.random() - 0.5), pulseStable: true,
          breath: s.breath + (Math.random() - 0.5) * 0.4, breathStable: true }, Date.now());
      }, 1000);
      const fast = setInterval(() => { // synthetic waveforms so the scopes and beat sync can be developed offline
        const s = sim.current; const dt = 1 / 30; const t = Date.now();
        s.pPhase += 2 * Math.PI * (s.pulse / 60) * dt; s.bPhase += 2 * Math.PI * (s.breath / 60) * dt;
        ingestTrace({ pulse: [{ t, v: Math.sin(s.pPhase) + 0.25 * Math.sin(2 * s.pPhase) + (Math.random() - 0.5) * 0.15 }],
                      breath: [{ t, v: Math.sin(s.bPhase) }] });
      }, 33);
      cleanup.current.push(() => clearInterval(slow), () => clearInterval(fast));
      setSource('sim'); setCameraOn(false); return true;
    }
    const bridge = window.vitals;
    if (!bridge) { setError('Camera mode needs the desktop app.'); return false; }
    cleanup.current.push(
      bridge.onSample((s) => filter.current.push(s, Date.now())),
      bridge.onTrace(ingestTrace),
      bridge.onValidation((v) => setHint(v.hint)),
      bridge.onError((e) => setError(e.message)),
      bridge.onState((s) => setCameraOn(s.camera === 'on')),
    );
    const res = await bridge.start();
    if (!res.ok) { setError(res.error ?? 'Could not start the camera.'); teardown(); return false; }
    setSource('camera'); return true;
  }, [ingestTrace]);

  const stop = useCallback(async () => {
    teardown(); await window.vitals?.stop(); resetTraces();
    setSource(null); setCameraOn(false); filter.current = new VitalsFilter();
    readingRef.current = EMPTY; setReading(EMPTY);
  }, []);

  const recalibrate = useCallback(() => filter.current.recalibrate(), []);
  const setSim = useCallback((pulse: number, breath: number) => { sim.current.tp = pulse; sim.current.tb = breath; }, []);
  const subscribeBeat = useCallback((cb: () => void) => { beatListeners.current.add(cb); return () => { beatListeners.current.delete(cb); }; }, []);

  return { reading, readingRef, source, cameraOn, hint, error, start, stop, recalibrate, setSim,
           pulseTrace, breathTrace, traceInfo, beatSyncRef, subscribeBeat };
}
function trim_ms(a: number[], now: number, keepMs: number) { while (a.length && now - a[0] > keepMs) a.shift(); }
export type Vitals = ReturnType<typeof useVitals>;