Blog images folder.

This folder is intended to contain the blog header images used by the site.

Recommended quick action (PowerShell):

```powershell
# Copy existing gallery images into blog folder
Copy-Item .\assets\images\gallery\gallery1.jpg -Destination .\assets\images\blog\blog1.jpg -Force
Copy-Item .\assets\images\gallery\gallery2.jpg -Destination .\assets\images\blog\blog2.jpg -Force
Copy-Item .\assets\images\gallery\gallery3.jpg -Destination .\assets\images\blog\blog3.jpg -Force
Copy-Item .\assets\images\gallery\gallery4.jpg -Destination .\assets\images\blog\blog4.jpg -Force
Copy-Item .\assets\images\gallery\gallery5.jpg -Destination .\assets\images\blog\blog5.jpg -Force
```

After copying, update any HTML references to `assets/images/blog/blogX.jpg` if needed.