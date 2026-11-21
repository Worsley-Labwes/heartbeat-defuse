---

title: Pulse Defuse: a bomb that listens to your heartbeat
tags: devchallenge, presagechallenge, presage, ai

---

_This is a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/devteam/join-the-presage-smartspectra-sdk-challenge-3000-in-prizes-across-10-winners-1370)_

## What I Built

**Pulse Defuse** is a desktop game where you defuse a bomb by staying calm. Your webcam reads your pulse and breathing through the SmartSpectra SDK. Panic and the clock drains faster, the wires shake harder, and the heartbeat sound gets higher. Stay steady for a few seconds and a wire is cut.

It also has **Stillpoint**, a 3-minute paced-breathing game mode (4 seconds in, 6 seconds out) that scores how closely your breathing matches the pace.

Everything is relative to _your own_ resting baseline, measured in a short calibration step, so the game is fair to every body.

## Demo

Demo Video: https://youtu.be/q6jpJmh-MCA

(image.png)

## Code

GITHUB REPO LINK: https://github.com/Worsley-Labwes/heartbeat-defuse

The SDK integration is in `electron/main.cjs`. Setup instructions are in the README.

## How It Responds to Human Signals

| SDK value                      | What it does in the game                   |
| ------------------------------ | ------------------------------------------ |
| `cardio.pulseRate`             | Game tension, clock drain, wire shake      |
| `breathing.rate`               | Part of tension; Stillpoint pace score     |
| `cardio.arterialPressureTrace` | Live "Pulse wave" scope and beat detection |
| `breathing.upperTrace`         | Live "Breathing wave" scope                |

Design decisions that come from how the signal behaves:

- I only use values the SDK marks `stable`, and smooth them with a rolling median.
- Tension is measured against your own resting baseline, not a fixed number.
- The SDK runs in Electron's main process. The page only receives numbers, so a busy UI can't stall the camera.
- The readings lag, so the game says so and pauses the clock if the signal is lost.
- The heartbeat sound has two modes, shown live on screen. In my test run it was paced to the smoothed pulse rate. It switches to beat-locked sound only when beats detected in the pulse waveform arrive promptly and agree with the measured rate, and otherwise stays with the average rate.

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

## Prize Categories

- **Most Creative or Delightful Use:** your own pulse and breathing are the game controller.
- **Best Thoughtful Real-World Use:** consent-first design, no retention by the app, honest limits, and a paced-breathing game mode that makes no health claims.

## Testing instructions for judges

1. You need Windows 10 or 11, Node 20+ and a webcam.
2. Get a free SmartSpectra API key from the Presage developer portal (my key is not included in the repo).
3. `git clone https://github.com/Worsley-Labwes/heartbeat-defuse`, then `cd pulse-defuse` and `npm install`. It downloads the SDK's native runtimes, so it is large.
4. Copy `.env.example` to `.env` and paste your key after `SMARTSPECTRA_API_KEY=`.
5. `npm run dev`. Tick the consent box and click **Turn on camera**. Face the camera with your face and upper chest in view and good light on your face. Calibration takes about 20 to 40 seconds.
6. No camera? `npm run web` opens the UI with a clearly labelled **simulated** signal. It is for browsing the interface only and does not use the SDK.

## Limitations

- Breathing is a weaker signal than pulse, so pulse drives the main game.
- Measurement involves Presage's servers and takes time, so readings lag, and the app displays the delay.
- On one Windows machine the SDK could not read back its saved device key, so the app moves that file aside after that specific failure (see Consent and Data Handling).
- A simulated-signal mode exists only for development without a camera. It is always labelled and is not used in the demo.
