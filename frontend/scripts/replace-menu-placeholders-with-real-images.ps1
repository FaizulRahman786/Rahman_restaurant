<#!
.SYNOPSIS
Replaces generated menu placeholders with real food photos while keeping the same filenames.

.DESCRIPTION
Downloads free images using Unsplash source query URLs, then optionally normalizes dimensions
to 1200x900 with ImageMagick if available.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File ./scripts/replace-menu-placeholders-with-real-images.ps1

.EXAMPLE
powershell -ExecutionPolicy Bypass -File ./scripts/replace-menu-placeholders-with-real-images.ps1 -DryRun
#>

param(
    [string]$DishDir = "assets/images/dish",
    [string]$MagickPath = "magick",
    [switch]$SkipResize,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DishDir)) {
    New-Item -ItemType Directory -Path $DishDir -Force | Out-Null
}

$items = @(
    @{ file='veg-paneer-tikka.jpg'; query='paneer tikka'; prompt='Indian paneer tikka, grilled paneer cubes on skewers, onions, peppers, mint chutney, food photography, realistic' },
    @{ file='veg-aloo-gobi.jpg'; query='aloo gobi'; prompt='Aloo gobi curry with cauliflower and potato, Indian food, realistic close-up' },
    @{ file='veg-dal-makhani.jpg'; query='dal makhani'; prompt='Dal makhani in copper bowl, creamy black lentil curry, Indian restaurant style, realistic' },
    @{ file='veg-vegetable-biryani.jpg'; query='vegetable biryani'; prompt='Vegetable biryani with saffron rice and fried onions, Indian food photography, realistic' },
    @{ file='veg-palak-paneer.jpg'; query='palak paneer'; prompt='Palak paneer, spinach curry with paneer cubes, Indian dish, realistic' },
    @{ file='veg-chana-masala.jpg'; query='chana masala'; prompt='Chana masala chickpea curry, Indian cuisine, realistic food photo' },
    @{ file='veg-vegetable-pakora.jpg'; query='vegetable pakora'; prompt='Vegetable pakora fritters with mint chutney, Indian snack, realistic' },
    @{ file='veg-rajma.jpg'; query='rajma curry'; prompt='Rajma curry with kidney beans and rice, Indian food, realistic' },
    @{ file='veg-malai-kofta.jpg'; query='malai kofta'; prompt='Malai kofta in creamy gravy, Indian curry, realistic food photography' },
    @{ file='veg-gulab-jamun.jpg'; query='gulab jamun dessert'; prompt='Gulab jamun dessert in syrup with pistachio garnish, Indian sweet, realistic' },
    @{ file='veg-ras-malai.jpg'; query='ras malai dessert'; prompt='Ras malai in saffron milk, Indian dessert, realistic close-up' },
    @{ file='veg-mango-lassi.jpg'; query='mango lassi'; prompt='Mango lassi in tall glass, Indian drink, realistic food photography' },
    @{ file='veg-jeera-rice.jpg'; query='jeera rice'; prompt='Jeera rice with cumin seeds, Indian basmati rice dish, realistic' },
    @{ file='veg-aloo-paratha.jpg'; query='aloo paratha'; prompt='Aloo paratha with butter and curd, Indian breakfast, realistic' },
    @{ file='veg-baingan-bharta.jpg'; query='baingan bharta'; prompt='Baingan bharta roasted eggplant curry, Indian dish, realistic' },
    @{ file='veg-vegetable-korma.jpg'; query='vegetable korma'; prompt='Vegetable korma creamy mixed vegetable curry, Indian cuisine, realistic' },
    @{ file='veg-samosa.jpg'; query='samosa'; prompt='Crispy samosa with chutney, Indian snack, realistic food photo' },
    @{ file='veg-kheer.jpg'; query='kheer dessert'; prompt='Kheer rice pudding with saffron and nuts, Indian dessert, realistic' },
    @{ file='veg-masala-chai.jpg'; query='masala chai'; prompt='Masala chai in clay cup with spices, Indian tea, realistic' },
    @{ file='veg-poha.jpg'; query='poha'; prompt='Poha with peanuts and curry leaves, Indian breakfast dish, realistic' },

    @{ file='nonveg-butter-chicken.jpg'; query='butter chicken'; prompt='Butter chicken curry with cream swirl, Indian dish, realistic food photography' },
    @{ file='nonveg-chicken-tikka-masala.jpg'; query='chicken tikka masala'; prompt='Chicken tikka masala with grilled chicken pieces, Indian curry, realistic' },
    @{ file='nonveg-mutton-rogan-josh.jpg'; query='mutton rogan josh'; prompt='Mutton rogan josh curry, Kashmiri style, realistic Indian food photo' },
    @{ file='nonveg-fish-curry.jpg'; query='fish curry indian'; prompt='Indian fish curry with curry leaves and coconut gravy, realistic' },
    @{ file='nonveg-chicken-biryani.jpg'; query='chicken biryani'; prompt='Chicken biryani with saffron rice and fried onions, realistic food photography' },
    @{ file='nonveg-tandoori-chicken.jpg'; query='tandoori chicken'; prompt='Tandoori chicken with onion rings and lemon, Indian dish, realistic' },
    @{ file='nonveg-keema-naan.jpg'; query='keema naan'; prompt='Keema naan stuffed flatbread cut open, Indian food, realistic' },
    @{ file='nonveg-prawn-masala.jpg'; query='prawn masala'; prompt='Prawn masala curry, Indian seafood dish, realistic close-up' },
    @{ file='nonveg-egg-curry.jpg'; query='egg curry'; prompt='Egg curry with boiled eggs in masala gravy, Indian dish, realistic' },
    @{ file='nonveg-mutton-biryani.jpg'; query='mutton biryani'; prompt='Mutton biryani with tender meat and basmati rice, realistic' },
    @{ file='nonveg-chicken-seekh-kebab.jpg'; query='chicken seekh kebab'; prompt='Chicken seekh kebab skewers with chutney, Indian appetizer, realistic' },
    @{ file='nonveg-lamb-chops.jpg'; query='lamb chops grilled'; prompt='Grilled lamb chops plated with herbs, realistic food photography' },
    @{ file='nonveg-fish-tikka.jpg'; query='fish tikka'; prompt='Fish tikka skewers with char marks and chutney, realistic' },
    @{ file='nonveg-chicken-korma.jpg'; query='chicken korma'; prompt='Chicken korma creamy curry, Indian cuisine, realistic food image' },
    @{ file='nonveg-keema-matar.jpg'; query='keema matar'; prompt='Keema matar minced meat with peas, Indian curry, realistic' },
    @{ file='nonveg-prawn-biryani.jpg'; query='prawn biryani'; prompt='Prawn biryani with basmati rice and spices, Indian dish, realistic' },
    @{ file='nonveg-chicken-65.jpg'; query='chicken 65'; prompt='Chicken 65 crispy spicy fried chicken, South Indian dish, realistic' },
    @{ file='nonveg-mutton-korma.jpg'; query='mutton korma'; prompt='Mutton korma rich curry, Indian food, realistic photography' },
    @{ file='nonveg-egg-biryani.jpg'; query='egg biryani'; prompt='Egg biryani with boiled eggs and fragrant rice, Indian dish, realistic' },
    @{ file='nonveg-fish-fry.jpg'; query='fish fry indian'; prompt='Indian fish fry crispy fillets with lemon and onion salad, realistic' },
    @{ file='nonveg-chicken-saag.jpg'; query='chicken saag'; prompt='Chicken saag curry with spinach gravy, Indian dish, realistic' },
    @{ file='nonveg-mutton-seekh-kebab.jpg'; query='mutton seekh kebab'; prompt='Mutton seekh kebab skewers with mint chutney, Indian appetizer, realistic' },
    @{ file='nonveg-prawn-korma.jpg'; query='prawn korma'; prompt='Prawn korma creamy curry, Indian seafood, realistic food image' },
    @{ file='nonveg-chicken-vindaloo.jpg'; query='chicken vindaloo'; prompt='Chicken vindaloo spicy Goan curry, Indian food, realistic' },
    @{ file='nonveg-lamb-biryani.jpg'; query='lamb biryani'; prompt='Lamb biryani in handi with saffron rice, realistic Indian food photo' },
    @{ file='nonveg-chicken-pakora.jpg'; query='chicken pakora'; prompt='Chicken pakora fried bites with chutney, Indian snack, realistic' },
    @{ file='nonveg-mutton-saag.jpg'; query='mutton saag'; prompt='Mutton saag curry with spinach, Indian dish, realistic' },
    @{ file='nonveg-fish-pakora.jpg'; query='fish pakora'; prompt='Fish pakora crispy fritters with chutney, Indian snack, realistic' },
    @{ file='nonveg-chicken-dhansak.jpg'; query='chicken dhansak'; prompt='Chicken dhansak lentil curry, Parsi Indian cuisine, realistic' },
    @{ file='nonveg-keema-pav.jpg'; query='keema pav'; prompt='Keema pav with minced curry and buttered buns, Indian street food, realistic' }
)

