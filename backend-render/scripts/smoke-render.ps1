param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl
)

$ErrorActionPreference = 'Stop'

$normalizedBaseUrl = $BaseUrl.Trim().TrimEnd('/')

if ([string]::IsNullOrWhiteSpace($normalizedBaseUrl)) {
  Write-Error "BaseUrl is required. Example: -BaseUrl https://rahman-restaurant-api.onrender.com"
  exit 1
}

$checks = @(
  @{ Path = '/api/health'; Expect = 'json-or-text' },
  @{ Path = '/'; Expect = 'Rahman Restaurant' },
  @{ Path = '/index-scroll.html'; Expect = 'Experience Authentic Taste' },
  @{ Path = '/login.html'; Expect = 'emailAuthForm' },
  @{ Path = '/auth-signin.html'; Expect = 'emailAuthForm' },
  @{ Path = '/assets/css/theme-core.css'; Expect = ':root' }
)

$failed = $false
$results = @()

foreach ($check in $checks) {
  $url = "$normalizedBaseUrl$($check.Path)"

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -Method Get -TimeoutSec 20
    $content = [string]$response.Content

    $contentPass = $true
    if ($check.Expect -ne 'json-or-text') {
      $contentPass = $content -match [regex]::Escape($check.Expect)
    }

    $passed = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) -and $contentPass
    if (-not $passed) { $failed = $true }

    $results += [PSCustomObject]@{
      Url = $url
      Status = [int]$response.StatusCode
      ContentCheck = if ($contentPass) { 'PASS' } else { 'FAIL' }
      Result = if ($passed) { 'PASS' } else { 'FAIL' }
    }
  } catch {
    $failed = $true
    $results += [PSCustomObject]@{
      Url = $url
      Status = 'ERROR'
      ContentCheck = 'FAIL'
      Result = 'FAIL'
    }
  }
}

$results | Format-Table -AutoSize

if ($failed) {
  Write-Host "`nSmoke check failed for one or more endpoints." -ForegroundColor Red
  exit 1
}

Write-Host "`nSmoke check passed for all endpoints." -ForegroundColor Green
exit 0
