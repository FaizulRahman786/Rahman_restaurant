# Production Deployment Checklist (RAHMAN)

Related docs:
- Project root guide: `../README.md`
- Frontend guide: `../frontend/README.md`
- Backup guide: `./BACKUP_RECOVERY_GUIDE.md`

Project layout now uses:
- `frontend/` for static UI files
- `backend/` for API/server/deployment files
- `render.yaml` in repository root with `rootDir: backend`

## 1) Environment
- In `backend/`, copy `.env.production.example` to `.env` in the host environment.
- Set `DATABASE_URL` to your production PostgreSQL database.
- Set `JWT_SECRET` to a strong value (32+ chars).
- Set `NODE_ENV=production`.
- Set `CORS_ORIGIN` to your final domain(s).

## 2) Install & Start
- Change to backend directory:
  - `cd backend`
- Install dependencies:
  - `npm install --omit=dev`
- Start the app:
  - `npm start`

## 3) Health Validation
- Run smoke test:
  - `npm run smoke:health`
- Expect:
  - `SMOKE_HEALTH=PASS`
  - `HEALTH_OK=true`
  - `DB_CONNECTED=true`

## 4) Frontend Validation
- Open homepage and verify sections load.
- Verify header controls are visible in:
  - full laptop width
  - split-screen laptop width
  - mobile width (360/390)
- Verify search, cart, favorites all appear and work.
- Verify blog article opens in new tab:
  - `blog-history-of-biryani.html`

## 5) Security & Hardening
- Ensure HTTPS is enabled by host/proxy.
- Keep `PGSSL=true` in production.
- Keep `TRUST_PROXY=1` behind reverse proxy.
- Keep rate limit enabled via `API_RATE_LIMIT_*`.

## 6) Post-Deploy Quick Test
- Check `/api/health` response from public URL.
- Submit one reservation flow end-to-end.
- Confirm image fallback endpoint serves correctly if image missing.

## 7) Rollback Readiness
- Keep a backup copy of current `.env` and deployment config.
- If needed, redeploy previous stable build and restore previous `.env`.

## 8) Render Deployment (Blueprint)
- Ensure `render.yaml` is committed in repository root.
- Push code to GitHub.
- In Render dashboard: **New** → **Blueprint** → select repo.
- Render provisions:
  - Web service: `rahman-restaurant`
  - PostgreSQL: `rahman-postgres`
- Confirm service uses root directory:
  - `backend`
- After first deploy, verify service environment variables:
  - `NODE_ENV=production`
  - `DATABASE_URL` (linked from managed database)
  - `JWT_SECRET` (auto-generated)
  - `CORS_ORIGIN` (set to your live domain, e.g. `https://rahman-restaurant.onrender.com`)

### Render Post-Deploy Checks
- Open `https://rahman-restaurant.onrender.com/api/health`
- Expect `HEALTH_OK=true` and `DB_CONNECTED=true`
- Open app root and confirm login page loads.
- Test one reservation flow.
