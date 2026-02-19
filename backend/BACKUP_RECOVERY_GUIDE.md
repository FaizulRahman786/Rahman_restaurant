# Website Backup & Recovery Guide

This project now includes one-command backup and restore tools so the website can be recovered quickly after failures.

Project layout:
- `frontend/` contains static UI files
- `backend/` contains server, scripts, env files, and backups

## 1) Create a full backup

Run commands from `backend/`.

From repo root:

```powershell
cd backend
```

Then run:

```powershell
npm run backup:site
```

What this creates:
- `backups/website-backup-YYYYMMDD-HHMMSS/website-files-*.zip` (project snapshot)
- `backups/website-backup-YYYYMMDD-HHMMSS/database-*.sql` (PostgreSQL dump, when available)
- `backups/website-backup-YYYYMMDD-HHMMSS/database-*.json` (automatic fallback if SQL dump tools are unavailable)
- `backups/website-backup-YYYYMMDD-HHMMSS/manifest.json` (checksums + metadata)

Note: these paths are relative to `backend/`.

Default behavior:
- Excludes heavy/dev folders: `node_modules`, `.venv`, `.git`, and previous `backups`
- Keeps only the most recent 10 backups automatically
- Tries DB backup via `pg_dump`; if unavailable, tries Docker container `rahman-postgres`; if still unavailable, exports DB as JSON fallback

Optional custom retention/root:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/backup-website.ps1 -BackupRoot ./backups -KeepLast 20
```

## 2) Restore after an issue

### Restore latest backup (files + DB)

```powershell
npm run restore:site
```

Restore priority:
1. SQL dump restore (`psql` or Docker `psql`) when available
2. JSON fallback restore using Node.js when SQL restore tools are unavailable

### Restore from a specific backup folder

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/restore-website.ps1 -BackupDir "./backups/website-backup-20260216-123456"
```

### Restore files only (skip DB)

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/restore-website.ps1 -RestoreDatabase:$false
```

## 3) Verify system after restore

```powershell
npm run smoke:health
```

Expected:
- `SMOKE_HEALTH=PASS`

## 4) Recommended survival practice

- Run `npm run backup:site` before every deployment.
- Configure automatic daily backups via Windows Task Scheduler.
- Keep a second copy of `backups/` on cloud storage or another drive.
- Test one restore monthly to ensure backups remain valid.

## 5) Enable daily auto-backup (Windows)

Create scheduled task (daily at 02:00):

```powershell
npm run backup:schedule
```

Remove scheduled task:

```powershell
npm run backup:unschedule
```

Custom schedule time/retention example:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/setup-backup-schedule.ps1 -Time "03:30" -KeepLast 20
```

## 6) Enable weekly offsite copy (recommended)

Copy latest local backup to offsite location now:

```powershell
npm run backup:offsite
```

Default offsite path:
- `OneDrive/Website-Offsite-Backups/resturant` (if OneDrive exists)
- otherwise `Documents/Website-Offsite-Backups/resturant`

Default secondary offsite path:
- `Documents/Website-Offsite-Backups-Secondary/resturant`

Create weekly offsite schedule (Sunday 03:30):

```powershell
npm run backup:offsite:schedule
```

Remove weekly offsite schedule:

```powershell
npm run backup:offsite:unschedule
```

Custom offsite path example:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/setup-offsite-schedule.ps1 -OffsiteRoot "D:\Website-Offsite-Backups\resturant"
```

Custom primary + secondary offsite paths:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/setup-offsite-schedule.ps1 -OffsiteRoot "D:\Website-Offsite-Backups\resturant" -SecondaryOffsiteRoot "E:\Website-Offsite-Backups\resturant"
```
