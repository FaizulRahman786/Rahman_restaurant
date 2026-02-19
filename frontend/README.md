# Frontend Guide

This folder contains the static website (HTML/CSS/JS/images).

## Related Docs

- Project root guide: `../README.md`
- Backend deployment guide: `../backend/DEPLOY_PRODUCTION.md`

## Main Files

- `login.html` (default entry page served by backend)
- `main.js`, `style.css`
- `index-scroll.html`, `scroll-main.js`, `scroll-style.css`
- `blog-*.html` article pages

## Images

- All image assets are under `assets/images/`
- Keep filenames web-safe (lowercase, no spaces preferred)
- Update `assets/images/dish/image-source-map.json` when replacing mapped dish images

## Frontend Utility Scripts

Scripts are in `frontend/scripts/`:

- `generate-menu-placeholders.ps1`
- `replace-menu-placeholders-with-real-images.ps1`
- `process-images-imagemagick.ps1`
- `copy-gallery-to-folders.ps1`
- `sort-images.js`
- `image-mapping.txt`

Run from repository root:

```powershell
cd frontend
```

Then run scripts as needed, for example:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/generate-menu-placeholders.ps1
powershell -ExecutionPolicy Bypass -File ./scripts/replace-menu-placeholders-with-real-images.ps1
powershell -ExecutionPolicy Bypass -File ./scripts/process-images-imagemagick.ps1
node ./scripts/sort-images.js
```

## Local Preview

Frontend is served by backend. To preview full app:

```powershell
cd ../backend
npm start
```

Open:
- `http://localhost:3000`
