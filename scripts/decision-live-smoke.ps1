# T62 one-shot: live Decision shadow against Unsloth/KEV MCP.
# Usage (PowerShell):
#   $env:KEV_MCP_URL = "http://host:8888/mcp/"
#   $env:UNSLOTH_API_KEY = "sk-unsloth-…"   # or KEV_MCP_AUTH_TOKEN for classic KEV
#   .\scripts\decision-live-smoke.ps1
#
# Does not print secrets. Exits non-zero if the host is down or the shadow fails.

$ErrorActionPreference = "Stop"
$url = ($env:KEV_MCP_URL ?? "").Trim()
$token = ($env:KEV_MCP_AUTH_TOKEN ?? "").Trim()
if (-not $token -and ($url.ToLower().Contains("unsloth") -or $url.ToLower().Contains(":8888"))) {
  $token = (($env:UNSLOTH_API_KEY ?? "").Trim())
  if (-not $token) { $token = (($env:UNSLOTH_STUDIO_API_KEY ?? "").Trim()) }
}

if (-not $url -or -not $token) {
  Write-Error "Set KEV_MCP_URL and a bearer (KEV_MCP_AUTH_TOKEN or UNSLOTH_API_KEY for :8888)."
}

Write-Host "Probing Decision MCP GET $url …"
try {
  $headers = @{ Authorization = "Bearer $token"; Accept = "application/json, text/event-stream" }
  Invoke-WebRequest -Uri $url -Headers $headers -Method GET -TimeoutSec 8 -UseBasicParsing | Out-Null
  Write-Host "Host answered (bare GET)."
} catch {
  Write-Error "Decision MCP unreachable: $($_.Exception.Message)"
}

$env:VIBES_DECISION_LIVE = "1"
Write-Host "Running decision-shadow e2e…"
npm run test:decision-live
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "T62 decision shadow OK."
