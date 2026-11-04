---
kind: insight
title: Unsloth Defiant Fable Q6_K probe on .5.157
tags: [unsloth, defiant-fable, reasoning, t86]
paths: [scripts/probe-defiant-fable.mjs]
sha: 3911534
agent: cursor
created: 2026-11-04
updated: 2026-11-04
---
# Unsloth Defiant Fable Q6_K probe on .5.157

Model id Kant0game/Qwen3.5-9B-The-Defiant-Fable-Uncensored-Heretic-NEO-IMATRIX-MAX-MTP-GGUF (Q6_K) serves on http://192.168.5.157:8888/v1. Warm ping ~340ms; cold ~5s. With enable_thinking / REASON markers, answers often land in reasoning_content with empty content (same AgentWorld pattern — vibes already promotes reasoning→content when no tools). Studio rejects Heretic-only reasoning_effort values (imedium/spoon/einstein); allowed kwargs: none|minimal|low|medium|high|max|xhigh. Use chatMarker {REASON:spoon|einstein} for Heretic modes; keep API effort Studio-safe. Probe script: scripts/probe-defiant-fable.mjs.
