# Changelog

## 2026-08-24 — Myndighetsjournal og sporbar dokumentasjon

- La til historisk plasserings- og flyttejournal med snapshots, batchflytting, konfliktsjekk og idempotent mobilsynk.
- Utvidet legemiddeljournalen med anskaffelse, faktisk mengde/enhet, leverandør, veterinær/resept, eksplisitt null dagers tilbakeholdelse, fem års retensjon og annullering.
- La til revisjonsspor, beskyttede dokumentvedlegg med SHA-256, helse-/biosikkerhets-/kontrollhendelser og sporbare produksjonspartier.
- La til samlet PDF og integritetskontrollert ZIP-eksport med manifest, datakvalitetsavvik og rettelseshistorikk.
- Mobilens SQLite bruker nå versjonerte migreringer og bevarer sykdommer/skadedyr samt nye journaldata offline.
- Produkttekstene presiserer at appen støtter dokumentasjon, men ikke erstatter registrering/varsling eller garanterer juridisk etterlevelse.

## 2026-06-25 — Stabil mobiltilkobling via Tailscale

- Mobilappen bruker nå Pi-ens Tailscale MagicDNS-adresse, slik at den fungerer både hjemme og utenfor lokalnettet.
- API-kall stopper etter 12 sekunder med en forklarende melding i stedet for å henge lenge når Tailscale ikke er tilgjengelig.
- Data oppdateres når appen åpnes igjen, og cachen er redusert til ett minutt.
- Lokale mobilbygg bruker samme Tailscale-adresse som releasebygg, og sync erstatter nå lokal offline-cache med serverens fasit.

## 2026-06-21 — Hermes-agent API

- La til agentkatalog og Hermes-skill for å styre Birøkt via det samme API-et som web- og mobilappen bruker.
- Hermes kan oppdage bigårder, kuber, inspeksjoner, behandlinger, fôring, høsting, dronninger, kalender, journal, rapporter og søk.

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
