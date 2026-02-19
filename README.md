cd# RAHMAN Restaurant (Split Layout)

This repository is organized into two main folders:

- `frontend/` → static website files (HTML, CSS, JS, images)
- `backend/` → Node.js API, auth/reservations logic, deployment files, scripts, backups

## Local Development

### 1) Run backend API + static frontend

From repository root:

```powershell
cd backend
npm install
npm start
```

App/API default URL:
- `http://localhost:3000`

### 2) Health check

From `backend/`:

```powershell
npm run smoke:health
```

## Deployment (Render)

- Blueprint file is at repository root: `render.yaml`
- Render service root directory is set to: `backend`
- Health endpoint: `/api/health`

## Important Paths

- Frontend root served by backend: `frontend/`
- Backend server entry: `backend/server.js`
- Backend environment file: `backend/.env`
- Deployment checklist: `backend/DEPLOY_PRODUCTION.md`
- Backup guide: `backend/BACKUP_RECOVERY_GUIDE.md`
- Frontend maintenance guide: `frontend/README.md`
- Legacy duplicate backend folder (reference only): `backend/rahman_backend/README_LEGACY.md`

Legacy cleanup status:
- Duplicate legacy documentation files were removed from `backend/rahman_backend/`.
