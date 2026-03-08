# Birøkt-system - Oppsett & Utviklingsguide

Komplett guide for å sette opp lokalt utviklingsmiljø for Birøkt-systemet.

## 📋 Innholdsfortegnelse

1. [Forutsetninger](#forutsetninger)
2. [Rask Start (Docker)](#rask-start-docker)
3. [Manuelt Oppsett](#manuelt-oppsett)
4. [Prosjektstruktur](#prosjektstruktur)
5. [Utvikling](#utvikling)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Feilsøking](#feilsøking)

---

## 1. Forutsetninger

### Påkrevd programvare:

- **Node.js** 20.x LTS eller nyere
- **npm** eller **yarn** eller **pnpm**
- **Docker** og **Docker Compose** (anbefalt for enklest oppsett)
- **Git**

### For mobil-utvikling:
- **Expo CLI**: `npm install -g expo-cli`
- **iOS**: Xcode (kun macOS)
- **Android**: Android Studio

### Valgfri (for manuelt oppsett):
- **PostgreSQL** 15+
- **Redis** 7+

---

## 2. Rask Start (Docker)

### Steg 1: Klon prosjektet

```bash
git clone https://github.com/yourorg/birokt.git
cd birokt
```

### Steg 2: Konfigurer miljøvariabler

Kopier eksempel-konfigurasjon:

```bash
cp .env.example .env
```

Rediger `.env` og juster verdier om nødvendig.

### Steg 3: Start alle tjenester

```bash
docker-compose up -d
```

Dette starter:
- PostgreSQL database (port 5432)
- MinIO (S3-storage, port 9000 + 9001 konsoll)
- Redis (port 6379)
- API server (port 3000)
- Web frontend (port 3001) - valgfritt
- Adminer (database UI, port 8080)

### Steg 4: Kjør database-migrasjoner

```bash
docker-compose exec api npm run migrate
```

### Steg 5: Seed test-data (valgfritt)

```bash
docker-compose exec api npm run seed
```

### Steg 6: Åpne applikasjonen

- **API**: http://localhost:3000
- **API Dokumentasjon**: http://localhost:3000/api-docs
- **Web UI**: http://localhost:3001
- **MinIO Console**: http://localhost:9001 (minioadmin / minioadmin)
- **Adminer (DB UI)**: http://localhost:8080

### Test-bruker (etter seed):
- **Email**: test@birokt.no
- **Passord**: TestPass123!

---

## 3. Manuelt Oppsett

Hvis du ikke bruker Docker, følg disse stegene:

### Backend (API)

```bash
cd backend

# Installer avhengigheter
npm install

# Sett opp .env
cp .env.example .env
# Rediger .env med dine verdier

# Sett opp database
createdb birokt
psql birokt < ../migrations/001_initial_schema.sql

# Start utviklingsserver
npm run dev
```

### Frontend (Web)

```bash
cd frontend-web

# Installer avhengigheter
npm install

# Sett opp .env.local
cp .env.example .env.local
# Rediger .env.local med API URL

# Start utviklingsserver
npm run dev
```

### Mobil (React Native + Expo)

```bash
cd mobile

# Installer avhengigheter
npm install

# Start Expo
npx expo start

# Scan QR-koden med Expo Go-appen (iOS/Android)
# eller trykk 'i' for iOS simulator / 'a' for Android emulator
```

---

## 4. Prosjektstruktur

```
birokt/
├── backend/                    # Node.js API server
│   ├── src/
│   │   ├── controllers/        # Route handlers
│   │   ├── models/             # Database models (Prisma)
│   │   ├── services/           # Business logic
│   │   ├── middleware/         # Express middleware
│   │   ├── utils/              # Helper functions
│   │   ├── routes/             # API routes
│   │   └── index.ts            # Entry point
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   ├── tests/                  # Unit & integration tests
│   ├── Dockerfile
│   └── package.json
│
├── frontend-web/               # Next.js web application
│   ├── app/                    # App router (Next.js 14+)
│   ├── components/             # React components
│   ├── lib/                    # Utilities & API client
│   ├── public/                 # Static assets
│   └── package.json
│
├── mobile/                     # React Native + Expo app
│   ├── app/                    # Expo Router screens
│   ├── components/             # React Native components
│   ├── services/               # API & SQLite services
│   ├── utils/                  # Helper functions
│   ├── app.json                # Expo config
│   └── package.json
│
├── migrations/                 # SQL migration scripts
│   └── 001_initial_schema.sql
│
├── docs/                       # Documentation
│   ├── teknisk-arkitektur.md
│   ├── openapi-spec.yaml
│   └── wireframes.html
│
├── docker-compose.yml          # Docker Compose configuration
├── .env.example                # Environment variables template
└── README.md                   # This file
```

---

## 5. Utvikling

### Backend Development

**Kjør utviklingsserver med hot reload:**

```bash
cd backend
npm run dev
```

**Kjør linter:**

```bash
npm run lint
```

**Formater kode:**

```bash
npm run format
```

**Database migrering (Prisma):**

```bash
# Generer Prisma client etter schema-endringer
npm run prisma:generate

# Kjør migrering
npm run prisma:migrate

# Åpne Prisma Studio (database GUI)
npm run prisma:studio
```

### Frontend Web Development

**Kjør utviklingsserver:**

```bash
cd frontend-web
npm run dev
```

**Bygg for produksjon:**

```bash
npm run build
npm start
```

### Mobil Development

**Start Expo development server:**

```bash
cd mobile
npx expo start
```

**Kjør på iOS simulator:**

```bash
npx expo start --ios
```

**Kjør på Android emulator:**

```bash
npx expo start --android
```

**Bygg for testing (EAS Build):**

```bash
# iOS TestFlight
eas build --platform ios --profile preview

# Android APK
eas build --platform android --profile preview
```

---

## 6. Testing

### Backend Tests

```bash
cd backend

# Kjør alle tester
npm test

# Kjør med coverage
npm run test:coverage

# Kjør i watch mode
npm run test:watch

# Kjør spesifikk testfil
npm test -- hive.service.test.ts
```

### Integration Tests

```bash
# Sett opp test-database først
createdb birokt_test
DATABASE_URL="postgresql://birokt:password@localhost:5432/birokt_test" npm test
```

### E2E Tests (Web)

```bash
cd frontend-web

# Installer Playwright
npx playwright install

# Kjør E2E tester
npm run test:e2e

# Kjør i UI mode
npm run test:e2e:ui
```

---

## 7. Deployment

### Backend (Railway / DigitalOcean / VPS)

**Med Railway:**

```bash
# Installer Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link til prosjekt
railway link

# Deploy
railway up
```

**Med Docker:**

```bash
# Bygg image
docker build -t birokt-api:latest ./backend

# Tag for registry
docker tag birokt-api:latest registry.example.com/birokt-api:latest

# Push til registry
docker push registry.example.com/birokt-api:latest
```

### Frontend Web (Vercel)

```bash
cd frontend-web

# Installer Vercel CLI
npm install -g vercel

# Deploy
vercel
```

Eller koble GitHub repository til Vercel for automatisk deployment.

### Mobil (Expo EAS)

```bash
cd mobile

# Installer EAS CLI
npm install -g eas-cli

# Login
eas login

# Konfigurer prosjekt
eas build:configure

# Bygg for iOS (App Store)
eas build --platform ios --profile production

# Bygg for Android (Play Store)
eas build --platform android --profile production

# Submit til App Store
eas submit --platform ios

# Submit til Play Store
eas submit --platform android
```

---

## 8. Feilsøking

### Problem: Database connection error

**Løsning:**
```bash
# Sjekk at PostgreSQL kjører
docker-compose ps postgres

# Restart database
docker-compose restart postgres

# Sjekk logs
docker-compose logs postgres
```

### Problem: "Module not found" errors

**Løsning:**
```bash
# Slett node_modules og reinstaller
rm -rf node_modules package-lock.json
npm install
```

### Problem: Expo app won't connect to API

**Løsning:**

1. Sjekk at API kjører og er tilgjengelig
2. For fysisk enhet: Bruk IP-adresse istedenfor `localhost`
   ```javascript
   // I mobile/app.config.js
   apiUrl: "http://192.168.1.100:3000/api/v1"  // Bruk din lokale IP
   ```
3. For emulator/simulator: `localhost` fungerer vanligvis

### Problem: MinIO connection issues

**Løsning:**
```bash
# Åpne MinIO Console
open http://localhost:9001

# Login: minioadmin / minioadmin
# Opprett bucket manuelt: "birokt-photos"
# Sett bucket policy til "public" for testing
```

### Problem: Port already in use

**Løsning:**
```bash
# Finn prosess som bruker port (f.eks. 3000)
lsof -i :3000

# Kill prosess
kill -9 <PID>

# Eller bruk annen port i .env
PORT=3001
```

---

## 📚 Ytterligere Dokumentasjon

- [Teknisk Arkitektur](./docs/teknisk-arkitektur.md)
- [API Spesifikasjon (OpenAPI)](./docs/openapi-spec.yaml)
- [Database Schema](./migrations/001_initial_schema.sql)
- [Wireframes](./docs/wireframes.html)

---

## 🤝 Bidra

1. Fork prosjektet
2. Opprett en feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit endringer (`git commit -m 'Add some AmazingFeature'`)
4. Push til branch (`git push origin feature/AmazingFeature`)
5. Åpne en Pull Request

---

## 📝 Lisens

Proprietary - All rights reserved

---

## 📧 Kontakt

- **Email**: support@birokt.no
- **Website**: https://birokt.no
- **GitHub**: https://github.com/yourorg/birokt

---

## 🎉 Rask Referanse - Nyttige Kommandoer

```bash
# Start alt (Docker)
docker-compose up -d

# Stopp alt
docker-compose down

# Restart en tjeneste
docker-compose restart api

# Se logs
docker-compose logs -f api

# Kjør kommando i container
docker-compose exec api npm run migrate

# Backend dev
cd backend && npm run dev

# Web dev
cd frontend-web && npm run dev

# Mobile dev
cd mobile && npx expo start

# Tester
npm test

# Lint & format
npm run lint && npm run format

# Database reset (farlig!)
docker-compose down -v
docker-compose up -d postgres
docker-compose exec api npm run migrate
docker-compose exec api npm run seed
```

---

**Happy coding! 🐝🍯**
