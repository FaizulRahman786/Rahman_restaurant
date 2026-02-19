param(
  [string]$BackupDir,
  [bool]$RestoreDatabase = $true
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
    }
  } catch {
    return $null
  }
}

$projectRoot = (Get-Location).Path
$backupRoot = Join-Path $projectRoot 'backups'

if ([string]::IsNullOrWhiteSpace($BackupDir)) {
  $latest = Get-ChildItem -Path $backupRoot -Directory -Filter 'website-backup-*' | Sort-Object CreationTime -Descending | Select-Object -First 1
  if (-not $latest) {
    throw 'No backup found. Create one with: npm run backup:site'
  }
  $BackupDir = $latest.FullName
}

if (-not (Test-Path $BackupDir)) {
  throw "Backup directory not found: $BackupDir"
}

$filesArchive = Get-ChildItem -Path $BackupDir -File -Filter 'website-files-*.zip' | Select-Object -First 1
if (-not $filesArchive) {
  throw 'Files archive is missing in the selected backup directory.'
}

$tempExtract = Join-Path $env:TEMP ("website-restore-" + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null

Write-Output "[1/3] Restoring website files..."
Expand-Archive -Path $filesArchive.FullName -DestinationPath $tempExtract -Force
Copy-Item -Path (Join-Path $tempExtract '*') -Destination $projectRoot -Recurse -Force

Write-Output "[2/3] Restoring database (optional)..."
$dbFile = Get-ChildItem -Path $BackupDir -File -Filter 'database-*.sql' | Select-Object -First 1
$dbJsonFile = Get-ChildItem -Path $BackupDir -File -Filter 'database-*.json' | Select-Object -First 1

if ($RestoreDatabase -and ($dbFile -or $dbJsonFile)) {
  $dbInfo = Get-DbConnectionInfo -DatabaseUrl (Get-DatabaseUrl)
  if ($dbInfo) {
    if ($dbFile) {
      $psql = Get-Command psql -ErrorAction SilentlyContinue
      if ($psql) {
        & $psql.Source --dbname=$($dbInfo.Url) --file=$($dbFile.FullName)
        Write-Output 'Database restored with psql.'
      } else {
        $docker = Get-Command docker -ErrorAction SilentlyContinue
        if ($docker) {
          $containerName = (& docker ps --format "{{.Names}}" | Where-Object { $_ -eq 'rahman-postgres' } | Select-Object -First 1)
          if ($containerName) {
            $dbUser = if ([string]::IsNullOrWhiteSpace($dbInfo.User)) { 'postgres' } else { $dbInfo.User }
            Get-Content -Path $dbFile.FullName -Raw | docker exec -i $containerName psql -U $dbUser -d $dbInfo.Database
            Write-Output 'Database restored with docker exec + psql.'
          } else {
            Write-Warning 'No running postgres container found. Trying JSON restore fallback if available.'
          }
        } else {
          Write-Warning 'Neither psql nor docker available. Trying JSON restore fallback if available.'
        }

        if ($dbJsonFile) {
          $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
          if ($nodeCommand) {
            & $nodeCommand.Source ./scripts/db-json-restore.js $dbJsonFile.FullName
            Write-Output 'Database restored with JSON fallback.'
          } else {
            Write-Warning 'Node.js not available for JSON fallback restore.'
          }
        }
      }
    } elseif ($dbJsonFile) {
      $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
      if ($nodeCommand) {
        & $nodeCommand.Source ./scripts/db-json-restore.js $dbJsonFile.FullName
        Write-Output 'Database restored with JSON fallback.'
      } else {
        Write-Warning 'Node.js not available for JSON fallback restore.'
      }
    }
  } else {
    Write-Warning 'DATABASE_URL missing/invalid. Skipping database restore.'
  }
} else {
  Write-Output 'Database restore skipped.'
}

Write-Output "[3/3] Cleaning up temporary files..."
if (Test-Path $tempExtract) {
  Remove-Item -Path $tempExtract -Recurse -Force
}

Write-Output ''
Write-Output 'RESTORE_STATUS=SUCCESS'
Write-Output "RESTORED_FROM=$BackupDir"
