import { describe, it, expect } from 'vitest';
import { VitalsFilter, median } from './filter';

const feed = (f: VitalsFilter, t0: number, secs: number, pulse: number, breath = 14) => {
  for (let s = 0; s < secs; s++) f.push({ pulse, pulseStable: true, breath, breathStable: true }, t0 + s * 1000);
};

describe('VitalsFilter', () => {
  it('median handles odd and even', () => { expect(median([3, 1, 2])).toBe(2); expect(median([1, 2, 3, 4])).toBe(2.5); });

  it('waits, then calibrates from stable values only', () => {
    const f = new VitalsFilter();
    expect(f.read(0).phase).toBe('waiting');
    f.push({ pulse: 200, pulseStable: false }, 0); // unstable: ignored
    expect(f.read(1).phase).toBe('waiting');
    feed(f, 1000, 4, 70);
    expect(f.read(5000).phase).toBe('calibrating');
    feed(f, 5000, 8, 70);
    const r = f.read(13000);
    expect(r.phase).toBe('live'); expect(r.basePulse).toBe(70);
  });

  it('rises with pulse above YOUR baseline and eases back down', () => {
    const f = new VitalsFilter();
    feed(f, 0, 12, 70); f.read(12000);
    let t = 12000; let r = f.read(t);
    for (let i = 0; i < 20; i++) { t += 1000; f.push({ pulse: 85, pulseStable: true }, t); r = f.read(t); }
    expect(r.tension).toBeGreaterThan(0.7);
    for (let i = 0; i < 30; i++) { t += 1000; f.push({ pulse: 70, pulseStable: true }, t); r = f.read(t); }
    expect(r.tension).toBeLessThan(0.15);
  });

  it('reports lost after a long gap and recalibrates on request', () => {
    const f = new VitalsFilter();
    feed(f, 0, 12, 70); f.read(12000);
    expect(f.read(12000 + 20000).phase).toBe('lost');
    f.recalibrate(); expect(f.read(40000).phase).toBe('waiting');
  });
});
