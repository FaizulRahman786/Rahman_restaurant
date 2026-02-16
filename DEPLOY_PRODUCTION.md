# Production Deployment Checklist (RAHMAN)

## 1) Environment
- Copy `.env.production.example` to `.env` in the host environment.
- Set `DATABASE_URL` to your production PostgreSQL database.
- Set `JWT_SECRET` to a strong value (32+ chars).
- Set `NODE_ENV=production`.
- Set `CORS_ORIGIN` to your final domain(s).

## 2) Install & Start
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
