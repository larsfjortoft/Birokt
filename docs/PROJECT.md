# Birøkt — Digital birøktstyring

## Systemoversikt

Komplett system for birøktere til å administrere bigårder, kuber, inspeksjoner,
behandlinger, fôring, høsting og dronningavl. Løsningen har en sporbar myndighetsjournal
for flytting, legemidler, helse/kontroll og honningpartier, med offline-støtte på mobil
og integritetskontrollert eksport (CSV, PDF og ZIP).

## Stack

| Komponent | Teknologi | Plassering |
|-----------|-----------|------------|
| Backend | Node.js, Express, Prisma | Railway / self-hosted |
| Frontend web | Next.js 16, React 18, Tailwind, Zustand | Vercel / self-hosted |
| Mobilapp | React Native, Expo 54, Expo Router | Android (Samsung S25 Edge) |
| Database (prod) | PostgreSQL 15+ | Railway / Docker |
| Database (dev) | SQLite | Lokal fil |
| Database (mobil) | SQLite (expo-sqlite) | På enheten |
| Objektlagring | S3-kompatibel (MinIO dev, R2/S3 prod) | Konfigurerbar |

## Arkitektur

```
Lars (mobil)                    Lars (nettleser)
    |                               |
    | React Native + Expo           | Next.js 16
    | Lokal SQLite + sync           |
    v                               v
+-----------------------------------------------------------+
|  Birøkt API (Express)                                     |
|  /api/v1/...                                              |
|                                                           |
|  Autentisering:  JWT (access + refresh tokens)            |
|  Validering:     Zod                                      |
|  Rate limiting:  express-rate-limit                       |
|  Sikkerhet:      Helmet, XSS-sanitering, CORS             |
|                                                           |
|  Kjerneruter:                                             |
|    /auth          Registrering, innlogging, profil        |
|    /apiaries      Bigårder                                |
|    /hives         Kuber                                   |
|    /inspections   Inspeksjoner (inkl. batch)              |
|    /treatments    Behandlinger (varroa, sykdom)           |
|    /placements    Historisk plassering og flytting        |
|    /medicine-acquisitions  Legemiddelanskaffelser         |
|    /compliance-events      Helse, biosikkerhet, kontroll  |
|    /production-batches     Sporbare honningpartier        |
|    /documents     Autoriserte journalvedlegg              |
|    /feedings      Fôring                                  |
|    /production    Høsting og økonomi                      |
|    /queens        Dronningavl og stamtavle                |
|    /photos        Bildedokumentasjon                      |
|    /stats         Dashboard, CSV, PDF-rapporter           |
|    /weather       YR.no-integrasjon                       |
|    /calendar      Hendelser + Google Calendar sync        |
|    /journal       Sesongnotater                           |
|    /search        Fulltekstsøk                            |
|                                                           |
|  [PostgreSQL 15+]                                         |
|  [S3-lagring for bilder]                                  |
+-----------------------------------------------------------+
```

### Offline-arkitektur (mobil)

Mobilappen har full offline-støtte:
1. Lokal SQLite-database på enheten
2. Sync-kø for ventende operasjoner
3. Automatisk synkronisering når nett er tilgjengelig
4. Nettverksstatus-indikator i UI
5. Versjonerte SQLite-migreringer via `PRAGMA user_version`
6. Idempotensnøkkel og eksplisitt feilstatus for journalmutasjoner

Myndighetsjournalen støtter dokumentasjon, men erstatter ikke registrering av dyrehold/bigårdsplasser eller varsling til Mattilsynet. Brukeren må kontrollere at registreringene er korrekte og fullstendige.

## Kom i gang

### Backend

```bash
cd backend
npm install
npx prisma generate          # Generer Prisma-klient
npx prisma db push           # Opprett tabeller (SQLite i dev)
npm run dev                   # http://localhost:3000
```

### Frontend web

```bash
cd frontend-web
npm install
npm run dev                   # http://localhost:3001
```

### Mobil

```bash
cd mobile
npm install
npm run dev                   # Expo dev server
npm run run                   # Kjør på tilkoblet enhet
```

### Docker (full stack)

```bash
cp .env.example .env          # Fyll inn verdier
docker compose up             # API + PostgreSQL + evt. MinIO
```

## Mappestruktur

