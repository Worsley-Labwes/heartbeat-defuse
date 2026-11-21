// Electron main process. The SmartSpectra SDK runs HERE, not in the page:
// a busy renderer can then never stall camera frames. The page only receives
// plain numbers over IPC (no video, no face data, no Node access).
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DEV = process.env.PD_DEV === '1';
let sdk = null;
let win = null;
let running = false;

function loadEnvFile() {
  try {
    const txt = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* .env is optional */ }
}

const send = (channel, payload) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const toMs = (ts) => (typeof ts === 'number' ? ts : ts && typeof ts.toNumber === 'function' ? ts.toNumber() : Number(ts)) / 1000; // SDK timestamps are microseconds
const trace = (list) => arr(list).filter((m) => typeof m?.value === 'number').map((m) => ({ t: toMs(m.timestamp), v: m.value }));
const latest = (list) => {
  const m = arr(list).filter((v) => typeof v?.value === 'number');
  return m.length ? m[m.length - 1] : null;
};

// Camera modes to try in order (lightest first). Many webcams cannot open an arbitrary mode.
const CAMERA_MODES = [
  { width: 640, height: 360, fps: 30 },
  { width: 960, height: 540, fps: 30 },
  { width: 640, height: 480, fps: 30 },
  { width: 1280, height: 720, fps: 30 },
  { width: 1280, height: 720 },
];

// Windows only. On some PCs the SDK cannot read back the device key it saved on an earlier run
// ("NCryptDecrypt ... Invalid flags", then "device_id is required for remote model download"),
// which makes start() fail with code 3. Moving the saved key aside makes the SDK provision a
// fresh one. We only do this AFTER such a failure, so working machines are never touched.
function clearDeviceKey() {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) return;
  const f = path.join(process.env.LOCALAPPDATA, 'Presage', 'Physiology', 'com_presagetech_smartspectra_emd', 'emd', 'device_keys.secure');
  try {
    if (fs.existsSync(f)) {
      fs.renameSync(f, f + '.bak');
      console.log('[pulse-defuse] moved the saved SDK device key aside; the SDK will provision a new one');
    }
  } catch (e) { console.error('[pulse-defuse] could not move the device key file:', e); }
}

function buildSdk(apiKey, lib) {
  const { SmartSpectraSDK, MetricType, breathingMetrics, cardioMetrics, decodeMetrics } = lib;
  const s = new SmartSpectraSDK({
    apiKey,
    requestedMetrics: [...new Set([...breathingMetrics, ...cardioMetrics, MetricType.ARTERIAL_PRESSURE_TRACE])],
    enableTelemetry: false, // default is TRUE in the SDK; we opt out and say so in the README
  });
  const live = () => s === sdk; // ignore events from attempts we already gave up on
  const startupErrors = [];     // every error event, kept for diagnostics
  s.pdErrors = startupErrors;
  s.on('metrics', (buf) => {
    if (!live()) return;
    const d = decodeMetrics(buf);
    const pt = trace(d.cardio?.arterialPressureTrace); const bt = trace(d.breathing?.upperTrace);
    if (pt.length || bt.length) send('vitals:trace', { pulse: pt, breath: bt });
    const p = latest(d.cardio?.pulseRate);
    const b = latest(d.breathing?.rate);
    if (!p && !b) return;
    send('vitals:sample', {
      pulse: p ? p.value : undefined, pulseStable: p ? !!p.stable : false,
      breath: b ? b.value : undefined, breathStable: b ? !!b.stable : false,
    });
  });
  s.on('validationStatus', (code, _ts, hint) => { if (live()) send('vitals:validation', { code, hint }); });
  s.on('processingStatus', (status) => { if (live()) send('vitals:processing', { status }); });
  s.on('error', (code, message, retryable) => {
    startupErrors.push(`event ${code}: ${message}`);
    if (live()) send('vitals:error', { code, message, retryable });
  });
  return s;
}

async function startSdk() {
  if (running) return { ok: true };
  loadEnvFile();
  const apiKey = process.env.SMARTSPECTRA_API_KEY;
  if (!apiKey) return { ok: false, error: 'Missing SMARTSPECTRA_API_KEY. Copy .env.example to .env and add your key.' };
  let lib;
  try { lib = require('@smartspectra/node-sdk'); }
  catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  try {
    const cams = lib.SmartSpectraSDK.availableCameras();
    console.log('[pulse-defuse] cameras:', cams.map((c) => `${c.name} (${c.facing})`).join(' | ') || '(none found)');
  } catch (e) { console.error('[pulse-defuse] could not list cameras:', e); }

  const failures = [];
  let clearedKey = false;
  for (const mode of CAMERA_MODES) {
    const s = buildSdk(apiKey, lib);
    sdk = s; // set before start so early validation hints are forwarded
    try {
      s.useCamera(lib.CameraSelection.default, mode);
      await s.start();
      running = true;
      console.log('[pulse-defuse] camera mode in use:', JSON.stringify(mode));
      send('vitals:state', { camera: 'on' });
      return { ok: true };
    } catch (e) {
      console.error('[pulse-defuse] start failed for', JSON.stringify(mode), e);
      const msg = String(e && e.message ? e.message : e);
      const code = e && e.code !== undefined ? ` (code ${e.code})` : '';
      const events = s.pdErrors.length ? ` [${s.pdErrors.join('; ')}]` : '';
      failures.push(`${JSON.stringify(mode)} -> ${msg}${code}${events}`);
      sdk = null;
      try { await s.destroy(); } catch { /* ignore */ }
      if (e && e.code === 3 && !clearedKey) { clearedKey = true; clearDeviceKey(); }
      await sleep(800); // give the camera time to release before the next try
    }
  }
  running = false;
  console.error('[pulse-defuse] every camera mode failed:\n' + failures.join('\n'));
  return { ok: false, error: 'Camera start failed. First attempt: ' + failures[0] };
}

async function stopSdk() {
  const s = sdk; sdk = null; running = false;
  try { if (s) { await s.stopAsync(); await s.destroy(); } } catch { /* already stopped */ }
  send('vitals:state', { camera: 'off' });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1000, minHeight: 680,
    backgroundColor: '#1d2a2b', title: 'Pulse Defuse',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  // The page never touches the camera itself (the SDK does, natively): deny every permission.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  if (DEV) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

ipcMain.handle('vitals:start', (e) => (e.senderFrame === win?.webContents.mainFrame ? startSdk() : { ok: false, error: 'blocked' }));
ipcMain.handle('vitals:stop', async (e) => { if (e.senderFrame === win?.webContents.mainFrame) await stopSdk(); });

app.whenReady().then(createWindow);
app.on('before-quit', () => { void stopSdk(); });
app.on('window-all-closed', () => app.quit());