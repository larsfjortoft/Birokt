# Production Readiness Guide

This project now includes strict CI, deploy workflows, and production container files.

## 1) Required GitHub Secrets

Set these repository secrets before enabling automatic deploys:

- `RAILWAY_TOKEN`
- `RAILWAY_SERVICE_STAGING`
- `RAILWAY_SERVICE_PRODUCTION`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_STAGING`
- `VERCEL_PROJECT_ID_PRODUCTION`

## 2) Required Runtime Environment

Backend must define:

- `DATABASE_URL`
- `JWT_SECRET` (minimum 32 chars in production)
- `CORS_ORIGINS`

Optional backend variables:

- `JWT_ACCESS_EXPIRY`
- `JWT_REFRESH_EXPIRY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Web must define:

- `NEXT_PUBLIC_API_URL`

## 3) CI and Deploy Workflows

- CI: `.github/workflows/ci.yml`
- Deploy: `.github/workflows/deploy.yml`

Behavior:

- Push/PR to `main`/`develop` runs strict CI.
- Push to `develop` deploys to staging when staging secrets exist.
- Push to `main` deploys to production when production secrets exist.

## 4) Container Deployment

- Backend prod image: `backend/Dockerfile`
- Web prod image: `frontend-web/Dockerfile`
- Compose stack: `docker-compose.prod.yml`

Run locally with production-like config:

```bash
cp .env.example .env
# fill required values

docker compose -f docker-compose.prod.yml up --build
```

## 5) Pre-Go-Live Checklist

- Set all required secrets and env vars.
- Verify `/health` and `/readyz` on backend.
- Verify CI is green on `main`.
- Confirm SMTP works (or explicitly keep disabled).
- Verify DNS and TLS for app and API domains.
- Run backup/restore drill for the database.