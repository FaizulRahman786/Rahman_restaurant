# Render Deploy Checklist (backend-render)

Use this checklist to deploy only the necessary backend on Render.

## 1) Repository prep

- Ensure `backend-render/` is pushed to your Git provider.
- Confirm this file exists: `backend-render/render.yaml`.

## 2) Create service in Render

### Option A: Blueprint (recommended)

1. In Render dashboard, click **New +** → **Blueprint**.
2. Select your repository.
3. Render should detect `backend-render/render.yaml`.
4. Create the service.

### Option B: Manual Web Service

1. In Render dashboard, click **New +** → **Web Service**.
2. Select your repository.
3. Set:
   - **Root Directory**: `backend-render`
   - **Build Command**: `npm install --omit=dev`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`

## 3) Required environment variables

Set these in Render service settings:

- `MONGODB_URI` = your MongoDB connection string
- `CORS_ORIGIN` = your frontend origin(s), comma-separated

Example:

```text
https://rahmanrestaurant.netlify.app,https://your-render-service.onrender.com
```

## 4) Recommended environment variables

- `NODE_ENV=production`
- `PORT=3001`
- `JWT_SECRET` (strong random secret)
- `JWT_EXPIRES_IN=1h`
- `TRUST_PROXY=1`
- `API_RATE_LIMIT_WINDOW_MS=900000`
- `API_RATE_LIMIT_MAX=200`
- `RESERVATION_WHATSAPP_NUMBER=+917858062571`
- `WHATSAPP_PROVIDER=none`
- `WHATSAPP_DEFAULT_COUNTRY_CODE=91`
- `OPENAI_MODEL=gpt-4o-mini`

## 5) Post-deploy verification

After deploy completes, verify:

- `GET /api/health` returns `200`
- `GET /` loads homepage
- `GET /login.html` loads auth UI
- `GET /auth-signin.html` loads auth UI

Run one command from repository root:

```powershell
powershell -ExecutionPolicy Bypass -File ./backend-render/scripts/smoke-render.ps1 -BaseUrl https://your-service.onrender.com
```

Or from `backend-render/`:

```powershell
npm run smoke:render
```

## 6) Common issues

- **App crashes on boot**: check `MONGODB_URI` format and network access.
- **CORS blocked**: ensure exact frontend domain in `CORS_ORIGIN`.
- **Auth issues**: verify `JWT_SECRET` is set and not default.
- **Static pages 404**: ensure service root directory is `backend-render`.
