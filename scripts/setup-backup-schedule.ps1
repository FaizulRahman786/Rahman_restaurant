param(
  [string]$TaskName = 'RestaurantWebsiteDailyBackup',
  [string]$Time = '02:00',
  [int]$KeepLast = 14,
  [string]$BackupRoot = './backups'
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Get-Location).Path
$powershellPath = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$backupScript = Join-Path $projectRoot 'scripts\backup-website.ps1'
$resolvedBackupRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $BackupRoot))

if (-not (Test-Path $backupScript)) {
  throw "Backup script not found: $backupScript"
}

if (-not (Get-Command schtasks.exe -ErrorAction SilentlyContinue)) {
  throw 'schtasks.exe is unavailable on this system.'
}

$null = [DateTime]::ParseExact($Time, 'HH:mm', $null)

$argumentList = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', ('"' + $backupScript + '"'),
  '-BackupRoot', ('"' + $resolvedBackupRoot + '"'),
  '-KeepLast', $KeepLast
) -join ' '

$taskCommand = ('"' + $powershellPath + '" ' + $argumentList)
$fullUser = "$env:USERDOMAIN\$env:USERNAME"

$createOutput = & schtasks.exe /Create /F /SC DAILY /ST $Time /TN $TaskName /TR $taskCommand /RU $fullUser 2>&1
if ($LASTEXITCODE -ne 0) {
  throw ("Failed to create scheduled task. " + ($createOutput -join [Environment]::NewLine))
}

Write-Output 'SCHEDULE_STATUS=SUCCESS'
Write-Output "TASK_NAME=$TaskName"
Write-Output "TASK_TIME=$Time"
Write-Output "BACKUP_ROOT=$resolvedBackupRoot"
Write-Output "KEEP_LAST=$KeepLast"
