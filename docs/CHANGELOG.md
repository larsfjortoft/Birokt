# Changelog

## 2026-06-20 — QR- og 3D-kubeetiketter

- Kubekortet kan laste ned en printklar QR-etikett (SVG) med kubenavn.
- Kubekortet kan også lage en STL-fil med opphøyd kubenavn og QR-kode for 3D-print.
- Skanning av etikettens QR-kode i mobilappen starter nå en ny inspeksjon direkte for riktig kube.

## 2026-03-22 — Helsefilter for kuber

- Filtrer kuber etter helsestatus (frisk, advarsel, kritisk) på kubesiden

## 2026-03-26 — Norske tegn fikset

- Fikset UTF-8-håndtering på journal-siden

## 2026-03-25 — Journal-funksjon

- Sesongnotater med kategorier, humør og vær-observasjoner
- Tag-basert organisering og søk

## 2026-03-24 — Google Calendar-synkronisering

- Toveis synk med Google Calendar via OAuth
- Kalender-modal bruker valgt dato som default, norsk datoformat

## 2026-03-23 — Kalender-funksjon

- Hendelsesplanlegging for birøktaktiviteter
- Hendelsestyper: besøk, fôring, dronningavl, behandling, høsting, møte
- Kube- og bigårdspesifikke hendelser

## 2026-03-22 — Offline sync-støtte

- Inspeksjoner kan opprettes offline og synkroniseres når nett er tilbake
- Fikset norsk tekst i flere visninger
- Deploy-oppdateringer

## 2026-01-31 — Første versjon (MVP-baseline)

- Express API med 16 rutemodeller og Prisma ORM
- Next.js frontend med 23 sider
- React Native / Expo mobilapp med 21 skjermer
- JWT-autentisering med access + refresh tokens
- Full CRUD for bigårder, kuber, inspeksjoner, behandlinger, fôring, høsting
- Dronningavl med stamtavle
- Bildedokumentasjon med S3-lagring
- CSV-eksport og PDF-rapporter
- YR.no vær-integrasjon
- Push-notifikasjoner
- Offline-støtte på mobil (SQLite + sync-kø)
- Docker Compose for utvikling og produksjon
- GitHub Actions CI/CD (Railway + Vercel)
- 8 backend-testsuiter (Jest)
