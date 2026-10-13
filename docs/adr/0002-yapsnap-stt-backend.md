# ADR-0002 — yapsnap as the sole STT backend

Status: accepted (2026-10-13)

## Context

The dashboard used the browser Web Speech API for voice commands. It only works in Chromium-based browsers, streams audio to a cloud recognizer, and offers no offline mode. Vibes Desktop must work on any desktop shell with zero cloud dependency — matching Vibes' local-first philosophy.

## Decision

yapsnap (kouhxp/yapsnap) is the sole speech-to-text backend: push-to-talk records mic audio to a temporary wav; on release, `yapsnap <wav> --lang auto` runs as a CLI child process; stdout text lands in the mission request field. sherpa-onnx Zipformer transducer, CPU-only, ~80MB model per language cached locally after first fetch, fully offline thereafter. Requires ffmpeg on PATH (documented install hint via yapsnap-doctor).

## Consequences

- Voice input works identically on Windows/macOS/Linux with no browser dependency and no audio leaving the machine.
- First-use friction: model download (~80MB) — mitigated by a doctor screen that pre-fetches models in a controlled step; app launch never blocks on it.
- No wake-word listening loop in v1 (the dashboard had one); push-to-talk only. Wake word can be added later as an opt-in mode without changing the transcription path.
- Rejected Web Speech API outright: Chrome-only + cloud-dependent fails the local-first requirement.