```
Birøkt/
├── backend/
│   ├── src/
│   │   ├── index.ts            # Express entry point
│   │   ├── routes/             # 16 API-ruter (5600+ linjer)
│   │   ├── middleware/         # Auth, rate limit, XSS, feil
│   │   ├── services/           # CSV, PDF, e-post, notifikasjoner
│   │   ├── utils/              # JWT, passord, cache
│   │   ├── config/             # Miljøkonfigurasjon
│   │   └── __tests__/          # 8 testfiler (Jest)
│   ├── prisma/
│   │   └── schema.prisma       # 17 modeller, 471 linjer
│   ├── Dockerfile
│   └── package.json
├── frontend-web/
│   ├── src/
│   │   ├── app/                # 23 sider (Next.js App Router)
│   │   ├── components/         # UI-komponenter + skjemaer
│   │   ├── lib/                # API-klient, utilities
│   │   └── stores/             # Zustand state management
│   ├── Dockerfile
│   └── package.json
├── mobile/
│   ├── src/
│   │   ├── app/                # 21 skjermer (Expo Router)
│   │   ├── components/         # OfflineIndicator, PhotoPicker, VoiceInput
│   │   ├── services/           # SQLite, sync, notifikasjoner
│   │   └── stores/             # Auth state
│   ├── app.json
│   └── package.json
├── .github/workflows/
│   ├── ci.yml                  # Lint, test, build
│   └── deploy.yml              # Staging + prod deploy
├── Documentation/
│   ├── PRD-Birokt.md           # Produktkrav
│   ├── SETUP.md                # Oppsett og utviklingsguide
│   ├── teknisk-arkitektur.md   # Teknisk arkitektur
│   ├── PRODUCTION-READY.md     # Go-live sjekkliste
│   └── spesifikasjon-dronningproduksjon.md
├── docker-compose.yml          # Dev (med profiler)
├── docker-compose.prod.yml     # Produksjon
├── .env.example
└── GJENSTÅENDE-OPPGAVER.md     # Oppgaveliste
```

## Konfigurasjon

### Backend (.env)

| Variabel | Beskrivelse | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (prod) eller `file:./dev.db` | SQLite i dev |
| `JWT_SECRET` | JWT signing secret (min 32 tegn i prod) | — |
| `JWT_ACCESS_EXPIRY` | Access token utløp | `1h` |
| `JWT_REFRESH_EXPIRY` | Refresh token utløp | `30d` |
| `PORT` | API-port | `3000` |
| `CORS_ORIGINS` | Tillatte origins | `http://localhost:3001,...` |
| `S3_ENDPOINT` | S3/MinIO-endepunkt | `http://localhost:9000` |
| `S3_BUCKET` | Bildelagring-bucket | `birokt-photos` |
| `S3_ACCESS_KEY` | S3 access key | — |
| `S3_SECRET_KEY` | S3 secret key | — |
| `SMTP_HOST/PORT/USER/PASS` | E-post (valgfritt) | — |

### Frontend web

| Variabel | Beskrivelse |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000/api/v1` |
| `NEXT_PUBLIC_CDN_URL` | `http://localhost:3000/uploads` |

### Mobil

| Variabel | Beskrivelse |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | `http://openclaw.tail586d8a.ts.net:3100/api/v1` (Tailscale MagicDNS) |

## Databasemodeller (Prisma)

17 modeller: User, RefreshToken, Apiary, UserApiary, Hive, Inspection,
Photo, InspectionAction, Treatment, Feeding, Production, Queen, QueenHiveLog,
PushToken, NotificationSettings, CalendarEvent, JournalEntry.

Hovedrelasjoner:
- User -> Apiary (mange-til-mange via UserApiary med roller)
- Apiary -> Hive -> Inspection, Treatment, Feeding, Production
- Queen -> Queen (mor-datter stamtavle)
- Inspection -> Photo, InspectionAction

## Funksjoner

### Kjernefunksjoner
- Bigård- og kubeadministrasjon
- Detaljerte inspeksjoner med helse, vær, rammetelling
- Bildedokumentasjon med tags
- Behandlingssporing med tilbakeholdelsestid
- Fôringslogg
- Høsting og økonomisporing

### Avansert
- Dronningavl med stamtavle (mor-datter)
- Google Calendar toveis-synk
- Sesongjournal med humør og vær
- Fulltekstsøk
- CSV-eksport (norske kolonneoverskrifter)
- PDF-rapporter (sesong, enkeltkube, bigård)
- YR.no vær-integrasjon
- Push-notifikasjoner (inspeksjons- og behandlingspåminnelser)
- Offline-støtte med synkronisering (mobil)
- QR-kode-skanning for kuber
- Stemmeinndata for notater
