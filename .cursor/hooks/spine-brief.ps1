# Inject Spine session_brief into Cursor agent context. Fail-open always.
$ErrorActionPreference = 'Continue'
try {
  $raw = [Console]::In.ReadToEnd()
  if (-not $raw) { $raw = '{}' }
  $project = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
  $brief = (($raw | & spine --project $project brief --hook --budget 2000 2>$null) | Out-String).Trim()
  if (-not $brief) {
    Write-Output '{}'
    exit 0
  }
  if ($brief.Length -gt 14000) {
    $brief = $brief.Substring(0, 14000) + "`n...(truncated; use spine get_section / recall)"
  }
  $payload = [ordered]@{
    additional_context = "# Spine warm-start (injected — do not re-read PROGRESS/CONTEXT whole)`n`n$brief"
  }
  $payload | ConvertTo-Json -Compress
  exit 0
} catch {
  Write-Output '{}'
  exit 0
}
