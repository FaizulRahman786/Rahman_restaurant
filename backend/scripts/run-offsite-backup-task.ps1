$ErrorActionPreference = 'Stop'
Set-Location -Path "C:\Users\HP\OneDrive\Documents\Desktop\resturant"
& "C:\Users\HP\OneDrive\Documents\Desktop\resturant\scripts\copy-backup-offsite.ps1" -OffsiteRoot "C:\Users\HP\OneDrive\Website-Offsite-Backups\resturant" -SecondaryOffsiteRoot "C:\Users\HP\Documents\Website-Offsite-Backups-Secondary\resturant" -KeepLast 12
