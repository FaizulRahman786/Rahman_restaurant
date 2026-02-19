param(
  [string]$TaskName = 'RestaurantWebsiteWeeklyOffsiteBackup'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command schtasks.exe -ErrorAction SilentlyContinue)) {
  throw 'schtasks.exe is unavailable on this system.'
}

$queryOutput = & schtasks.exe /Query /TN $TaskName 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Output "OFFSITE_SCHEDULE_STATUS=NOT_FOUND"
  Write-Output "TASK_NAME=$TaskName"
  exit 0
}

$deleteOutput = & schtasks.exe /Delete /TN $TaskName /F 2>&1
if ($LASTEXITCODE -ne 0) {
  throw ("Failed to remove offsite scheduled task. " + ($deleteOutput -join [Environment]::NewLine))
}

Write-Output 'OFFSITE_SCHEDULE_STATUS=REMOVED'
Write-Output "TASK_NAME=$TaskName"
