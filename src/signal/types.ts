export interface RawSample {
  pulse?: number; pulseStable?: boolean;
  breath?: number; breathStable?: boolean;
}
export type Phase = 'waiting' | 'calibrating' | 'live' | 'lost';
export interface Reading {
  phase: Phase;
  pulse: number | null;      // smoothed BPM (median of recent stable values)
  breath: number | null;     // smoothed breaths/min
  basePulse: number | null;  // your own resting baseline, measured at the start
  baseBreath: number | null;
  calibrationPct: number;    // 0..1
  tension: number;           // 0 (settled) .. 1 (frantic), relative to YOUR baseline
}
export interface VitalsBridge {
  start(): Promise<{ ok: boolean; error?: string }>;
  stop(): Promise<void>;
  onSample(cb: (s: RawSample) => void): () => void;
  onTrace(cb: (b: TraceBatch) => void): () => void;
  onValidation(cb: (v: { code: number; hint: string }) => void): () => void;
  onProcessing(cb: (v: { status: number }) => void): () => void;
  onError(cb: (v: { code: number; message: string; retryable: boolean }) => void): () => void;
  onState(cb: (v: { camera: 'on' | 'off' }) => void): () => void;
}
declare global { interface Window { vitals?: VitalsBridge } }

export interface TracePoint { t: number; v: number } // t = ms since epoch (SDK clock), v = raw waveform value
export interface TraceBatch { pulse: TracePoint[]; breath: TracePoint[] }