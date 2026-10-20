# ADR-0002 — yapsnap as the default STT backend

Status: accepted (2026-10-13); amended 2026-10-20 — default engine is in-app Whisper ONNX (ZeroG-style download-on-first-talk); optional OpenAI-compatible server (qwen3-asr); yapsnap CLI retained as legacy.

## Context

The dashboard used the browser Web Speech API for voice commands. It only works in Chromium-based browsers, streams audio to a cloud recognizer, and offers no offline mode. Vibes Desktop must work on any desktop shell with zero cloud dependency — matching Vibes' local-first philosophy.

## Decision

**Default engine:** in-app Whisper ONNX via `@huggingface/transformers` (same approach as ZeroG Terminal). Hold-to-talk downloads the chosen model on first release (~41 MB for tiny.en q8) and caches it; no pip/PATH dependency.

**Optional engines:**
- OpenAI-compatible `POST …/v1/audio/transcriptions` (qwen3-asr-server, whisper.cpp server, …)
- Legacy **yapsnap** CLI (ffmpeg + `pip install yapsnap`)

Rejected: Web Speech API (cloud / Chrome-only).

## Consequences

- Hold-to-talk works out of the box after a one-time model download shown on the button.
- Settings → Voice picks engine, Whisper model/precision, or server URL/key.
- No wake-word in v1; push-to-talk only.
