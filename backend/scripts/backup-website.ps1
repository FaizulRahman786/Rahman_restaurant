param(
  [string]$BackupRoot = "./backups",
  [int]$KeepLast = 10
)

$ErrorActionPreference = 'Stop'

function Get-DatabaseUrl {
  $fromEnv = $env:DATABASE_URL
  if (-not [string]::IsNullOrWhiteSpace($fromEnv)) {
    return $fromEnv
  }

  $envFile = Join-Path (Get-Location) '.env'
  if (-not (Test-Path $envFile)) {
    return $null
  }

  $line = Get-Content $envFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  return (($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim())
}

function Get-DbConnectionInfo {
  param([string]$DatabaseUrl)

  if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    return $null
  }

  try {
    $uri = [System.Uri]$DatabaseUrl
    $dbName = $uri.AbsolutePath.TrimStart('/')
    $userInfo = $uri.UserInfo -split ':', 2
    $dbUser = $null

    if ($userInfo.Length -gt 0 -and -not [string]::IsNullOrWhiteSpace($userInfo[0])) {
      $dbUser = $userInfo[0]
    }

    return [PSCustomObject]@{
      Url = $DatabaseUrl
      Database = $dbName
      User = $dbUser
      Host = $uri.Host
      Port = $uri.Port
    }
  } catch {
    return $null
  }
}

$projectRoot = (Get-Location).Path
$backupRootFull = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $BackupRoot))
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $backupRootFull "website-backup-$timestamp"

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$filesArchive = Join-Path $backupDir "website-files-$timestamp.zip"
$dbBackupFile = Join-Path $backupDir "database-$timestamp.sql"
$dbJsonBackupFile = Join-Path $backupDir "database-$timestamp.json"
$manifestFile = Join-Path $backupDir "manifest.json"

Write-Output "[1/4] Creating project files archive..."
Push-Location $projectRoot
try {
  if (Test-Path $filesArchive) {
    Remove-Item $filesArchive -Force
  }

  tar -a -cf $filesArchive `
    --exclude=node_modules `
    --exclude=.venv `
    --exclude=.git `
    --exclude=backups `
    --exclude=*.log `
    *
} finally {
  Pop-Location
}

if (-not (Test-Path $filesArchive)) {
  throw 'Failed to create files archive.'
}

Write-Output "[2/4] Backing up database..."
$databaseUrl = Get-DatabaseUrl
$dbInfo = Get-DbConnectionInfo -DatabaseUrl $databaseUrl
$dbBackupMode = 'none'
$dbBackupSuccess = $false
$dbBackupError = $null
$dbBackupPath = $null

if ($dbInfo -and -not [string]::IsNullOrWhiteSpace($dbInfo.Database)) {
  $pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue

  if ($pgDump) {
    try {
      & $pgDump.Source --dbname=$($dbInfo.Url) --no-owner --no-privileges --file $dbBackupFile
      if ($LASTEXITCODE -eq 0 -and (Test-Path $dbBackupFile)) {
        $dbBackupSuccess = $true
        $dbBackupMode = 'pg_dump'
        $dbBackupPath = $dbBackupFile
      } else {
        $dbBackupError = 'pg_dump command failed.'
      }
    } catch {
      $dbBackupError = $_.Exception.Message
    }
  }

  if (-not $dbBackupSuccess) {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if ($docker) {
      try {
        $containerName = (& docker ps --format "{{.Names}}" | Where-Object { $_ -eq 'rahman-postgres' } | Select-Object -First 1)
        if ($containerName) {
          $dbUser = if ([string]::IsNullOrWhiteSpace($dbInfo.User)) { 'postgres' } else { $dbInfo.User }
          $dumpOutput = & docker exec $containerName pg_dump -U $dbUser -d $dbInfo.Database --no-owner --no-privileges
          $dumpOutput | Out-File -FilePath $dbBackupFile -Encoding utf8
          if ($LASTEXITCODE -eq 0 -and (Test-Path $dbBackupFile)) {
            $dbBackupSuccess = $true
            $dbBackupMode = 'docker-exec'
            $dbBackupPath = $dbBackupFile
            $dbBackupError = $null
          } else {
            $dbBackupError = 'docker pg_dump command failed.'
          }
        } else {
          $dbBackupError = 'Postgres container rahman-postgres is not running.'
        }
      } catch {
        $dbBackupError = $_.Exception.Message
      }
    }
  }

  if (-not $dbBackupSuccess) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCommand) {
      try {
        $env:DATABASE_URL = $dbInfo.Url
        & $nodeCommand.Source ./scripts/db-json-backup.js $dbJsonBackupFile
        if ($LASTEXITCODE -eq 0 -and (Test-Path $dbJsonBackupFile)) {
          $dbBackupSuccess = $true
          $dbBackupMode = 'json-export'
          $dbBackupPath = $dbJsonBackupFile
          $dbBackupError = $null
        } else {
          $dbBackupError = 'JSON fallback export command failed.'
        }
      } catch {
        $dbBackupError = $_.Exception.Message
      }
    } elseif (-not $dbBackupError) {
      $dbBackupError = 'Node.js was not found for JSON fallback export.'
    }
  }
} else {
  $dbBackupError = 'DATABASE_URL is missing or invalid.'
}

if ($dbBackupSuccess) {
  Write-Output "Database backup created: $dbBackupPath"
} else {
  Write-Warning "Database backup skipped or failed. Reason: $dbBackupError"
}

Write-Output "[3/4] Writing backup manifest..."
$filesHash = (Get-FileHash -Path $filesArchive -Algorithm SHA256).Hash
$dbHash = $null
if ($dbBackupPath -and (Test-Path $dbBackupPath)) {
  $dbHash = (Get-FileHash -Path $dbBackupPath -Algorithm SHA256).Hash
}

$manifest = [PSCustomObject]@{
  createdAt = (Get-Date).ToString('o')
  projectRoot = $projectRoot
  backupDirectory = $backupDir
  filesArchive = [PSCustomObject]@{
    path = $filesArchive
    sha256 = $filesHash
  }
  databaseBackup = [PSCustomObject]@{
    path = if ($dbBackupPath -and (Test-Path $dbBackupPath)) { $dbBackupPath } else { $null }
    sha256 = $dbHash
    mode = $dbBackupMode
    success = $dbBackupSuccess
    error = $dbBackupError
  }
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestFile -Encoding utf8

Write-Output "[4/4] Applying retention policy..."
$existingBackups = Get-ChildItem -Path $backupRootFull -Directory -Filter 'website-backup-*' | Sort-Object CreationTime -Descending
if ($existingBackups.Count -gt $KeepLast) {
  $toDelete = $existingBackups | Select-Object -Skip $KeepLast
  foreach ($item in $toDelete) {
    Remove-Item -Path $item.FullName -Recurse -Force
  }
}

Write-Output ''
Write-Output "BACKUP_STATUS=SUCCESS"
Write-Output "BACKUP_DIR=$backupDir"
Write-Output "FILES_ARCHIVE=$filesArchive"
Write-Output "DB_BACKUP_SUCCESS=$dbBackupSuccess"
Write-Output "MANIFEST=$manifestFile"
