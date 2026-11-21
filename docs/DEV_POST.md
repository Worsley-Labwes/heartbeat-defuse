---
title: Pulse Defuse: a bomb that listens to your heartbeat
tags: devchallenge, presagechallenge, presage, ai
---

_This is a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/devteam/join-the-presage-smartspectra-sdk-challenge-3000-in-prizes-across-10-winners-1370)_

## What I Built

**Pulse Defuse** is a desktop game where you defuse a bomb by staying calm. Your webcam reads your pulse and breathing through the SmartSpectra SDK. Panic and the clock drains faster, the wires shake harder, and the heartbeat sound gets higher. Stay steady for 5 seconds and a wire is cut.

It also has **Stillpoint**, a 3-minute paced-breathing mode (4 seconds in, 6 seconds out) that scores how closely your breathing matches the pace.

Everything is relative to _your own_ resting baseline, measured in a short calibration step, so the game is fair to every body.

## Demo

[VIDEO LINK]

[2 or 3 screenshots: the consent screen, the game with the live waveforms, Stillpoint]

## Code

[GITHUB REPO LINK]

Setup is in the README (Windows, Node 20+, your own SmartSpectra API key).

## How I Used SmartSpectra

| SDK value                      | What it does in the game                   |
| ------------------------------ | ------------------------------------------ |
| `cardio.pulseRate`             | Game tension, clock drain, wire shake      |
| `breathing.rate`               | Part of tension; Stillpoint pace score     |
| `cardio.arterialPressureTrace` | Live "Pulse wave" scope and beat detection |
| `breathing.upperTrace`         | Live "Breathing wave" scope                |

Design decisions that come from how the signal behaves:

- I only use values the SDK marks `stable`, and smooth them with a rolling median.
- The SDK runs in Electron's main process. The page only receives numbers, so a busy UI can't stall the camera.
- The readings lag, so the game says so and pauses the clock if the signal is lost.
- The heartbeat sound has two modes, shown live on screen: [CHOOSE ONE AFTER YOUR TEST RUN: "locked to beats detected in the pulse waveform" / "paced to the smoothed pulse rate, because the waveform arrived too late for live syncing (about X s)"].

## Consent and Data Handling

- **Consent:** nothing starts until the player ticks a consent box and presses _Turn on camera_. A permanent "Camera on" indicator and a Stop button are always visible.
- **What is read:** pulse and breathing rate from the webcam, only while the game is open.
- **Storage and retention:** none. No video, images or readings are saved by the app. Values live in memory and disappear when it closes.
- **Sharing:** the app has no backend, accounts or analytics and uploads nothing itself.
- **SDK network use:** the SmartSpectra SDK contacts Presage's servers to measure vitals. [PASTE THE EXACT WORDING FROM PRESAGE'S TELEMETRY AND PRIVACY PAGE HERE.]
- **SDK telemetry:** the SDK enables telemetry by default. I turn it off (`enableTelemetry: false`).
- **Optional AI services:** none.
- **Deletion:** nothing is stored, so there is nothing to delete.
- **Not medical:** this is a game. It makes no diagnosis, treatment or health claims.

## Prize Categories

- **Most Creative or Delightful Use:** your own pulse and breathing are the game controller.
- **Best Thoughtful Real-World Use:** consent-first design, no retention, honest limits, and a paced-breathing mode that teaches a common relaxation exercise.

## Limitations

- Breathing is a weaker signal than pulse, so pulse drives the main game.
- Measurement happens off-device, so there is a processing delay, which the app displays.
- A simulated-signal mode exists only for development without a camera. It is always labelled and is not used in the demo.
