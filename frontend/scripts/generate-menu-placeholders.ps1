<#!
.SYNOPSIS
Creates branded placeholder images for all veg/non-veg menu items used by index-scroll menu data.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File ./scripts/generate-menu-placeholders.ps1

.EXAMPLE
powershell -ExecutionPolicy Bypass -File ./scripts/generate-menu-placeholders.ps1 -DryRun
#>

param(
    [string]$MagickPath = "magick",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$dishDir = "assets/images/dish"
if (-not (Test-Path $dishDir)) {
    New-Item -ItemType Directory -Path $dishDir -Force | Out-Null
}

function Resolve-Title {
    param([Parameter(Mandatory = $true)][string]$FileName)

    $name = [System.IO.Path]::GetFileNameWithoutExtension($FileName)
    $name = $name -replace '^veg-', ''
    $name = $name -replace '^nonveg-', ''
    $name = $name -replace '-', ' '

    $words = $name.Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)
    $cased = $words | ForEach-Object {
        if ($_.Length -le 1) { $_.ToUpperInvariant() }
        else { $_.Substring(0,1).ToUpperInvariant() + $_.Substring(1).ToLowerInvariant() }
    }
    return ($cased -join ' ')
}

function Build-Args {
    param(
        [Parameter(Mandatory = $true)][string]$OutputPath,
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][bool]$IsVeg
    )

    $bgA = if ($IsVeg) { '#2f855a' } else { '#b83232' }
    $bgB = if ($IsVeg) { '#f6ad55' } else { '#f6ad55' }
    $tag = if ($IsVeg) { 'VEG' } else { 'NON-VEG' }
    $safeTitle = '"' + $Title.Replace('"', "''") + '"'
    $brandText = '"RAHMAN RESTAURANT"'
    $tagText = '"' + $tag + '"'

    return @(
        '-size', '1200x900',
        "gradient:$bgA-$bgB",
        '-gravity', 'center',
        '-font', 'Arial',
        '-fill', '#ffffff',
        '-pointsize', '80',
        '-annotate', '+0-20', $safeTitle,
        '-gravity', 'south',
        '-pointsize', '38',
        '-annotate', '+0+80', $brandText,
        '-gravity', 'northwest',
        '-pointsize', '34',
        '-annotate', '+40+52', $tagText,
        $OutputPath
    )
}

function Invoke-Magick {
    param([string[]]$Arguments)

    if ($DryRun) {
        Write-Host "DRY: $MagickPath $($Arguments -join ' ')"
        return
    }

    $proc = Start-Process -FilePath $MagickPath -ArgumentList $Arguments -NoNewWindow -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        throw "ImageMagick failed (exit $($proc.ExitCode))"
    }
}

$vegFiles = @(
    'veg-paneer-tikka.jpg',
    'veg-aloo-gobi.jpg',
    'veg-dal-makhani.jpg',
    'veg-vegetable-biryani.jpg',
    'veg-palak-paneer.jpg',
    'veg-chana-masala.jpg',
    'veg-vegetable-pakora.jpg',
    'veg-rajma.jpg',
    'veg-malai-kofta.jpg',
    'veg-gulab-jamun.jpg',
    'veg-ras-malai.jpg',
    'veg-mango-lassi.jpg',
    'veg-jeera-rice.jpg',
    'veg-aloo-paratha.jpg',
    'veg-baingan-bharta.jpg',
    'veg-vegetable-korma.jpg',
    'veg-samosa.jpg',
    'veg-kheer.jpg',
    'veg-masala-chai.jpg',
    'veg-poha.jpg'
)

$nonVegFiles = @(
    'nonveg-butter-chicken.jpg',
    'nonveg-chicken-tikka-masala.jpg',
    'nonveg-mutton-rogan-josh.jpg',
    'nonveg-fish-curry.jpg',
    'nonveg-chicken-biryani.jpg',
    'nonveg-tandoori-chicken.jpg',
    'nonveg-keema-naan.jpg',
    'nonveg-prawn-masala.jpg',
    'nonveg-egg-curry.jpg',
    'nonveg-mutton-biryani.jpg',
    'nonveg-chicken-seekh-kebab.jpg',
    'nonveg-lamb-chops.jpg',
    'nonveg-fish-tikka.jpg',
    'nonveg-chicken-korma.jpg',
    'nonveg-keema-matar.jpg',
    'nonveg-prawn-biryani.jpg',
    'nonveg-chicken-65.jpg',
    'nonveg-mutton-korma.jpg',
    'nonveg-egg-biryani.jpg',
    'nonveg-fish-fry.jpg',
    'nonveg-chicken-saag.jpg',
    'nonveg-mutton-seekh-kebab.jpg',
    'nonveg-prawn-korma.jpg',
    'nonveg-chicken-vindaloo.jpg',
    'nonveg-lamb-biryani.jpg',
    'nonveg-chicken-pakora.jpg',
    'nonveg-mutton-saag.jpg',
    'nonveg-fish-pakora.jpg',
    'nonveg-chicken-dhansak.jpg',
    'nonveg-keema-pav.jpg'
)

foreach ($file in $vegFiles) {
    $outputPath = Join-Path $dishDir $file
    $title = Resolve-Title -FileName $file
    $args = Build-Args -OutputPath $outputPath -Title $title -IsVeg $true
    Invoke-Magick -Arguments $args
    if (-not $DryRun) { Write-Host "Created: $outputPath" }
}

foreach ($file in $nonVegFiles) {
    $outputPath = Join-Path $dishDir $file
    $title = Resolve-Title -FileName $file
    $args = Build-Args -OutputPath $outputPath -Title $title -IsVeg $false
    Invoke-Magick -Arguments $args
    if (-not $DryRun) { Write-Host "Created: $outputPath" }
}

Write-Host "Done. Generated menu placeholders in $dishDir"
