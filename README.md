# Pulse Defuse

A bomb that listens to your heartbeat. Stay calm and you cut the wires; panic and the clock runs faster, the wires shake, and the pulse-paced heartbeat thumps higher. Includes **Stillpoint**, a 3-minute paced-breathing mode (4 s in, 6 s out = 6 breaths/min).

Built for the DEV x Presage SmartSpectra SDK Challenge with `@smartspectra/node-sdk`.

## Signals used (live, from the webcam)
| SDK value | Used for |
|---|---|
| `cardio.pulseRate` (value, `stable`) | Game tension, clock drain, wire shake, heartbeat sound rate |
| `breathing.rate` (value, `stable`) | 30% of tension when available; Stillpoint pace match |

Only values the SDK marks `stable` are used. Tension is **relative to your own resting baseline**, measured in a short calibration step, so the game is fair to every body.

## Run it (Windows, Node 20+)
1. Keep the project in a folder path with **only ASCII characters** (the SDK's native runtime can fail otherwise).
2. `npm install` (downloads native runtimes for every platform, a few hundred MB).
3. Copy `.env.example` to `.env`, paste your SmartSpectra API key.
4. `npm run dev` for the desktop app with the camera. `npm run web` opens a browser version with a clearly labelled **simulated** signal (development only).
5. `npm test` runs the signal-filter tests.

## Consent and data handling
- **Consent:** nothing starts until the player ticks the consent box and presses *Turn on camera*. A persistent "Camera on" indicator and a **Stop** button are always visible.
- **Storage:** none. No video, images, or readings are saved by this app. Values live in memory only.
- **Sharing:** the app uploads nothing itself and has no backend, accounts, or analytics.
- **SDK network use:** the SmartSpectra SDK contacts Presage's servers to measure vitals (it needs an API key). See Presage's Telemetry and Privacy documentation for exactly what is sent.
- **SDK telemetry:** the SDK's `enableTelemetry` option defaults to `true`. We set it to `false` in `electron/main.cjs`.
- **Optional AI services:** none are used.
- **Renderer lockdown:** the SDK runs in the Electron main process. The page has no Node access, receives only numbers over IPC, and every browser permission request is denied.
- **Not medical:** this is a game. It makes no diagnosis, treatment, or health claims and must not be used for medical decisions. "Tension" and "calm" are game terms.

## Honest limitations
- The heartbeat sound is **paced to your measured pulse rate** (smoothed), not synchronised to each individual beat.
- SDK values are averaged, so they lag. The game says so and the clock pauses if the signal is lost.
- Breathing is the weaker signal; pulse drives the main game.
- The simulated signal exists only to develop without a camera and is always labelled.
