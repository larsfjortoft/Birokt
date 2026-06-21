# Birøkt — Deployment og drift

## Hvor kjører det

Birøkt er satt opp for deploy til Railway (backend) og Vercel (frontend),
men kan også self-hostes med Docker.

| Komponent | Plattform | URL |
|-----------|-----------|-----|
| Backend API | Railway / self-hosted | Konfigurerbar |
| Frontend web | Vercel / self-hosted | Konfigurerbar |
| PostgreSQL | Railway / Docker | — |
| Bildelagring | Cloudflare R2 / AWS S3 / MinIO | — |

---

## Forutsetninger

- Node.js 20+ LTS
- Docker og Docker Compose (for self-hosting)
- PostgreSQL 15+ (produksjon)
- S3-kompatibel lagring for bilder (valgfritt)

---

## Deploy med Docker (self-hosted)

```bash
# Kopier prosjektfiler til server
scp -r . bruker@server:/opt/birokt/

# På serveren
cd /opt/birokt
cp .env.example .env
# Rediger .env — sett DATABASE_URL, JWT_SECRET, S3-config

# Start
docker compose -f docker-compose.prod.yml up -d --build

# Verifiser
curl http://localhost:3000/health
curl http://localhost:3000/readyz
```

---

## Deploy med Railway + Vercel (CI/CD)

### GitHub Secrets som må settes

| Secret | Beskrivelse |
|--------|-------------|
| `RAILWAY_TOKEN` | Railway API-token |
| `RAILWAY_SERVICE_STAGING` | Railway staging service ID |
| `RAILWAY_SERVICE_PRODUCTION` | Railway prod service ID |
| `VERCEL_TOKEN` | Vercel API-token |
| `VERCEL_ORG_ID` | Vercel org ID |
| `VERCEL_PROJECT_ID_STAGING` | Vercel staging project ID |
| `VERCEL_PROJECT_ID_PRODUCTION` | Vercel prod project ID |

### Deploy-flyt

- **Push til `develop`** → Deploy til staging (Railway + Vercel)
- **Push til `main`** → Deploy til produksjon (Railway + Vercel)

CI kjører først: lint, test, build. Deploy skjer kun hvis CI er grønn.

---

## Oppdatering (Docker)

```bash
cd /opt/birokt
git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
curl http://localhost:3000/health
```

---

## Oppdatering (Railway/Vercel)

Push til `main` — CI/CD håndterer resten.

---

## Database-migrasjoner

```bash
# Generer Prisma-klient
npx prisma generate

# Push skjemaendringer til database
npx prisma db push

# Eller med migrasjoner (produksjon)
npx prisma migrate deploy
```

---

## Logger

### Docker

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f db
```

### Railway

Se Railway dashboard for logger.

---

## Backup

### PostgreSQL (Docker)

```bash
docker exec <db-container> pg_dump -U birokt birokt | gzip > birokt-backup.sql.gz
```

### Restore

```bash
docker compose stop api
gunzip -c birokt-backup.sql.gz | docker exec -i <db-container> psql -U birokt birokt
docker compose start api
```

---

## Mobilapp

### Bygg og installer

```bash
cd mobile
npm run build        # Bygger web + syncer til Capacitor
npm run open         # Åpner Android Studio
```

Eller direkte på enhet:
```bash
npm run run          # Kjør på tilkoblet enhet via Expo
```

### Samsung S25 Edge — etter installasjon

1. Godkjenn notifikasjonstillatelse
2. Godkjenn batterioptimering-unntak
3. Innstillinger > Batteri > Legg til i "Aldri sovende apper"

---

## Feilsøking

| Problem | Løsning |
|---------|----------|
| API svarer ikke | Sjekk `docker compose ps` eller Railway dashboard |
| Database connection refused | Sjekk `DATABASE_URL` og at PostgreSQL kjører |
| JWT-feil | Sjekk at `JWT_SECRET` er satt (min 32 tegn) |
| Bilder lastes ikke opp | Sjekk S3-konfigurasjon og bucket-tilgang |
| CI feiler | Sjekk at alle GitHub Secrets er satt |
| Prisma-feil | Kjør `npx prisma generate` etter skjemaendringer |
| Mobilapp offline | Sjekk nettverkstilgang og API-URL i app-konfig |
| CORS-feil | Sjekk `CORS_ORIGINS` i `.env` |

---

## Helsesjekk-endepunkter

```bash
# Basic helsesjekk
curl http://localhost:3000/health

# Readiness (inkl. databasetilkobling)
curl http://localhost:3000/readyz
```
