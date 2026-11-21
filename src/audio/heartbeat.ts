/** Synthesised lub-dub. Two modes, chosen live by isSynced():
 *  - synced: trigger() is called for each beat detected in the SDK's pulse waveform;
 *  - paced:  otherwise it ticks at the smoothed measured pulse rate.
 *  Pitch rises with tension in both modes. */
export function createHeartbeat(
  getBpm: () => number | null, getTension: () => number, onBeat: () => void, isSynced: () => boolean,
) {
  let ctx: AudioContext | null = null; let timer: ReturnType<typeof setTimeout> | undefined; let on = false;
  const thump = (when: number, freq: number, peak: number) => {
    if (!ctx) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq * 1.6, when);
    o.frequency.exponentialRampToValueAtTime(freq, when + 0.09);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    o.connect(g).connect(ctx.destination); o.start(when); o.stop(when + 0.25);
  };
  const play = () => {
    if (!ctx) return; const t = ctx.currentTime; const f = 50 + getTension() * 30;
    thump(t, f, 0.9); thump(t + 0.17, f * 0.86, 0.55); onBeat();
  };
  const loop = () => {
    if (!on) return;
    if (isSynced()) { timer = setTimeout(loop, 250); return; }
    const bpm = getBpm();
    if (bpm) play();
    timer = setTimeout(loop, bpm ? 60000 / Math.min(180, Math.max(40, bpm)) : 1000);
  };
  return {
    start() { ctx ??= new AudioContext(); void ctx.resume(); if (!on) { on = true; loop(); } },
    stop() { on = false; if (timer) clearTimeout(timer); },
    trigger() { if (on && isSynced()) play(); },
  };
}