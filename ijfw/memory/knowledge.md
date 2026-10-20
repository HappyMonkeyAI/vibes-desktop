<!-- ijfw-schema: v1 -->
# Knowledge Base
---
type: decision
summary: Never treat a resolved MCP tool call as success; unwrap + classify evidence
stored: 2026-10-19T15:43:07.540Z
hash: a275030110dd
tags: [mcp, fastmcp, false-done, honesty-gate, url-normalization, vibes-desktop, local-ai-planner, reviewer-gate]
---
<!-- hash:a275030110dd -->
In vibes-desktop, the mission child (local-ai-planner MCP server via FastMCP) originally caught planner/executor errors and RETURNED them as normal tool text ("Mission planning failed: …", "Mission failed: …", "No mission has been planned."), and FastMCP wraps every string result as { content: [{ type: 'text', text }], isError? } — never a bare string. The desktop cast response.result to string and recorded 'done' whenever executePlanned() resolved, so a 404 (bare URL missing /v1) produced a 36ms false 'done' with zero work. |  | Fix contract now enforced on BOTH sides: | - Desktop: unwrapToolResult() extracts content[].text and throws on isError/unexpected shape; missionOutcomeFrom() marks 'done' ONLY for "Mission completed. Completed N/N tasks." with N&gt;0, everything else 'failed' with the child's raw text in LedgerEntry.detail; startMission validates the plan (zero tasks or failure text =&gt; start fails, never dispatch); recordMissionEvent takes an optional detail. | - Child: the three mission tools rethrow (FastMCP -&gt; isError) instead of returning error strings. | - Config: normalizeOpenAiBaseUrl() appends /v1 only when the URL has no path (applied in toVibesConfig for all roles AND in test-connection probe); ENABLE_REVIEWER/ENABLE_ADVERSARIAL_AUDIT emitted 'false' when no reviewer role is configured (else vibes defaults to a nonexistent gemma2:27b on the executor server).

**Why:** A resolved promise from a tool bridge is not evidence of success — the child communicates failures in-band as text and MCP errors arrive as isError:true, so the desktop must inspect and classify the payload, not the settle state.

**How to apply:** Any IPC/MCP boundary in this project: unwrap the transport envelope, treat isError as a rejection, and derive terminal status from explicit evidence in the payload (parse the child's own completion report; require N&gt;0 and N==M). Never flip a mission/task to done on resolution alone. When adding provider endpoints, normalize to the OpenAI /v1 root at the single writer boundary and reuse that function at the probe so probe and child agree.
