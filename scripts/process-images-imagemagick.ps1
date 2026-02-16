<#
PowerShell script to create blog/dish/ and logo image variants using ImageMagick (magick.exe).
Run from project root.
#>

param(
    [string]$MagickPath = "magick", # set full path if magick.exe isn't in PATH
    [switch]$DryRun
)

$gallery = "assets/images/gallery"
$blog = "assets/images/blog"
$dish = "assets/images/dish"
$brands = "assets/images/brands"

if (-not (Test-Path $blog)) { New-Item -ItemType Directory -Path $blog | Out-Null }
if (-not (Test-Path $dish)) { New-Item -ItemType Directory -Path $dish | Out-Null }

function Run-Magick {
    param([string]$arguments)
    if ($DryRun) { Write-Host "DRY: $MagickPath $arguments"; return }
    # Use Start-Process to safely run magick when the path contains spaces
    $startInfo = @{
        FilePath = $MagickPath
        ArgumentList = $arguments
        NoNewWindow = $true
        Wait = $true
    }
    try {
        $proc = Start-Process @startInfo -PassThru
        if ($proc.ExitCode -ne 0) { Write-Warning "magick returned exit code $($proc.ExitCode) for: $arguments" }
    } catch {
        Write-Warning "Failed to start ImageMagick: $_"
    }
}

# Create blog images (wide headers)
Run-Magick "`"$gallery/gallery1.jpg`" -resize 1200x600^ -gravity center -extent 1200x600 `"$blog/blog1.jpg`""
Run-Magick "`"$gallery/gallery2.jpg`" -resize 1200x600^ -gravity center -extent 1200x600 `"$blog/blog2.jpg`""
Run-Magick "`"$gallery/gallery3.jpg`" -resize 1200x600^ -gravity center -extent 1200x600 `"$blog/blog3.jpg`""
Run-Magick "`"$gallery/gallery4.jpg`" -resize 1200x600^ -gravity center -extent 1200x600 `"$blog/blog4.jpg`""
Run-Magick "`"$gallery/gallery5.jpg`" -resize 1200x600^ -gravity center -extent 1200x600 `"$blog/blog5.jpg`""

# Create dish images (square thumbnails)
Run-Magick "`"$gallery/gallery1.jpg`" -resize 600x600^ -gravity center -extent 600x600 `"$dish/pancakes.jpg`""
Run-Magick "`"$gallery/gallery2.jpg`" -resize 600x600^ -gravity center -extent 600x600 `"$dish/omelette.jpg`""
Run-Magick "`"$gallery/gallery3.jpg`" -resize 600x600^ -gravity center -extent 600x600 `"$dish/paratha.jpg`""
Run-Magick "`"$gallery/gallery4.jpg`" -resize 600x600^ -gravity center -extent 600x600 `"$dish/butter-chicken.jpg`""
Run-Magick "`"$gallery/gallery5.jpg`" -resize 600x600^ -gravity center -extent 600x600 `"$dish/chana-masala.jpg`""
Run-Magick "`"$gallery/gallery1.jpg`" -resize 600x600^ -gravity center -extent 600x600 `"$dish/tandoori-chicken.jpg`""
Run-Magick "`"$gallery/gallery2.jpg`" -resize 600x600^ -gravity center -extent 600x600 `"$dish/biryani-chicken.jpg`""
Run-Magick "`"$gallery/gallery3.jpg`" -resize 600x600^ -gravity center -extent 600x600 `"$dish/mutton-curry.jpg`""

# Create logo variants if original exists
$srcLogo1 = "assets/images/rahmanlogo.png"
$srcLogo2 = "assets/images/rahman-logo.png"
$destLogo = "assets/images/rahman-logo.png"
if (Test-Path $srcLogo1) {
    Run-Magick "`"$srcLogo1`" -resize 160x60 `"$destLogo`""
} elseif (Test-Path $srcLogo2) {
    Run-Magick "`"$srcLogo2`" -resize 160x60 `"$destLogo`""
} else {
    Write-Host "No source logo found to process."
}

# Create hero banner image (1920x1080px)
if (Test-Path "$gallery/gallery1.jpg") {
    Run-Magick "`"$gallery/gallery1.jpg`" -resize 1920x1080^ -gravity center -extent 1920x1080 `"assets/images/hero-banner.jpg`""
    Write-Host "Hero banner created: assets/images/hero-banner.jpg"
} else {
    Write-Host "Source image for hero banner not found. Using gallery1.jpg from gallery folder."
}

Write-Host "ImageMagick processing complete. Check $blog and $dish folders."