function Normalize-Image {
    param(
        [Parameter(Mandatory = $true)][string]$Path
    )

    if ($SkipResize) { return }
    if ($DryRun) {
        Write-Host "DRY resize: $Path"
        return
    }

    $tmp = "$Path.tmp.jpg"
    $args = @(
        '"' + $Path + '"',
        '-resize', '1200x900^',
        '-gravity', 'center',
        '-extent', '1200x900',
        '-strip',
        '-quality', '86',
        '"' + $tmp + '"'
    )

    $proc = Start-Process -FilePath $MagickPath -ArgumentList $args -NoNewWindow -Wait -PassThru
    if ($proc.ExitCode -eq 0 -and (Test-Path $tmp)) {
        Move-Item -Force $tmp $Path
    } else {
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
    }
}

function Get-ImageCandidates {
    param(
        [Parameter(Mandatory = $true)][string]$Prompt,
        [Parameter(Mandatory = $true)][string]$Query,
        [Parameter(Mandatory = $true)][int]$Seed
    )

    $searchUrls = Get-DuckDuckGoImageUrls -Query $Query -MaxResults 6
    $encodedPrompt = [uri]::EscapeDataString($Prompt)
    $encoded = [uri]::EscapeDataString($Query)
    $loremTags = [uri]::EscapeDataString(($Query -replace '\s+', ','))

    $fallbackUrls = @(
        "https://image.pollinations.ai/prompt/$encodedPrompt?width=1200&height=900&nologo=true&seed=$Seed",
        "https://source.unsplash.com/1200x900/?$encoded,indian,dish,restaurant",
        "https://loremflickr.com/1200/900/$loremTags?lock=$Seed"
    )

    if ($searchUrls -and $searchUrls.Count -gt 0) {
        return @($searchUrls + $fallbackUrls)
    }

    return $fallbackUrls
}

