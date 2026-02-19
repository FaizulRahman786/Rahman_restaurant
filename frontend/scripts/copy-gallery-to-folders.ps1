# Copies gallery images into blog/ and dish/ folders as example images
# Run this in the project root (PowerShell)

$src = "assets/images/gallery"
$blogDest = "assets/images/blog"
$dishDest = "assets/images/dish"

if (-not (Test-Path $blogDest)) { New-Item -ItemType Directory -Path $blogDest | Out-Null }
if (-not (Test-Path $dishDest)) { New-Item -ItemType Directory -Path $dishDest | Out-Null }

# Map gallery -> blog names
Copy-Item "$src/gallery1.jpg" -Destination "$blogDest/blog1.jpg" -Force
Copy-Item "$src/gallery2.jpg" -Destination "$blogDest/blog2.jpg" -Force
Copy-Item "$src/gallery3.jpg" -Destination "$blogDest/blog3.jpg" -Force
Copy-Item "$src/gallery4.jpg" -Destination "$blogDest/blog4.jpg" -Force
Copy-Item "$src/gallery5.jpg" -Destination "$blogDest/blog5.jpg" -Force

# Map gallery -> dish example names
Copy-Item "$src/gallery1.jpg" -Destination "$dishDest/pancakes.jpg" -Force
Copy-Item "$src/gallery2.jpg" -Destination "$dishDest/omelette.jpg" -Force
Copy-Item "$src/gallery3.jpg" -Destination "$dishDest/paratha.jpg" -Force
Copy-Item "$src/gallery4.jpg" -Destination "$dishDest/butter-chicken.jpg" -Force
Copy-Item "$src/gallery5.jpg" -Destination "$dishDest/chana-masala.jpg" -Force

Write-Host "Copied gallery images into blog/ and dish/ folders."