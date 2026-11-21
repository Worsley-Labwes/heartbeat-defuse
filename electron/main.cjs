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
const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const toMs = (ts) => (typeof ts === 'number' ? ts : ts && typeof ts.toNumber === 'function' ? ts.toNumber() : Number(ts)) / 1000; // SDK timestamps are microseconds
const trace = (list) => arr(list).filter((m) => typeof m?.value === 'number').map((m) => ({ t: toMs(m.timestamp), v: m.value }));
const latest = (list) => {
  const m = arr(list).filter((v) => typeof v?.value === 'number');
  return m.length ? m[m.length - 1] : null;
};

async function startSdk() {
  if (running) return { ok: true };
  loadEnvFile();
  const apiKey = process.env.SMARTSPECTRA_API_KEY;
  if (!apiKey) return { ok: false, error: 'Missing SMARTSPECTRA_API_KEY. Copy .env.example to .env and add your key.' };
  try {
    const { SmartSpectraSDK, CameraSelection, MetricType, breathingMetrics, cardioMetrics, decodeMetrics } =
      require('@smartspectra/node-sdk');
    sdk = new SmartSpectraSDK({
      apiKey,
      requestedMetrics: [...new Set([...breathingMetrics, ...cardioMetrics, MetricType.ARTERIAL_PRESSURE_TRACE])],
      enableTelemetry: false, // default is TRUE in the SDK; we opt out and say so in the README
    });
    sdk.on('metrics', (buf) => {
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
    sdk.on('validationStatus', (code, _ts, hint) => send('vitals:validation', { code, hint }));
    sdk.on('processingStatus', (status) => send('vitals:processing', { status }));
    sdk.on('error', (code, message, retryable) => send('vitals:error', { code, message, retryable }));
    sdk.useCamera(CameraSelection.default, { width: 1280, height: 720 });
    sdk.start();
    running = true;
    send('vitals:state', { camera: 'on' });
    return { ok: true };
  } catch (e) {
    running = false;
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
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