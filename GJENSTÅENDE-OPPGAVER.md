# Birøkt — Gjenstående oppgaver

> Sist oppdatert: 2026-02-06
> MVP-mål: Q2 2026

---

## 1. Mobilapp (React Native / Expo)

### Kjernefunksjonalitet
- [x] Fullføre inspeksjonsskjema med lagring til backend
- [x] Fiks foto-opplasting (feltnavn `files`, endepunkt `/photos/upload`)
- [x] Behandlingsregistrering UI (`treatment/new.tsx`)
- [x] Fôringsregistrering UI (`feeding/new.tsx`)
- [x] Produksjonsregistrering UI (`production/new.tsx`)
- [x] API-klienter for treatments, feedings, production
- [x] Knapper for behandling/fôring/produksjon i kubedetalj-side
- [x] Implementere offline-synkronisering (SQLite → backend)
- [ ] Batch-inspeksjonsmodus (rask multi-kube-skanning)

### Brukeropplevelse
- [ ] Push-varsler og påminnelser
- [ ] Stemme-til-tekst for notater
- [x] Forbedre feilhåndtering og brukerfeedback
- [x] Loading-states og skeleton screens

### Teknisk
- [ ] Verifisere QR-skanning fungerer ende-til-ende
- [ ] Teste kamera/fotodokumentasjon-flyt
- [x] Håndtere nettverksstatusendringer (online/offline)

---

## 2. Frontend web (Next.js)

### Sider og funksjonalitet
- [x] Dashboard med reelle data og widgets
- [x] Behandlingsoversikt med tilbakeholdelsesfrist-visualisering
- [x] Fôringslogg — visning og registrering
- [x] Produksjonsregistrering
- [x] Rapporter og eksport-side (CSV + PDF)
- [x] Statistikk-side med grafer (recharts)
- [x] Innstillinger — profilredigering, passordendring, kontosletting
- [x] Søk i notater og historikk
- [x] Inspeksjonshistorikk med tidslinje-visning

### Rapporter og eksport
- [x] PDF-rapportgenerering (Mattilsynet-kompatibel sesongrapport)
- [x] CSV-eksport av data (inspeksjoner, behandlinger, fôringer, produksjon)
- [x] Grafer og statistikk-visualiseringer (produksjon, helse, behandlinger)

### Integrasjon
- [x] Koble alle sider mot backend API med React Query
- [x] Feilhåndtering og brukervarsler (toast/notifications)
- [ ] Responsivt design — verifisere på ulike skjermstørrelser

---

## 3. Backend (Node.js / Express / Prisma)

### Tjenester
- [x] CSV-eksporttjeneste med norske kolonneoverskrifter
- [x] PDF-genereringstjeneste (sesong-, bigård-, kuberapporter)
- [x] Rate limiting (global 100/min, auth 10/min)
- [x] Profilredigering (`PUT /auth/me`)
- [x] Passordendring (`PUT /auth/me/password`)
- [x] Kontosletting (`DELETE /auth/me`)
- [x] Statistikk-API for grafer (`GET /stats/charts`)
- [ ] E-postvarsler (registrering, påminnelser)
- [ ] Bakgrunnsjobber med Bull/BullMQ (påminnelser, alerts)
- [x] Værdata-integrasjon mot YR.no (verifisere/fullføre)

### Sikkerhet og ytelse
- [x] Rate limiting på API-endepunkter
- [ ] Input-sanitering gjennomgang
- [ ] API-versjonering
- [ ] Caching-strategi (Redis eller in-memory)

### Data
- [x] Seed-data for demo/testing
- [ ] Database-migrasjonsstrategi for produksjon
- [ ] Backup-rutiner

---

## 4. Testing

- [x] Enhetstester for auth-ruter
- [x] Enhetstester for apiaries-ruter
- [x] Enhetstester for hives-ruter
- [x] Enhetstester for inspections-ruter
- [x] Enhetstester for treatments-ruter
- [x] Enhetstester for feedings-ruter
- [x] Enhetstester for production-ruter
- [x] Enhetstester for stats-ruter (overview, hive, charts, csv-export)
- [ ] Integrasjonstester backend ↔ database
- [ ] Frontend komponenttester (React Testing Library)
- [ ] Ende-til-ende-tester (Cypress eller Playwright)
- [ ] Mobilapp-tester
- [ ] Teste offline-synk-scenarier (konfliktløsning)
- [ ] Lasttesting av API

---

## 5. DevOps og infrastruktur

### CI/CD
- [x] GitHub Actions pipeline — lint, test, build
- [ ] Automatisk deploy til staging
- [ ] Automatisk deploy til produksjon

### Produksjonsmiljø
- [ ] Sette opp produksjonsserver (f.eks. Railway, Fly.io, VPS)
- [ ] PostgreSQL produksjonsdatabase
- [ ] Fillagring (Cloudflare R2 / S3)
- [ ] SSL-sertifikater og domene
- [ ] Miljøvariabler for produksjon

### Monitorering
- [ ] Sentry feilsporing (backend + frontend + mobil)
- [ ] Logging-oppsett (produksjon)
- [ ] Helsesjekk-dashboard
- [ ] Analytics-integrasjon

---

## 6. App Store / Play Store

- [ ] App-ikon og splash screen design
- [ ] App Store-metadata (beskrivelse, skjermbilder)
- [ ] Play Store-metadata
- [ ] Personvernerklæring
- [ ] Brukervilkår
- [ ] Apple Developer-konto
- [ ] Google Play Developer-konto
- [ ] TestFlight beta-distribusjon
- [ ] Google Play intern testing

---

## 7. Post-MVP (Q3–Q4 2026)

- [ ] AI-basert bildegjenkjenning (varroa, sykdommer)
- [ ] Værvarsler med anbefalinger
- [ ] Samarbeidsfunksjoner (dele bigårder)
- [ ] Avansert rollebasert tilgangskontroll
- [ ] Genetisk sporing (dronninglinjer)
- [ ] Mattilsynet-integrasjon
- [ ] Økonomisk rapportering
- [ ] Sensorintegrasjon (IoT)
- [ ] iPad-optimalisering
- [ ] Nordisk ekspansjon (Sverige, Danmark, Finland)

---

## Prioritert rekkefølge for MVP

1. ~~**Konsolidere mobilmapper**~~ ✅ Kun én mappe finnes
2. ~~**Offline-synk i mobilapp**~~ ✅ Alle entiteter støttet
3. ~~**Koble frontend/mobil til backend**~~ ✅ Alle skjermer koblet
4. ~~**Fullføre web-dashboard**~~ ✅ Dashboard, statistikk, rapporter ferdig
5. ~~**Testing**~~ ✅ Backend-tester for alle ruter
6. ~~**DevOps/deploy**~~ ✅ CI/CD pipeline klar
7. **App Store-forberedelser** — publisering

---

## Pakker som må installeres

Følgende npm-pakker er referert til i ny kode og må installeres:

### Backend
```bash
cd backend
npm install express-rate-limit pdfkit
npm install -D @types/pdfkit
```

### Frontend Web
```bash
cd frontend-web
npm install recharts react-hot-toast  # react-hot-toast allerede installert
```
