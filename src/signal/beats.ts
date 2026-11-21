import type { TracePoint } from './types';

/** Streaming peak detector for a pulse waveform of unknown sample rate.
 *  Detrends with a moving average, thresholds at half the RMS, enforces a refractory period. */
export class BeatDetector {
  private buf: TracePoint[] = [];
  private lastBeat = -Infinity;
  private lastChecked = -Infinity;
  constructor(private refractoryMs = 350, private bufMs = 6000, private detrendMs = 1000) {}

  /** Feed new samples; returns the sample-clock times of beats found in the newly settled region. */
  push(points: TracePoint[]): number[] {
    for (const p of points) if (!this.buf.length || p.t > this.buf[this.buf.length - 1].t) this.buf.push(p);
    if (this.buf.length < 8) return [];
    const end = this.buf[this.buf.length - 1].t;
    this.buf = this.buf.filter((p) => end - p.t <= this.bufMs);
    const b = this.buf; const n = b.length;
    if (n < 8) return [];
    const pre = new Array<number>(n + 1).fill(0);
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + b[i].v;
    const d = new Array<number>(n); let lo = 0; let hi = 0;
    for (let i = 0; i < n; i++) {
      while (b[i].t - b[lo].t > this.detrendMs / 2) lo++;
      while (hi < n - 1 && b[hi + 1].t - b[i].t <= this.detrendMs / 2) hi++;
      d[i] = b[i].v - (pre[hi + 1] - pre[lo]) / (hi - lo + 1);
    }
    const rms = Math.sqrt(d.reduce((a, x) => a + x * x, 0) / n);
    const thr = 0.5 * rms; const beats: number[] = [];
    for (let i = 1; i < n - 1; i++) {
      if (b[i].t <= this.lastChecked) continue;
      if (d[i] > thr && d[i] >= d[i - 1] && d[i] > d[i + 1] && b[i].t - this.lastBeat >= this.refractoryMs) {
        beats.push(b[i].t); this.lastBeat = b[i].t;
      }
    }
    this.lastChecked = b[n - 2].t;
    return beats;
  }
}