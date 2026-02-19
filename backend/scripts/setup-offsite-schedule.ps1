param(
  [string]$TaskName = 'RestaurantWebsiteWeeklyOffsiteBackup',
  [string]$Day = 'SUN',
  [string]$Time = '03:30',
  [int]$KeepLast = 12,
  [string]$OffsiteRoot = '',
  [string]$SecondaryOffsiteRoot = ''
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Get-Location).Path
$powershellPath = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$offsiteScript = Join-Path $projectRoot 'scripts\copy-backup-offsite.ps1'
$taskWrapperScript = Join-Path $projectRoot 'scripts\run-offsite-backup-task.ps1'

if (-not (Test-Path $offsiteScript)) {
  throw "Offsite copy script not found: $offsiteScript"
}

if (-not (Get-Command schtasks.exe -ErrorAction SilentlyContinue)) {
  throw 'schtasks.exe is unavailable on this system.'
}

$null = [DateTime]::ParseExact($Time, 'HH:mm', $null)

if ([string]::IsNullOrWhiteSpace($OffsiteRoot)) {
  if (-not [string]::IsNullOrWhiteSpace($env:OneDrive)) {
    $OffsiteRoot = Join-Path $env:OneDrive 'Website-Offsite-Backups\resturant'
  } else {
    $OffsiteRoot = Join-Path $env:USERPROFILE 'Documents\Website-Offsite-Backups\resturant'
  }
}

if ([string]::IsNullOrWhiteSpace($SecondaryOffsiteRoot)) {
  $SecondaryOffsiteRoot = Join-Path $env:USERPROFILE 'Documents\Website-Offsite-Backups-Secondary\resturant'
}

$resolvedOffsiteRoot = [System.IO.Path]::GetFullPath($OffsiteRoot)
$resolvedSecondaryOffsiteRoot = [System.IO.Path]::GetFullPath($SecondaryOffsiteRoot)

$wrapperContent = @"
`$ErrorActionPreference = 'Stop'
Set-Location -Path "$projectRoot"
& "$offsiteScript" -OffsiteRoot "$resolvedOffsiteRoot" -SecondaryOffsiteRoot "$resolvedSecondaryOffsiteRoot" -KeepLast $KeepLast
"@

Set-Content -Path $taskWrapperScript -Value $wrapperContent -Encoding UTF8

$argumentList = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', ('"' + $taskWrapperScript + '"')
) -join ' '

$taskCommand = ('"' + $powershellPath + '" ' + $argumentList)
$fullUser = "$env:USERDOMAIN\$env:USERNAME"

$createOutput = & schtasks.exe /Create /F /SC WEEKLY /D $Day /ST $Time /TN $TaskName /TR $taskCommand /RU $fullUser 2>&1
if ($LASTEXITCODE -ne 0) {
  throw ("Failed to create offsite scheduled task. " + ($createOutput -join [Environment]::NewLine))
}

Write-Output 'OFFSITE_SCHEDULE_STATUS=SUCCESS'
Write-Output "TASK_NAME=$TaskName"
Write-Output "TASK_DAY=$Day"
Write-Output "TASK_TIME=$Time"
Write-Output "OFFSITE_ROOT=$resolvedOffsiteRoot"
Write-Output "SECONDARY_OFFSITE_ROOT=$resolvedSecondaryOffsiteRoot"
Write-Output "KEEP_LAST=$KeepLast"
