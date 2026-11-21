import { describe, it, expect } from 'vitest';
import { BeatDetector } from './beats';
import type { TracePoint } from './types';

const wave = (bpm: number, secs: number, hz = 30, noise = 0.15): TracePoint[] => {
  const out: TracePoint[] = []; let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  for (let i = 0; i < secs * hz; i++) {
    const t = (i / hz) * 1000;
    out.push({ t, v: 3 + t * 0.0004 + Math.sin(2 * Math.PI * (bpm / 60) * (t / 1000)) + noise * rnd() * 2 });
  }
  return out;
};

describe('BeatDetector', () => {
  it('finds beats at the right rate despite DC offset, drift and noise', () => {
    const det = new BeatDetector(); const w = wave(75, 20); const beats: number[] = [];
    for (let i = 0; i < w.length; i += 5) beats.push(...det.push(w.slice(i, i + 5)));
    expect(beats.length).toBeGreaterThanOrEqual(22); expect(beats.length).toBeLessThanOrEqual(27);
    const iv = beats.slice(1).map((t, i) => t - beats[i]).sort((a, b) => a - b);
    const med = iv[iv.length >> 1];
    expect(med).toBeGreaterThan(720); expect(med).toBeLessThan(880); // 75 bpm = 800 ms
  });
  it('does not double-count when recent samples are re-sent', () => {
    const det = new BeatDetector(); const w = wave(60, 10); let found = 0;
    for (let i = 0; i < w.length; i += 5) found += det.push(w.slice(i, i + 5)).length;
    expect(found).toBeGreaterThanOrEqual(8);
    expect(det.push(w.slice(-60)).length).toBe(0);
  });
});