---
kind: insight
title: Hermetic mock Decision MCP for probe smoke
tags: [decision, t75, testing]
paths: [tests, src/main/decision]
sha: ceaca65
agent: cursor
created: 2026-10-28
updated: 2026-10-28
---
# Hermetic mock Decision MCP for probe smoke

When Unsloth/KEV LAN is down, a tiny in-test HTTP mock implementing streamable MCP initialize + tools/call (system_one/kev_evaluate) lets Settings probe and decision-shadow stay verifiable without substituting the live T62 gate.
