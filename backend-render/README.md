# backend-render (Render-only API package)

This folder is a deployment-focused backend package for Render.

## Included files (only necessary)

- `server.js` (API server)
- `whatsapp.js` (WhatsApp helper)
- `package.json`
- `package-lock.json`
- `.env.example`
- `.env.production.example`
- `.gitignore`
- `render.yaml` (Render blueprint)

## Deploy on Render

1. Push this repo to GitHub.
2. In Render, create **Blueprint** deployment using `backend-render/render.yaml`.
3. Set required env vars:
   - `MONGODB_URI`
   - `CORS_ORIGIN`
   - Optional: WhatsApp/OpenAI keys depending on features.

Detailed steps:

- See `DEPLOY_CHECKLIST.md`

## Local run (optional)

```powershell
cd backend-render
npm install
npm start
```

Health check:
- `GET /api/health`

## One-click smoke test (after deploy)

From repository root:

```powershell
powershell -ExecutionPolicy Bypass -File ./backend-render/scripts/smoke-render.ps1 -BaseUrl https://your-service.onrender.com
```

Or from `backend-render/`:

```powershell
npm run smoke:render
npm run smoke:local
```
