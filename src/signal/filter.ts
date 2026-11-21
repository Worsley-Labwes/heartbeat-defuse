import type { RawSample, Reading } from './types';

export const WINDOW_MS = 8000;      // smoothing window for stable values
export const CAL_MIN_SAMPLES = 8;   // stable pulse readings needed to set a baseline
export const CAL_MIN_MS = 10000;    // ...spread over at least this long
export const LOST_MS = 15000;       // no new stable pulse for this long => signal lost
export const PULSE_FULL_TENSION = 12; // +12 BPM over your baseline = full tension
export const BREATH_FULL_TENSION = 6; // +6 breaths/min over your baseline = full tension

export const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

type Timed = { t: number; v: number };

/** Turns the SDK's noisy, lagging stream into a stable, personal "tension" signal.
 *  Time comes from arrival time (Date.now), not SDK timestamps, to avoid clock mixups. */
export class VitalsFilter {
  private pulses: Timed[] = []; private breaths: Timed[] = [];
  private calP: number[] = []; private calB: number[] = [];
  private firstStable: number | null = null; private lastStablePulse: number | null = null;
  private basePulse: number | null = null; private baseBreath: number | null = null;
  private tension = 0; private lastTick: number | null = null;

  push(s: RawSample, now: number) {
    if (s.pulse != null && s.pulseStable) {
      this.pulses.push({ t: now, v: s.pulse }); this.lastStablePulse = now;
      if (this.firstStable === null) this.firstStable = now;
      if (this.basePulse === null) this.calP.push(s.pulse);
    }
    if (s.breath != null && s.breathStable) {
      this.breaths.push({ t: now, v: s.breath });
      if (this.baseBreath === null && this.basePulse === null) this.calB.push(s.breath);
    }
    this.trim(now);
    if (this.basePulse === null && this.firstStable !== null &&
        this.calP.length >= CAL_MIN_SAMPLES && now - this.firstStable >= CAL_MIN_MS) {
      this.basePulse = median(this.calP);
      this.baseBreath = this.calB.length >= 3 ? median(this.calB) : null;
    }
  }

  recalibrate() {
    this.calP = []; this.calB = []; this.basePulse = null; this.baseBreath = null;
    this.firstStable = null; this.tension = 0;
  }

  private trim(now: number) {
    this.pulses = this.pulses.filter((x) => now - x.t <= WINDOW_MS);
    this.breaths = this.breaths.filter((x) => now - x.t <= WINDOW_MS * 2);
  }

  read(now: number): Reading {
    this.trim(now);
    const pulse = this.pulses.length ? median(this.pulses.map((x) => x.v)) : null;
    const breath = this.breaths.length ? median(this.breaths.map((x) => x.v)) : null;
    const calibrated = this.basePulse !== null;
    const lost = calibrated && (this.lastStablePulse === null || now - this.lastStablePulse > LOST_MS);
    const phase = lost ? 'lost' : calibrated ? 'live' : this.firstStable === null ? 'waiting' : 'calibrating';
    const calibrationPct = calibrated ? 1 : this.firstStable === null ? 0 : Math.min(1,
      0.5 * Math.min(1, this.calP.length / CAL_MIN_SAMPLES) + 0.5 * Math.min(1, (now - this.firstStable) / CAL_MIN_MS));

    // Ease toward the target so the game feels smooth even when the SDK value steps.
    let target = this.tension;
    if (phase === 'live' && pulse !== null && this.basePulse !== null) {
      const tp = clamp01((pulse - this.basePulse) / PULSE_FULL_TENSION);
      const tb = breath !== null && this.baseBreath !== null
        ? clamp01((breath - this.baseBreath) / BREATH_FULL_TENSION) : null;
      target = tb === null ? tp : 0.7 * tp + 0.3 * tb;
    }
    const dt = this.lastTick === null ? 0 : Math.min(1000, now - this.lastTick);
    this.lastTick = now;
    this.tension += (target - this.tension) * (1 - Math.exp(-dt / 2500));
    return { phase, pulse, breath, basePulse: this.basePulse, baseBreath: this.baseBreath, calibrationPct, tension: this.tension };
  }
}
