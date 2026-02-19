$ErrorActionPreference = "Stop"

$winget = Get-Command winget -ErrorAction SilentlyContinue
if (-not $winget) {
    Write-Error "winget is not available on this system. Install PostgreSQL manually from https://www.postgresql.org/download/windows/."
}

Write-Host "Installing PostgreSQL via winget (this may take several minutes)..."
$installed = $false

foreach ($pkg in @("PostgreSQL.PostgreSQL.18", "PostgreSQL.PostgreSQL.17")) {
    try {
        winget install -e --id $pkg --source winget --accept-source-agreements --accept-package-agreements --silent
        if ($LASTEXITCODE -eq 0) {
            $installed = $true
            break
        }
    } catch {
        Write-Host "Install attempt failed for $pkg, trying next package..."
    }
}

if (-not $installed) {
    Write-Error "Could not install PostgreSQL via winget. Install manually from https://www.postgresql.org/download/windows/ and then run: npm run db:init"
}

Write-Host "PostgreSQL install command finished."
Write-Host "If psql is not recognized yet, open a new terminal and run: npm run db:init"
