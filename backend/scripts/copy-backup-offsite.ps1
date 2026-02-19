param(
  [string]$SourceRoot = './backups',
  [string]$OffsiteRoot = '',
  [string]$SecondaryOffsiteRoot = '',
  [int]$KeepLast = 12
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Get-Location).Path
$sourceRootFull = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $SourceRoot))

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

$offsiteRootFull = [System.IO.Path]::GetFullPath($OffsiteRoot)
$secondaryOffsiteRootFull = [System.IO.Path]::GetFullPath($SecondaryOffsiteRoot)

if (-not (Test-Path $sourceRootFull)) {
  throw "Source backup folder not found: $sourceRootFull"
}

$latestBackup = Get-ChildItem -Path $sourceRootFull -Directory -Filter 'website-backup-*' |
  Sort-Object CreationTime -Descending |
  Select-Object -First 1

if (-not $latestBackup) {
  throw 'No backup snapshots found. Run: npm run backup:site'
}

New-Item -ItemType Directory -Path $offsiteRootFull -Force | Out-Null
New-Item -ItemType Directory -Path $secondaryOffsiteRootFull -Force | Out-Null

$destination = Join-Path $offsiteRootFull $latestBackup.Name
if (Test-Path $destination) {
  Remove-Item -Path $destination -Recurse -Force
}

Copy-Item -Path $latestBackup.FullName -Destination $destination -Recurse -Force

$secondaryDestination = Join-Path $secondaryOffsiteRootFull $latestBackup.Name
if (Test-Path $secondaryDestination) {
  Remove-Item -Path $secondaryDestination -Recurse -Force
}

Copy-Item -Path $latestBackup.FullName -Destination $secondaryDestination -Recurse -Force

$offsiteBackups = Get-ChildItem -Path $offsiteRootFull -Directory -Filter 'website-backup-*' |
  Sort-Object CreationTime -Descending

if ($offsiteBackups.Count -gt $KeepLast) {
  $toDelete = $offsiteBackups | Select-Object -Skip $KeepLast
  foreach ($item in $toDelete) {
    Remove-Item -Path $item.FullName -Recurse -Force
  }
}

$secondaryOffsiteBackups = Get-ChildItem -Path $secondaryOffsiteRootFull -Directory -Filter 'website-backup-*' |
  Sort-Object CreationTime -Descending

if ($secondaryOffsiteBackups.Count -gt $KeepLast) {
  $secondaryToDelete = $secondaryOffsiteBackups | Select-Object -Skip $KeepLast
  foreach ($item in $secondaryToDelete) {
    Remove-Item -Path $item.FullName -Recurse -Force
  }
}

Write-Output 'OFFSITE_COPY_STATUS=SUCCESS'
Write-Output "SOURCE_BACKUP=$($latestBackup.FullName)"
Write-Output "OFFSITE_ROOT=$offsiteRootFull"
Write-Output "OFFSITE_BACKUP=$destination"
Write-Output "SECONDARY_OFFSITE_ROOT=$secondaryOffsiteRootFull"
Write-Output "SECONDARY_OFFSITE_BACKUP=$secondaryDestination"
Write-Output "KEEP_LAST=$KeepLast"
