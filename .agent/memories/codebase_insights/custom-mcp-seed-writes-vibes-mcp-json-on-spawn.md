---
kind: insight
title: Custom MCP seed writes .vibes/mcp.json on spawn
tags: [mcp, settings, t69]
paths: [src/main/roles/mcp-writer.ts, src/renderer/SettingsTab.tsx]
sha: a36c9e6
agent: cursor
created: 2026-10-28
updated: 2026-10-28
---
# Custom MCP seed writes .vibes/mcp.json on spawn

Settings customMcp* (enabled/name/command/args/url) are persisted in the settings store and passed into writeVibesMcpJson on mission spawn alongside html-design-advisor. HTTP url wins over stdio; names are sanitized to [a-z0-9_-]. This is a thin registry seed, not a marketplace. gh pr create often defaults base to a stale feature branch — always retarget --base main.