function Get-DuckDuckGoImageUrls {
    param(
        [Parameter(Mandatory = $true)][string]$Query,
        [int]$MaxResults = 6
    )

    try {
        $encoded = [uri]::EscapeDataString($Query)
        $headers = @{
            'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36'
            'Accept' = 'text/html,application/json;q=0.9,*/*;q=0.8'
        }

        $landing = Invoke-WebRequest -Uri "https://duckduckgo.com/?q=$encoded&iax=images&ia=images" -Headers $headers -TimeoutSec 30 -UseBasicParsing
        $vqdMatch = [regex]::Match($landing.Content, "vqd=\\'(?<vqd>[^\\']+)\\'")

        if (-not $vqdMatch.Success) {
            $vqdMatch = [regex]::Match($landing.Content, 'vqd="(?<vqd>[^"]+)"')
        }

        if (-not $vqdMatch.Success) {
            return @()
        }

        $vqd = $vqdMatch.Groups['vqd'].Value
        $jsonHeaders = @{
            'User-Agent' = $headers['User-Agent']
            'Accept' = 'application/json, text/javascript, */*; q=0.01'
            'Referer' = "https://duckduckgo.com/?q=$encoded&iax=images&ia=images"
        }

        $jsonUrl = "https://duckduckgo.com/i.js?l=us-en&o=json&q=$encoded&vqd=$([uri]::EscapeDataString($vqd))&f=,,,&p=1"
        $json = Invoke-RestMethod -Uri $jsonUrl -Headers $jsonHeaders -TimeoutSec 30

        if (-not $json.results) {
            return @()
        }

        $urls = @($json.results |
            ForEach-Object { $_.image } |
            Where-Object { $_ -and $_ -match '^https?://' } |
            Select-Object -Unique -First $MaxResults)

        return $urls
    } catch {
        return @()
    }
}

function Try-DownloadImage {
    param(
        [Parameter(Mandatory = $true)][string[]]$Urls,
        [Parameter(Mandatory = $true)][string]$OutFile
    )

    foreach ($url in $Urls) {
        try {
            $tmpOut = "$OutFile.download.tmp"
            if (Test-Path $tmpOut) {
                Remove-Item $tmpOut -Force
            }

            Invoke-WebRequest -Uri $url -OutFile $tmpOut -MaximumRedirection 10 -TimeoutSec 45 -UseBasicParsing
            if ((Test-Path $tmpOut) -and ((Get-Item $tmpOut).Length -gt 10KB)) {
                Move-Item -Path $tmpOut -Destination $OutFile -Force
                return $url
            }

            if (Test-Path $tmpOut) {
                Remove-Item $tmpOut -Force
            }
        } catch {
            $tmpOut = "$OutFile.download.tmp"
            if (Test-Path $tmpOut) {
                Remove-Item $tmpOut -Force
            }
        }
    }

    return ''
}

$ok = 0
$fail = 0
$index = 1
$sourceMap = @()

foreach ($item in $items) {
    $target = Join-Path $DishDir $item.file
    $urls = Get-ImageCandidates -Prompt $item.prompt -Query $item.query -Seed $index
    $index++

    if ($DryRun) {
        Write-Host "DRY: $($urls[0])"
        Write-Host "DRY: $($urls[1])"
        Write-Host "DRY: $($urls[2]) -> $target"
        continue
    }

    try {
        $downloadSource = Try-DownloadImage -Urls $urls -OutFile $target
        if ($downloadSource) {
            Normalize-Image -Path $target
            Write-Host "Downloaded: $($item.file)"
            $sourceMap += [PSCustomObject]@{
                file = $item.file
                query = $item.query
                source = $downloadSource
            }
            $ok++
        } else {
            Write-Warning "Downloaded file too small for $($item.file), keeping previous image if available."
            $fail++
        }
    } catch {
        Write-Warning "Failed: $($item.file) -> $($_.Exception.Message)"
        $fail++
    }
}

if (-not $DryRun) {
    $sourceMapPath = Join-Path $DishDir 'image-source-map.json'
    $sourceMap | ConvertTo-Json -Depth 4 | Set-Content -Path $sourceMapPath -Encoding UTF8
    Write-Host "Saved source map: $sourceMapPath"
}

Write-Host "Completed. Success: $ok, Failed: $fail"
