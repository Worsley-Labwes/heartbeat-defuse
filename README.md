# Pulse Defuse

A bomb that listens to your heartbeat. Stay calm and you cut the wires; panic and the clock runs faster, the wires shake, and the pulse-paced heartbeat thumps higher. Includes **Stillpoint**, a 3-minute paced-breathing mode (4 s in, 6 s out = 6 breaths/min).

Built for the DEV x Presage SmartSpectra SDK Challenge with `@smartspectra/node-sdk`.

## Signals used (live, from the webcam)

| SDK value                            | Used for                                                    |
| ------------------------------------ | ----------------------------------------------------------- |
| `cardio.pulseRate` (value, `stable`) | Game tension, clock drain, wire shake, heartbeat sound rate |
| `breathing.rate` (value, `stable`)   | 30% of tension when available; Stillpoint pace match        |

Only values the SDK marks `stable` are used. Tension is **relative to your own resting baseline**, measured in a short calibration step, so the game is fair to every body.

## Run it (Windows, Node 20+)

1. Keep the project in a folder path with **only ASCII characters** (the SDK's native runtime can fail otherwise).
2. `npm install` (downloads native runtimes for every platform, a few hundred MB).
3. Copy `.env.example` to `.env`, paste your SmartSpectra API key.
4. `npm run dev` for the desktop app with the camera. `npm run web` opens a browser version with a clearly labelled **simulated** signal (development only).
5. `npm test` runs the signal-filter tests.

## Consent and Data Handling

- **Consent:** nothing starts until the player ticks a consent box and presses _Turn on camera_. A permanent "Camera on" indicator and a Stop button are always visible.
- **What is read:** pulse and breathing rate, plus the pulse and breathing waveforms, from the webcam, only while the game is open.
- **Storage by this app:** none. No video, images or readings are saved. Values live in memory and disappear when the app closes.
- **Storage by the SDK:** the SmartSpectra SDK keeps a device key file (and related SDK data) on the PC under `%LOCALAPPDATA%\Presage\Physiology\`. This app does not read it. On Windows, if the SDK cannot read its saved key back, the app moves that file aside (as `device_keys.secure.bak`) so the SDK can create a new one.
- **Retention and deletion:** this app retains nothing. To remove the SDK's files, close the app and delete the `Presage` folder under `%LOCALAPPDATA%`.
- **Sharing and network use:** the app has no backend, accounts or analytics. The SmartSpectra SDK contacts Presage's servers (to register the device and download its measurement model). I could not confirm from Presage's documentation exactly what is sent during measurement, so see Presage's Telemetry and Privacy documentation for the authoritative answer. Per the SDK's own code documentation, its optional telemetry can contain free text, paths and platform context, can be linked to an account or device, and does not include raw frames or measured vitals. This app turns telemetry off.
- **SDK telemetry:** the SDK's `enableTelemetry` option defaults to on. This app sets it to `false`.
- **Optional AI services:** none.
- **Not medical:** this is a game. It makes no diagnosis, treatment or health claims.

## Honest limitations

- The heartbeat sound is **paced to your measured pulse rate** (smoothed), not synchronised to each individual beat.
- SDK values are averaged, so they lag. The game says so and the clock pauses if the signal is lost.
- Breathing is the weaker signal; pulse drives the main game.
- The simulated signal exists only to develop without a camera and is always labelled.

## Where the SmartSpectra SDK is used

- `electron/main.cjs`: creates the SDK (`new SmartSpectraSDK`, `requestedMetrics`, `enableTelemetry: false`), opens the camera (`useCamera`, `start`), decodes `metrics` events and sends pulse, breathing and waveform values to the UI.
- `src/signal/filter.ts`: turns stable pulse and breathing values into a personal "tension" signal.
- `src/signal/beats.ts`: detects beats in the pulse waveform.
- `src/screens/Scope.tsx`: draws the live pulse and breathing waveforms.

## Troubleshooting (Windows)

If the app reports "SmartSpectra configuration failed" with a `device_id is required` message in the terminal, the SDK could not read its saved device key. The app moves the key aside and retries automatically.
