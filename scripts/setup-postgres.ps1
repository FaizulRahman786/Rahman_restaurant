param(
    [string]$AdminUser = "postgres",
    [string]$AdminPassword = "postgres",
    [string]$DbUser = "postgres",
    [string]$DbPassword = "postgres",
    [string]$DbName = "restaurant_db",
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$EnvPath = ".env"
)

$ErrorActionPreference = "Stop"

function Set-EnvVar {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$Value
    )

    if (-not (Test-Path $FilePath)) {
        New-Item -ItemType File -Path $FilePath -Force | Out-Null
    }

    $content = Get-Content -Path $FilePath -Raw -ErrorAction SilentlyContinue
    if ($null -eq $content) { $content = "" }

    $pattern = "(?m)^" + [regex]::Escape($Key) + "=.*$"
    $replacement = "$Key=$Value"

    if ($content -match $pattern) {
        $updated = [regex]::Replace($content, $pattern, $replacement)
    } else {
        $updated = $content.TrimEnd()
        if ($updated.Length -gt 0) {
            $updated += "`r`n"
        }
        $updated += $replacement + "`r`n"
    }

    Set-Content -Path $FilePath -Value $updated -Encoding UTF8
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
$psqlExe = $null

if ($psql) {
    $psqlExe = $psql.Source
}

if (-not $psqlExe) {
    $defaultPsql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
    if (Test-Path $defaultPsql) {
        $psqlExe = $defaultPsql
    }
}

if (-not $psqlExe) {
    Write-Error @"
PostgreSQL CLI (psql) was not found.
Install PostgreSQL and ensure 'psql' is on PATH, then run this again.
Example (Windows): winget install -e --id PostgreSQL.PostgreSQL
"@
}

$env:PGPASSWORD = $AdminPassword

function Escape-SqlLiteral {
    param([Parameter(Mandatory = $true)][string]$Value)
    return $Value.Replace("'", "''")
}

function Invoke-Psql {
    param(
        [Parameter(Mandatory = $true)][string]$Sql,
        [string]$Database = "postgres",
        [switch]$Quiet
    )

    if ($Quiet) {
        $output = & $psqlExe -h $DbHost -p $DbPort -U $AdminUser -d $Database -v ON_ERROR_STOP=1 -t -A -c $Sql
    } else {
        $output = & $psqlExe -h $DbHost -p $DbPort -U $AdminUser -d $Database -v ON_ERROR_STOP=1 -c $Sql
    }

    if ($LASTEXITCODE -ne 0) {
        throw "psql command failed with exit code $LASTEXITCODE"
    }

    return $output
}

Write-Host "[1/4] Checking PostgreSQL connection to $DbHost`:$DbPort ..."
Invoke-Psql -Sql "SELECT version();" | Out-Null

Write-Host "[2/4] Creating/updating role '$DbUser' ..."
$safeDbUser = Escape-SqlLiteral -Value $DbUser
$safeDbPassword = Escape-SqlLiteral -Value $DbPassword
$safeDbName = Escape-SqlLiteral -Value $DbName

$roleExistsRaw = Invoke-Psql -Sql "SELECT 1 FROM pg_roles WHERE rolname = '$safeDbUser';" -Quiet
$roleExists = if ($null -eq $roleExistsRaw) { "" } else { ($roleExistsRaw | Out-String).Trim() }
if ($roleExists -eq "1") {
    Invoke-Psql -Sql ("ALTER ROLE " + $DbUser + " WITH LOGIN PASSWORD '" + $safeDbPassword + "';") | Out-Null
} else {
    Invoke-Psql -Sql ("CREATE ROLE " + $DbUser + " LOGIN PASSWORD '" + $safeDbPassword + "';") | Out-Null
}

Write-Host "[3/4] Creating database '$DbName' (if missing) ..."
$dbExistsRaw = Invoke-Psql -Sql "SELECT 1 FROM pg_database WHERE datname = '$safeDbName';" -Quiet
$dbExists = if ($null -eq $dbExistsRaw) { "" } else { ($dbExistsRaw | Out-String).Trim() }
if ($dbExists -ne "1") {
    Invoke-Psql -Sql ("CREATE DATABASE " + $DbName + " OWNER " + $DbUser + ";") | Out-Null
}

Write-Host "[4/4] Updating environment file '$EnvPath' ..."
if ((-not (Test-Path $EnvPath)) -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" $EnvPath -Force
}

$databaseUrl = 'postgresql://' + $DbUser + ':' + $DbPassword + '@' + $DbHost + ':' + $DbPort + '/' + $DbName
Set-EnvVar -FilePath $EnvPath -Key "DATABASE_URL" -Value $databaseUrl
Set-EnvVar -FilePath $EnvPath -Key "PGSSL" -Value "false"
Set-EnvVar -FilePath $EnvPath -Key "PORT" -Value "3000"

Write-Host "PostgreSQL setup complete."
Write-Host "DATABASE_URL set to: $databaseUrl"
Write-Host "Next: npm start"
