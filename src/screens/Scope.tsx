import { useEffect, useRef, type MutableRefObject } from 'react';
import type { TracePoint } from '../signal/types';

export default function Scope({ data, windowMs, color, label }:
  { data: MutableRefObject<TracePoint[]>; windowMs: number; color: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = ref.current; if (!c) return;
      const dpr = window.devicePixelRatio || 1; const w = c.clientWidth; const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      const pts = data.current;
      if (pts.length > 2) {
        const end = pts[pts.length - 1].t; const start = end - windowMs;
        let lo = Infinity; let hi = -Infinity;
        for (const p of pts) if (p.t >= start) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; }
        const span = hi - lo || 1;
        g.beginPath(); g.lineWidth = 2; g.strokeStyle = color; g.lineJoin = 'round'; let first = true;
        for (const p of pts) {
          if (p.t < start) continue;
          const x = ((p.t - start) / windowMs) * w; const y = h - 4 - ((p.v - lo) / span) * (h - 8);
          if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y);
        }
        g.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [data, windowMs, color]);
  return (
    <figure className="scope">
      <figcaption>{label}</figcaption>
      <canvas ref={ref} role="img" aria-label={`${label}, live waveform`} />
    </figure>
  );
}