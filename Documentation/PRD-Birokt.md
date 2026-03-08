# Product Requirements Document (PRD)
# Birøkt - Digital Birøktstyring

**Versjon:** 1.0  
**Dato:** 31. januar 2026  
**Produkteier:** Lars Johansen  
**Status:** Draft

---

## 📋 Innholdsfortegnelse

1. [Executive Summary](#1-executive-summary)
2. [Produktvisjon & Mål](#2-produktvisjon--mål)
3. [Målgruppe & Personas](#3-målgruppe--personas)
4. [Markedsanalyse](#4-markedsanalyse)
5. [Brukerhistorier & Use Cases](#5-brukerhistorier--use-cases)
6. [Funksjonelle Krav](#6-funksjonelle-krav)
7. [Ikke-funksjonelle Krav](#7-ikke-funksjonelle-krav)
8. [UX-krav & Designprinsipper](#8-ux-krav--designprinsipper)
9. [Suksessmålinger](#9-suksessmålinger)
10. [Roadmap & Faser](#10-roadmap--faser)
11. [Risiko & Mitigering](#11-risiko--mitigering)
12. [Avhengigheter & Begrensninger](#12-avhengigheter--begrensninger)
13. [Vedlegg](#13-vedlegg)

---

## 1. Executive Summary

### 1.1 Produktbeskrivelse

**Birøkt** er et moderne, brukervennlig digitalt styringssystem for birøktere som erstatter tradisjonelle papirbaserte metoder. Systemet kombinerer en kraftig desktop/web-applikasjon for administrasjon og analyse med en intuitivt mobil-app optimalisert for feltbruk i bigården.

Systemet gjør det enkelt å:
- 📱 Registrere inspeksjoner direkte i bigården via mobil/nettbrett
- 📊 Analysere data og trender på tvers av kuber og sesonger
- 📸 Dokumentere med foto og notater
- 💊 Holde oversikt over behandlinger og karenstider
- 🍯 Spore produksjon og økonomi
- 🗺️ Administrere flere bigårder og lokasjoner

### 1.2 Problemstilling

Norske birøktere står overfor flere utfordringer:

**Dagens situasjon:**
- 📝 Papirbasert journalføring er tidkrevende og uorganisert
- 🔍 Vanskelig å finne historisk informasjon raskt
- 📊 Ingen god oversikt over trender og mønstre
- 💼 Krevende å overholde Mattilsynets dokumentasjonskrav
- 📱 Eksisterende løsninger er ikke tilpasset norske forhold eller brukervennlige nok

**Konsekvenser:**
- Tapt tid på administrasjon istedenfor birøkt
- Glemt behandlinger eller inspeksjoner
- Manglende grunnlag for forbedring av drift
- Stress ved kontroll fra Mattilsynet

### 1.3 Løsning

Birøkt tilbyr en **offline-first mobil-app** for feltarbeid kombinert med en **kraftig web-plattform** for analyse og administrasjon. Systemet er:

- ✅ **Norsk-tilpasset**: Språk, regelverk, værdata fra YR
- ✅ **Offline-fungerende**: Jobber uten internett i felt
- ✅ **Brukervennlig**: Minimal læringskurve, intuitiv design
- ✅ **Fleksibel**: Støtter både hobbybirøktere og kommersielle aktører
- ✅ **Omfattende**: Fra inspeksjon til rapportering i én løsning

### 1.4 Forretningsmål

1. **Q2 2026**: Lansere MVP med 50 beta-testere
2. **Q4 2026**: 500 betalende brukere
3. **2027**: 2000+ brukere, etablert som markedsleder i Norge
4. **Langsiktig**: Ekspandere til nordiske land

### 1.5 Målgruppe

- **Primær**: Norske birøktere med 5-100 kuber (semi-profesjonelle)
- **Sekundær**: Hobbybirøktere (1-10 kuber) og profesjonelle (100+ kuber)
- **Geografisk**: Norge, senere Norden

---

## 2. Produktvisjon & Mål

### 2.1 Visjon

> *"Gjøre birøkt enklere, mer datadrevet og bærekraftig gjennom moderne teknologi som respekterer birøkterens arbeidsflyt."*

### 2.2 Misjon

Gi norske birøktere verktøyene de trenger for å:
- Drive mer effektivt og produktivt
- Ta bedre beslutninger basert på data
- Overholde regelverk uten ekstra byrde
- Fokusere på biene, ikke på papirarbeid

### 2.3 Produktmål

| Kategori | Mål | Måleenhet |
|----------|-----|-----------|
| **Brukeropplevelse** | Redusere tid på administrasjon med 50% | Timer spart per sesong |
| **Datakvalitet** | 95% av inspeksjoner digitalisert | % digitale inspeksjoner |
| **Retensjonsrate** | 80% årlig retention | % aktive brukere etter 12 mnd |
| **Produktivitet** | Gjennomsnittlig 3 min per inspeksjon | Tid fra QR-scan til lagring |
| **Tilfredshet** | NPS score > 50 | Net Promoter Score |

### 2.4 Differensieringsfaktorer

**Vs. Papirbaserte løsninger:**
- Øyeblikkelig tilgang til historikk
- Automatisk analyse og varsler
- Søkbart fotoarkiv
- Alltid tilgjengelig backup

**Vs. Konkurrerende digitale løsninger:**
- Norsk språk og tilpasning
- Offline-fungerende mobil-app
- QR-kode basert hurtigregistrering
- Moderne, rask brukeropplevelse
- Spesifikt designet for nordiske forhold

---

## 3. Målgruppe & Personas

### 3.1 Primær Målgruppe

**Semi-profesjonelle birøktere**
- 10-50 kuber
- Driver birøkt som viktig biinntekt eller heltid
- Teknologisk komfortable (bruker smarttelefon daglig)
- Ønsker å profesjonalisere driften
- Har flere bigårder
- Alder: 35-60 år

### 3.2 Persona 1: "Kjetil - Den Profesjonelle"

**Demografi:**
- 42 år, gift, to barn
- Tidligere IT-konsulent, nå heltids birøkter
- Bor på gård i Telemark
- 45 kuber fordelt på 3 bigårder

**Mål:**
- Maksimere honningproduksjon
- Redusere tap gjennom vinteren
- Bygge merkevare og salg av kvalitetshonning
- Effektivisere drift for å spare tid

**Frustrasjon:**
- Bruker for mye tid på Excel-ark og notater
- Vanskelig å huske hvilke kuber som trenger oppfølging
- Vet ikke hvilke beslutninger som faktisk forbedrer produksjon
- Savner datadrevet innsikt

**Hvordan Birøkt hjelper:**
- Oversikt over alle kuber og bigårder på ett sted
- Automatiske varsler om oppgaver
- Produksjonsanalyse per kube og sesong
- Mobil-app for rask registrering i felt

**Sitat:**
> "Jeg vil drive birøkt mer som en virksomhet. Det betyr at jeg trenger data og innsikt, ikke bare magefølelse."

---

### 3.3 Persona 2: "Marit - Hobbybirøkteren"

**Demografi:**
- 58 år, gift, voksne barn
- Lærer på ungdomsskole, birøkt som hobby
- Bor i Sandnes med hage
- 6 kuber i én bigård

**Mål:**
- Holde biene friske og produktive
- Lære mer om birøkt
- Dele glede med familie og naboer
- Følge regler og beste praksis

**Frustrasjon:**
- Glemmer når hun sist inspiserte hver kube
- Usikker på om hun behandler riktig
- Papirnotater blir borte eller ødelagt av vær
- Vet ikke om kubene presterer godt sammenlignet med andre

**Hvordan Birøkt hjelper:**
- Enkel app som minner på inspeksjoner
- Forhåndsutfylte skjemaer reduserer gjetning
- Veiledning om behandlinger og karenstid
- Fotoarkiv for å se utvikling over tid

**Sitat:**
> "Jeg er ikke ekspert, så jeg trenger et system som hjelper meg å gjøre tingene riktig første gang."

---

### 3.4 Persona 3: "Erik - Den Kommersielle"

**Demografi:**
- 52 år, driver birøkt i tredje generasjon
- Bor på Østlandet
- 180 kuber fordelt på 8 bigårder
- Ansetter ekstra hjelp i sesongen

**Mål:**
- Effektiv drift av stor operasjon
- Delegere oppgaver til ansatte
- Overholde kommersiell standard og sertifiseringer
- Optimalisere logistikk (flytting av kuber til lyngheier)

**Frustrasjon:**
- Vanskelig å koordinere med ansatte
- Må kunne vise dokumentasjon til Mattilsynet umiddelbart
- Trenger oversikt over store datamengder
- Papirbaserte systemer fungerer ikke ved skala

**Hvordan Birøkt hjelper:**
- Multi-bruker støtte med roller
- Sentral oversikt over alle lokasjoner
- Eksport av rapporter for myndighetskrav
- Batch-operasjoner for å jobbe effektivt

**Sitat:**
> "Med 180 kuber kan jeg ikke basere meg på hukommelse. Jeg trenger et profesjonelt system."

---

### 3.5 Sekundær Målgruppe

**Nybegynnere (1-4 kuber):**
- Trenger veiledning og struktur
- Vil lære best practice
- Mindre kritiske behov for avanserte funksjoner

**Birøkterlag og foreninger:**
- Ønsker å dele kunnskap
- Trenger aggregert statistikk
- Potensial for gruppelisenser

---

## 4. Markedsanalyse

### 4.1 Markedsstørrelse (Norge)

| Segment | Antall | Gjennomsnitt kuber | Total kuber |
|---------|--------|-------------------|-------------|
| Hobbybirøktere | ~4,000 | 3 | 12,000 |
| Semi-profesjonelle | ~800 | 25 | 20,000 |
| Profesjonelle | ~50 | 200 | 10,000 |
| **Totalt** | **~4,850** | - | **42,000** |

**TAM (Total Addressable Market):**
- 4,850 potensielle brukere i Norge
- Ved ₹300/måned: ~₹17.5M ARR ved 100% penetrasjon

**SAM (Serviceable Addressable Market):**
- Semi-profesjonelle + Profesjonelle: ~850 brukere
- Ved ₹300/måned: ~₹3M ARR ved 100% penetrasjon

**SOM (Serviceable Obtainable Market - År 1):**
- Realistisk målgruppe år 1: 500 brukere (10% av SAM)
- Ved ₹300/måned: ~₹1.8M ARR

### 4.2 Konkurrentanalyse

**Internasjonale løsninger:**

| Produkt | Styrker | Svakheter | Pris |
|---------|---------|-----------|------|
| **Hive Tracks (USA)** | Moden, mange funksjoner | Ikke norsk, kompleks, ikke offline | $99/år |
| **BeeKeeper (UK)** | Enkel, moderne UI | Begrenset funksjonalitet, ikke norsk | £50/år |
| **Apiary Book (EU)** | Gratis, open source | Utdatert design, ingen mobil-app | Gratis |

**Norske løsninger:**
- ❌ Ingen betydelige norske konkurrenter per i dag
- ✅ Dette er en unik mulighet for markedsledelse

**Papirbaserte løsninger:**
- Norges Birøkterlag sin inspeksjonsbok
- Egne Excel-ark
- Håndskrevne notater

### 4.3 Konkurransefortrinn

1. **Norsk-tilpasset**: Språk, YR-værdata, Mattilsynets krav
2. **Offline-first**: Fungerer i felt uten dekning
3. **Moderne teknologi**: React Native, rask, responsiv
4. **QR-kode workflow**: Raskere enn konkurrentene
5. **Kundestøtte**: Norsk support, forståelse for lokale forhold

### 4.4 Markedstrender

**Positive trender:**
- ↗️ Økt digitalisering i landbruket
- ↗️ Yngre generasjon birøktere er teknologi-vante
- ↗️ Økte krav til dokumentasjon fra Mattilsynet
- ↗️ Voksende interesse for lokal mat og bærekraft

**Utfordringer:**
- Eldre birøktere kan være motvillige mot teknologi
- Lav betalingsvilje i hobbysegmentet
- Sesongbasert bruk (mest aktivitet april-september)

---

## 5. Brukerhistorier & Use Cases

### 5.1 Epics (Overordnede brukerhistorier)

1. **Felt-inspeksjoner**: Som birøkter vil jeg raskt registrere inspeksjoner mens jeg er i bigården
2. **Kubeadministrasjon**: Som birøkter vil jeg holde oversikt over alle mine kuber
3. **Behandlingsstyring**: Som birøkter vil jeg sikre at behandlinger følges opp og karenstider overholdes
4. **Produksjonsanalyse**: Som birøkter vil jeg forstå hvilke faktorer påvirker min honningproduksjon
5. **Dokumentasjon**: Som birøkter vil jeg enkelt generere rapporter for Mattilsynet

### 5.2 Detaljerte User Stories (MVP)

#### Epic 1: Felt-inspeksjoner

**US-001: Rask QR-scanning**
- **Som**: Birøkter i felt
- **Vil jeg**: Scanne QR-kode på kube
- **Slik at**: Jeg umiddelbart ser forrige inspeksjon og kan registrere ny

**Akseptansekriterier:**
- [ ] QR-scanner åpner med ett trykk fra hjem-skjermen
- [ ] Scanning tar <2 sekunder
- [ ] Forrige inspeksjon vises umiddelbart etter scanning
- [ ] Fungerer offline

**US-002: Enkel inspeksjonsregistrering**
- **Som**: Birøkter i felt
- **Vil jeg**: Fylle ut inspeksjonsskjema raskt med forhåndsutfylte verdier
- **Slik at**: Jeg bruker minimal tid per kube

**Akseptansekriterier:**
- [ ] Skjema forhåndsutfylt med forrige verdier
- [ ] Kan endre styrke med 3 tap (svak/middels/sterk)
- [ ] Kan registrere dronning sett med én checkbox
- [ ] Kan legge til foto med 1-2 trykk
- [ ] Lagring tar <1 sekund

**US-003: Værdata automatisk**
- **Som**: Birøkter
- **Vil jeg**: At værdata hentes automatisk
- **Slik at**: Jeg slipper å registrere temperatur og vind manuelt

**Akseptansekriterier:**
- [ ] Værdata hentes fra YR basert på GPS-lokasjon
- [ ] Temperatur, vind og værforhold vises i skjema
- [ ] Fungerer offline (siste kjente vær brukes)

#### Epic 2: Kubeadministrasjon

**US-004: Kubeoversikt**
- **Som**: Birøkter
- **Vil jeg**: Se alle mine kuber på ett sted
- **Slik at**: Jeg har full oversikt over driften

**Akseptansekriterier:**
- [ ] Liste eller grid-visning av alle kuber
- [ ] Statusindikator (frisk/advarsel/kritisk)
- [ ] Filtrering på bigård, status, styrke
- [ ] Sortering på siste inspeksjon, kubenummer, etc.
- [ ] Søk på kubenummer

**US-005: Kubedetaljer**
- **Som**: Birøkter
- **Vil jeg**: Se full historikk for en kube
- **Slik at**: Jeg kan følge utviklingen over tid

**Akseptansekriterier:**
- [ ] Timeline med alle inspeksjoner
- [ ] Graf over styrke/produksjon
- [ ] Alle bilder samlet
- [ ] Behandlings- og fôringshistorikk
- [ ] Dronninginformasjon synlig

#### Epic 3: Behandlingsstyring

**US-006: Registrere behandling**
- **Som**: Birøkter
- **Vil jeg**: Registrere varroabehandling med karenstid
- **Slik at**: Jeg vet når jeg kan høste honning igjen

**Akseptansekriterier:**
- [ ] Velg behandlingsprodukt fra liste
- [ ] Karenstid beregnes automatisk
- [ ] Varsel 7 dager før karenstid utløper
- [ ] Varsel hvis prøver å registrere høsting under karenstid

**US-007: Behandlingsoversikt**
- **Som**: Birøkter
- **Vil jeg**: Se alle pågående behandlinger
- **Slik at**: Jeg vet hvilke kuber som er under karenstid

**Akseptansekriterier:**
- [ ] Liste over aktive behandlinger
- [ ] Visuell indikator for dager igjen av karenstid
- [ ] Filtrering på behandlingstype
- [ ] Eksport til PDF

#### Epic 4: Produksjonsanalyse

**US-008: Dashboard med nøkkeltall**
- **Som**: Birøkter
- **Vil jeg**: Se mine viktigste tall på ett sted
- **Slik at**: Jeg raskt får oversikt over status

**Akseptansekriterier:**
- [ ] Totalt antall kuber og status
- [ ] Total honningproduksjon (inneværende år)
- [ ] Antall inspeksjoner dette året
- [ ] Kommende oppgaver/varsler
- [ ] Værmelding for neste 3 dager

**US-009: Produksjonsrapport**
- **Som**: Birøkter
- **Vil jeg**: Se produksjon per kube og bigård
- **Slik at**: Jeg kan identifisere mine beste kuber/lokasjoner

**Akseptansekriterier:**
- [ ] Tabell med produksjon per kube
- [ ] Graf over produksjon per måned
- [ ] Sammenligning år-over-år
- [ ] Eksport til CSV

#### Epic 5: Dokumentasjon

**US-010: Eksport for Mattilsynet**
- **Som**: Birøkter
- **Vil jeg**: Generere rapport over alle behandlinger
- **Slik at**: Jeg kan vise dette ved kontroll

**Akseptansekriterier:**
- [ ] PDF-rapport med logo
- [ ] Liste over alle behandlinger med dato og produkt
- [ ] Karenstider dokumentert
- [ ] Mulighet til å velge datoperiode
- [ ] Sendes på e-post eller deles direkte

---

### 5.3 Use Case Diagram

```
                    ┌─────────────────┐
                    │   Birøkter      │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    ┌─────▼─────┐     ┌──────▼──────┐    ┌─────▼──────┐
    │ Inspiser  │     │ Administrer │    │ Analyser   │
    │  kuber    │     │   kuber     │    │ produksjon │
    └───────────┘     └─────────────┘    └────────────┘
          │                  │                  │
    ┌─────┴─────┐      ┌─────┴─────┐      ┌─────┴──────┐
    │ Scan QR   │      │ Se oversikt│      │ Dashboard  │
    │ Registrer │      │ Legg til ny│      │ Rapporter  │
    │ Ta foto   │      │ Rediger    │      │ Eksporter  │
    └───────────┘      └───────────┘      └────────────┘
```

---

## 6. Funksjonelle Krav

### 6.1 MoSCoW Prioritering

#### MUST HAVE (MVP - Q2 2026)

**Mobil-app:**
- [x] Brukerregistrering og innlogging
- [x] QR-kode scanning
- [x] Inspeksjonsskjema med forhåndsutfylling
- [x] Fotodokumentasjon
- [x] Offline-modus med automatisk synkronisering
- [x] Værintegrasjon (YR.no)
- [x] Bigårdsvelger

**Web-plattform:**
- [x] Dashboard med oversikt
- [x] Kubeliste med filtrering
- [x] Kubedetaljer med historikk
- [x] Inspeksjonshistorikk (timeline)
- [x] Bigårdadministrasjon
- [x] Brukerinnstillinger

**Backend:**
- [x] REST API
- [x] JWT autentisering
- [x] PostgreSQL database
- [x] Fillagring (S3/R2)
- [x] Backup-rutiner

#### SHOULD HAVE (Post-MVP - Q3 2026)

**Mobil-app:**
- [ ] Behandlingsregistrering
- [ ] Fôringsregistrering
- [ ] Push-notifikasjoner
- [ ] Batch-inspeksjon (flere kuber raskt)
- [ ] Taleinnspilling av notater

**Web-plattform:**
- [ ] Behandlingsoversikt med karenstid
- [ ] Fôringslogg
- [ ] Produksjonsregistrering og -analyse
- [ ] Rapportgenerering (PDF)
- [ ] Søk i notater og historikk
- [ ] Statistikk og grafer

**Backend:**
- [ ] E-postvarsler
- [ ] Background jobs (påminnelser)
- [ ] Export API (CSV, PDF)

#### COULD HAVE (V2 - Q4 2026 / 2027)

**Avanserte funksjoner:**
- [ ] AI-basert bildekjennelse (varroa, sykdommer)
- [ ] Værvarsler med anbefalinger
- [ ] Samarbeidsverktøy (dele bigårder)
- [ ] Roller og tilgangsstyring
- [ ] Genetisk tracking (dronningelinjer)
- [ ] Integrasjon med Mattilsynet
- [ ] Salgsstyring (ordrer, kunder)
- [ ] Økonomisk rapportering

**Platform-utvidelser:**
- [ ] iPad-optimalisering
- [ ] Desktop-app (Electron)
- [ ] Apple Watch companion app

#### WON'T HAVE (Utenfor scope)

- ❌ IoT-sensorer i kuber (fremtidig produkt)
- ❌ E-handel plattform for salg av honning
- ❌ Community/forum for birøktere
- ❌ Booking-system for pollinering

---

### 6.2 Funksjonskategorier

#### 6.2.1 Autentisering & Brukeradministrasjon

| ID | Funksjon | Beskrivelse | Prioritet |
|----|----------|-------------|-----------|
| F-001 | Registrering | E-post + passord, navn | Must Have |
| F-002 | Innlogging | E-post + passord, JWT tokens | Must Have |
| F-003 | Glemt passord | E-post reset link | Should Have |
| F-004 | Profil | Rediger navn, telefon, avatar | Must Have |
| F-005 | Brukerpreferanser | Språk, enheter, notifikasjoner | Should Have |
| F-006 | To-faktor (2FA) | SMS eller TOTP | Could Have |

#### 6.2.2 Bigårdadministrasjon

| ID | Funksjon | Beskrivelse | Prioritet |
|----|----------|-------------|-----------|
| F-010 | Opprett bigård | Navn, lokasjon, type | Must Have |
| F-011 | Rediger bigård | Endre informasjon | Must Have |
| F-012 | Slett bigård | Soft delete med konfirmasjon | Must Have |
| F-013 | Kartvisning | Vis bigårder på kart | Should Have |
| F-014 | Sesongflytting | Marker bigård som sesong/lyngheiroute | Should Have |

#### 6.2.3 Kubeadministrasjon

| ID | Funksjon | Beskrivelse | Prioritet |
|----|----------|-------------|-----------|
| F-020 | Opprett kube | Nummer, type, dronninginfo | Must Have |
| F-021 | QR-kode generering | Automatisk QR per kube | Must Have |
| F-022 | Rediger kube | Oppdater informasjon | Must Have |
| F-023 | Flytt kube | Endre bigård | Should Have |
| F-024 | Marker som død/solgt | Endre status | Must Have |
| F-025 | Dronningbytte | Registrer ny dronning | Should Have |
| F-026 | Avleggere | Marker som avlegger/yngelkube | Should Have |

#### 6.2.4 Inspeksjoner

| ID | Funksjon | Beskrivelse | Prioritet |
|----|----------|-------------|-----------|
| F-030 | QR-scanning | Scan for å starte inspeksjon | Must Have |
| F-031 | Inspeksjonsskjema | Styrke, dronning, rammer, helse | Must Have |
| F-032 | Fotodokumentasjon | Ta og lagre bilder | Must Have |
| F-033 | Notater | Fritekst notater | Must Have |
| F-034 | Værdata | Auto-hent fra YR | Must Have |
| F-035 | Offline-inspeksjon | Lagre lokalt, sync senere | Must Have |
| F-036 | Rediger inspeksjon | Endre tidligere inspeksjon | Should Have |
| F-037 | Batch-inspeksjon | Inspiser flere raskt | Should Have |
| F-038 | Talenotater | Tale-til-tekst notater | Could Have |

#### 6.2.5 Behandling & Fôring

| ID | Funksjon | Beskrivelse | Prioritet |
|----|----------|-------------|-----------|
| F-040 | Registrer behandling | Produkt, dose, karenstid | Should Have |
| F-041 | Karenstid-påminnelse | Varsel når karenstid utløper | Should Have |
| F-042 | Behandlingsoversikt | Liste over aktive behandlinger | Should Have |
| F-043 | Registrer fôring | Type, mengde, årsak | Should Have |
| F-044 | Fôringshistorikk | Se tidligere fôringer | Should Have |

#### 6.2.6 Produksjon & Økonomi

| ID | Funksjon | Beskrivelse | Prioritet |
|----|----------|-------------|-----------|
| F-050 | Registrer høsting | Honning, voks, mengde | Should Have |
| F-051 | Produksjonsstatistikk | Per kube, bigård, sesong | Should Have |
| F-052 | Kvalitetsvurdering | Fuktighet, type honning | Could Have |
| F-053 | Prisregistrering | Pris per kg, totalt salg | Could Have |
| F-054 | Kostnadssporing | Fôr, behandling, utstyr | Could Have |

#### 6.2.7 Analyse & Rapporter

| ID | Funksjon | Beskrivelse | Prioritet |
|----|----------|-------------|-----------|
| F-060 | Dashboard | Oversikt med nøkkeltall | Must Have |
| F-061 | Kubeoversikt | Filtrerbar, sorterbar liste | Must Have |
| F-062 | Produksjonsrapport | PDF/CSV rapport | Should Have |
| F-063 | Behandlingsrapport | Mattilsynets krav | Should Have |
| F-064 | Trend-analyse | Grafer over tid | Could Have |
| F-065 | Sammenligning | Kube vs kube, år vs år | Could Have |

---

## 7. Ikke-funksjonelle Krav

### 7.1 Ytelse

| Krav | Målverdi | Kritisk? |
|------|----------|----------|
| **API Response Time (p95)** | < 200ms | Ja |
| **Mobilapp Launch Time** | < 2s | Ja |
| **QR Scan til Skjema** | < 2s | Ja |
| **Inspeksjon Lagring** | < 1s | Ja |
| **Bilde Upload** | < 3s | Nei |
| **Dashboard Load Time** | < 1s | Nei |
| **Offline Sync** | < 30s ved 50 inspeksjoner | Nei |

### 7.2 Skalerbarhet

- Støtte **10,000 aktive brukere** uten ytelsesdegradelse
- Støtte **500,000 kuber** i systemet
- Støtte **10M inspeksjoner** per år
- Støtte **5M bilder** i storage

### 7.3 Tilgjengelighet

- **99.5% uptime** (≈ 3.6 timer nedetid per måned)
- **Backup hver 24 timer** med 30 dagers retention
- **Disaster recovery** innen 4 timer

### 7.4 Sikkerhet

- **Kryptert dataoverføring** (TLS 1.3)
- **Passord-hashing** (bcrypt, cost factor ≥12)
- **Rate limiting** på API endpoints
- **GDPR-compliant** (norsk lovverk)
- **SQL injection** og XSS beskyttelse
- **Penetrasjonstest** årlig

### 7.5 Brukervennlighet

- **Læringskurve** < 15 minutter for grunnleggende bruk
- **Mobil-app size** < 50 MB
- **SUS Score** (System Usability Scale) > 70
- **Støtte for synshemmede** (WCAG 2.1 AA)

### 7.6 Kompatibilitet

**Mobil:**
- iOS 14.0+ (iPhone 8 og nyere)
- Android 10+ (API level 29+)

**Web:**
- Chrome 90+
- Safari 14+
- Firefox 88+
- Edge 90+

**Nettbrett:**
- iPad (7. gen og nyere)
- Android-nettbrett 10"+ (2020 og nyere)

### 7.7 Lokalisering

- **Språk**: Norsk (bokmål)
- **Dato/tid**: Norsk format (dd.mm.yyyy, 24-timers)
- **Enheter**: Metrisk (kg, °C, m/s)
- **Valuta**: NOK (kr)
- **Værdata**: YR.no (Meteorologisk institutt)

### 7.8 Pålitelighet

- **Data consistency**: Eventually consistent (offline → online sync)
- **Error rate**: < 0.1% av API requests
- **Crash-free rate**: > 99.9% av app-sessions

---

## 8. UX-krav & Designprinsipper

### 8.1 Designfilosofi

**"Raskt, enkelt, pålitelig"**

Birøkt skal føles som en naturlig forlengelse av birøkterens arbeidsflyt, ikke en hindring. Designet skal være:

1. **Minimalistisk**: Kun essensielt synlig, alt annet gjemt
2. **Intuitivt**: Funksjoner der du forventer dem
3. **Konsistent**: Samme interaksjoner overalt
4. **Responsivt**: Øyeblikkelig feedback på handlinger

### 8.2 Designprinsipper

#### 1. Feltoptimalisert (Mobil)

Mobil-appen er designet for bruk i bigården hvor:
- Hendene kan være beskitne eller ha hansker på
- Sola skinner sterkt (høy kontrast nødvendig)
- Tid er begrenset (rask navigasjon)
- Nettverkstilgang kan være fraværende

**Design-implikasjoner:**
- Store touch-targets (minimum 44x44 pt)
- Høy kontrast UI
- Minimal skriving (taps og sveip foretrekkes)
- Forhåndsutfylte verdier
- Offline-first

#### 2. Data-tett (Web)

Web-plattformen er for dyptgående analyse hvor:
- Brukeren sitter ved skrivebord
- God tid til å utforske data
- Større skjerm gir plass til kompleksitet

**Design-implikasjoner:**
- Dashboard med flere widgets
- Grafer og visualiseringer
- Tabeller med sortering/filtrering
- Sidepaneler med detaljer

#### 3. Progressiv Avsløring

Ikke overveld brukeren med alle funksjoner samtidig.

**Eksempel:**
- **Nivå 1**: Scan QR → Se forrige inspeksjon
- **Nivå 2**: Tap "Ny inspeksjon" → Enkel form
- **Nivå 3**: Tap "Avansert" → Flere felt
- **Nivå 4**: Tap "Historikk" → Full timeline

#### 4. Feiltoleranse

Systemet skal være tilgivende og hjelpe brukeren unngå feil.

**Eksempler:**
- Advarsel hvis registrerer høsting under karenstid
- Konfirmere før sletting av kube
- Auto-lagre utkast hver 30 sekund
- "Undo" på viktige operasjoner

### 8.3 Fargepalett

**Primære farger:**
- **Primær**: `#F59E0B` (Amber 500 - honninggul)
- **Sekundær**: `#3B82F6` (Blue 500)
- **Aksent**: `#10B981` (Green 500)

**Semantiske farger:**
- **Suksess**: `#10B981` (Grønn)
- **Advarsel**: `#F59E0B` (Gul)
- **Feil/Kritisk**: `#EF4444` (Rød)
- **Info**: `#3B82F6` (Blå)

**Nøytrale:**
- **Tekst**: `#111827` (Gray 900)
- **Bakgrunn**: `#F9FAFB` (Gray 50)
- **Border**: `#E5E7EB` (Gray 200)

**Helsestatusindikatorer:**
- 🟢 **Frisk**: Grønn
- 🟡 **Følg opp**: Gul
- 🔴 **Kritisk**: Rød

### 8.4 Typografi

**Font-familie:**
- **Primær**: Inter (sans-serif)
- **Monospace**: JetBrains Mono (for kode/ID-er)

**Font-størrelser (mobil):**
- **H1**: 28px (bold) - Overskrifter
- **H2**: 22px (semibold) - Seksjoner
- **H3**: 18px (semibold) - Underseksjoner
- **Body**: 16px (regular) - Brødtekst
- **Small**: 14px (regular) - Metadata
- **Tiny**: 12px (regular) - Timestamps

### 8.5 Ikoner

Bruk **Lucide Icons** for konsistens:
- 🏠 Hjem / Dashboard
- 🔍 Inspeksjon
- 📷 Kamera / Foto
- 📊 Statistikk / Analyse
- ⚙️ Innstillinger
- 🐝 Bikube (kun for branding)

### 8.6 Key Screens - Mobil

**1. Hjem (Bigårdsvelger):**
- Kort for hver bigård med nøkkeltall
- "Scan QR" knapp prominent plassert
- Værmelding øverst

**2. QR-scanner:**
- Fullskjerm kamera
- Ramme som viser scan-område
- Instruksjoner nederst
- "Avbryt" knapp

**3. Inspeksjonsskjema:**
- Seksjonsdelt (vær → vurdering → rammer → helse)
- Scroll vertikalt
- "Lagre" knapp sticky nederst
- "Avbryt" øverst til venstre

**4. Kubedetaljer:**
- Header med kubenummer og status
- Tabs: Inspeksjoner, Bilder, Behandlinger
- Timeline for inspeksjoner

### 8.7 Key Screens - Web

**1. Dashboard:**
- 4 KPI-kort øverst (kuber, produksjon, inspeksjoner, varsler)
- Siste inspeksjoner (liste)
- Kommende oppgaver (sidebar)
- Værmelding (sidebar)

**2. Kubeoversikt:**
- Grid-visning av kubekort
- Filtrer/søk i header
- Fargekodet status
- Klikk for detaljer

**3. Kubedetaljer:**
- Header med info
- Tabs for ulike visninger
- Timeline med inspeksjoner
- Sidebar med statistikk

### 8.8 Interaksjonsdesign

**Mobil gestures:**
- **Tap**: Primær handling
- **Swipe left/right**: Navigere mellom tabs
- **Pull to refresh**: Oppdater data
- **Long press**: Kontekstmeny (delingsalternativer)

**Feedback:**
- **Haptic**: På viktige handlinger (lagring, scanning)
- **Visual**: Spinner ved lasting
- **Audio**: Beep ved suksessfull QR-scan

### 8.9 Tilgjengelighet (A11y)

- **Kontrast**: Minimum 4.5:1 for normal tekst
- **Touch targets**: Minimum 44x44 pt
- **Screen readers**: Semantiske HTML-tagger
- **Keyboard navigation**: Tab-rekkefølge logisk
- **Fargeblindhet**: Ikke kun fargebaserte indikatorer (bruk ikoner)

---

## 9. Suksessmålinger

### 9.1 North Star Metric

**Antall inspeksjoner registrert per måned**

Dette er kjernen i produktverdien - jo flere inspeksjoner som registreres digitalt, desto mer verdi får brukeren.

**Mål:**
- **Måned 3**: 500 inspeksjoner/måned
- **Måned 6**: 2,000 inspeksjoner/måned
- **Måned 12**: 10,000 inspeksjoner/måned

### 9.2 KPIs (Key Performance Indicators)

#### Produktengasjement

| Metric | Definisjon | Mål (Måned 12) |
|--------|-----------|----------------|
| **DAU** (Daily Active Users) | Unike brukere per dag | 200 |
| **MAU** (Monthly Active Users) | Unike brukere per måned | 500 |
| **Inspeksjoner per bruker** | Gjennomsnitt per måned | 20 |
| **Retention (D1)** | Bruker kommer tilbake dag 2 | > 40% |
| **Retention (D7)** | Bruker aktiv etter 7 dager | > 25% |
| **Retention (D30)** | Bruker aktiv etter 30 dager | > 15% |

#### Brukervennlighet

| Metric | Definisjon | Mål |
|--------|-----------|-----|
| **Time to First Inspection** | Tid fra registrering til første inspeksjon | < 10 min |
| **Inspection Completion Rate** | % av påbegynte inspeksjoner som fullføres | > 90% |
| **SUS Score** | System Usability Scale | > 70 |
| **NPS** | Net Promoter Score | > 50 |
| **App Store Rating** | Gjennomsnitt (iOS + Android) | > 4.5 ⭐ |

#### Teknisk Ytelse

| Metric | Definisjon | Mål |
|--------|-----------|-----|
| **API Uptime** | % tilgjengelig per måned | > 99.5% |
| **App Crash Rate** | % sessions med crash | < 0.1% |
| **Offline Sync Success** | % vellykket synkronisering | > 99% |
| **QR Scan Success Rate** | % skanninger som registreres | > 95% |

#### Forretning

| Metric | Definisjon | Mål (År 1) |
|--------|-----------|------------|
| **Betalende brukere** | Antall aktive abonnenter | 500 |
| **MRR** (Monthly Recurring Revenue) | Månedlig inntekt | 150,000 kr |
| **ARR** (Annual Recurring Revenue) | Årlig inntekt | 1,800,000 kr |
| **CAC** (Customer Acquisition Cost) | Kostnad per ny kunde | < 500 kr |
| **LTV** (Lifetime Value) | Verdi per kunde over levetid | > 5,000 kr |
| **LTV:CAC Ratio** | LTV delt på CAC | > 10:1 |
| **Churn Rate** | % kunder som slutter per måned | < 5% |

### 9.3 Målingsverktøy

**Analytics:**
- **Plausible Analytics** (privacy-friendly) for web
- **PostHog** for produkt-analytics (events, funnels, cohorts)
- **Sentry** for error tracking

**Brukerundersøkelser:**
- **In-app surveys** (quarterly NPS + feedback)
- **Brukerintervjuer** (5-10 brukere per kvartal)
- **Usability testing** (før større releases)

### 9.4 Suksesskriterier per Fase

**MVP (Måned 3):**
- ✅ 50 beta-testere aktive
- ✅ 500 inspeksjoner registrert
- ✅ NPS > 30
- ✅ < 10 kritiske bugs rapportert

**Post-MVP (Måned 6):**
- ✅ 200 betalende kunder
- ✅ 2,000 inspeksjoner/måned
- ✅ NPS > 40
- ✅ App Store rating > 4.0

**V2 (Måned 12):**
- ✅ 500 betalende kunder
- ✅ 10,000 inspeksjoner/måned
- ✅ NPS > 50
- ✅ App Store rating > 4.5

---

## 10. Roadmap & Faser

### 10.1 Tidslinje Oversikt

```
Q1 2026          Q2 2026         Q3 2026         Q4 2026         2027
│                │               │               │               │
├─ Planning      ├─ MVP Launch   ├─ Post-MVP     ├─ V2.0        ├─ Expansion
│  & Design      │  (Beta)       │  Features     │  Launch       │  & Scale
│                │               │               │               │
└────────────────┴───────────────┴───────────────┴───────────────┴──────
    3 måneder        3 måneder       3 måneder       3 måneder      ...
```

---

### 10.2 Fase 1: Foundation (Jan-Mar 2026)

**Mål**: Bygge grunnlag for MVP

**Aktiviteter:**
- ✅ PRD og teknisk arkitektur ferdigstilles
- [ ] Design mockups og wireframes (finpuss)
- [ ] Sette opp utviklingsmiljø og infrastruktur
- [ ] Backend API (autentisering, database, core endpoints)
- [ ] Mobil-app MVP (QR-scanning, inspeksjon)
- [ ] Web dashboard (grunnleggende visning)
- [ ] Alpha testing internt (5-10 personer)

**Leveranser:**
- Fungerende autentisering
- Grunnleggende inspeksjonsregistrering
- Offline-funksjonalitet mobil
- Database med seed-data

**Team:**
- 1 Full-stack utvikler (backend + web)
- 1 Mobil-utvikler (React Native)
- 1 Designer (UX/UI)
- 1 Produkteier (Lars)

---

### 10.3 Fase 2: MVP Beta Launch (Apr-Jun 2026)

**Mål**: Lansere MVP til 50 beta-testere

**Funksjonalitet:**

**Mobil:**
- [x] Brukerregistrering og innlogging
- [x] QR-kode scanning
- [x] Inspeksjonsskjema (styrke, dronning, rammer, helse)
- [x] Fotodokumentasjon
- [x] Offline-modus med synkronisering
- [x] Værintegrasjon (YR.no)
- [x] Bigårdsvelger

**Web:**
- [x] Dashboard med nøkkeltall
- [x] Kubeoversikt (liste/grid)
- [x] Kubedetaljer med historikk
- [x] Inspeksjonshistorikk
- [x] Bigårdadministrasjon

**Backend:**
- [x] REST API (auth, apiaries, hives, inspections, photos)
- [x] PostgreSQL database
- [x] S3 fillagring
- [x] Backup-rutiner

**Aktiviteter:**
- [ ] Rekruttere 50 beta-testere (birøkterlag, Facebook-grupper)
- [ ] Onboarding-flow og e-post
- [ ] Ukentlig brukerundersøkelser
- [ ] Bug-fixing og iterering basert på feedback
- [ ] Dokumentasjon og FAQ

**Suksesskriterier:**
- 50 aktive beta-testere
- 500+ inspeksjoner registrert
- NPS > 30
- < 10 kritiske bugs

**Marketing:**
- Landingsside (birokt.no)
- Facebook-gruppe for beta-testere
- E-postliste for interesserte

---

### 10.4 Fase 3: Post-MVP Features (Jul-Sep 2026)

**Mål**: Utvide funksjonalitet og forberede for betalt lansering

**Nye funksjoner:**

**Mobil:**
- [ ] Behandlingsregistrering
- [ ] Fôringsregistrering
- [ ] Push-notifikasjoner (påminnelser)
- [ ] Batch-inspeksjon (rask-modus)
- [ ] Forbedret bildegalleri

**Web:**
- [ ] Behandlingsoversikt med karenstid
- [ ] Fôringslogg
- [ ] Produksjonsregistrering
- [ ] Rapportgenerering (PDF for Mattilsynet)
- [ ] Statistikk og grafer
- [ ] Eksport til CSV

**Backend:**
- [ ] E-postvarsler
- [ ] Background jobs (påminnelser, rapporter)
- [ ] Improved caching (Redis)

**Aktiviteter:**
- [ ] Utvide beta-programmet til 200 brukere
- [ ] Implementere betalingsløsning (Stripe/Vipps)
- [ ] Forberede App Store og Play Store lansering
- [ ] Oppdatere markedsføringsmateriell
- [ ] Skrive hjelpeartikler og video-tutorials

**Suksesskriterier:**
- 200 beta-testere
- 2,000+ inspeksjoner/måned
- NPS > 40
- < 5 kritiske bugs

---

### 10.5 Fase 4: V2.0 Public Launch (Oct-Dec 2026)

**Mål**: Offentlig lansering med betalt abonnement

**Nye funksjoner:**

**Avanserte analyser:**
- [ ] Trend-analyse (styrke over tid, produksjon)
- [ ] Sammenligning (kube vs kube, år vs år)
- [ ] Prediktiv modellering (estimert produksjon)

**Samarbeid:**
- [ ] Dele bigårder med medarbeidere
- [ ] Kommentarer på inspeksjoner
- [ ] Roller og tilgangsstyring

**Integrasjoner:**
- [ ] Værvarsler med anbefalinger
- [ ] Eksport til Google Drive / Dropbox

**Polish:**
- [ ] Onboarding-guide for nye brukere
- [ ] Tooltips og kontekstuell hjælp
- [ ] Ytelsesoptimalisering

**Aktiviteter:**
- [ ] Offentlig lansering (bloggpost, pressemeldinger)
- [ ] App Store & Play Store submit
- [ ] Markedsføringskampanje (Facebook Ads, Google Ads)
- [ ] Partnere med Norges Birøkterlag
- [ ] Presentere på birøkterkonferanse

**Prising:**
- **Gratis tier**: 1-5 kuber, begrenset funksjonalitet
- **Pro tier**: 299 kr/måned, ubegrenset kuber
- **Enterprise**: Tilpasset pris for 100+ kuber

**Suksesskriterier:**
- 500 betalende kunder
- 10,000 inspeksjoner/måned
- NPS > 50
- App Store rating > 4.5
- MRR: 150,000 kr

---

### 10.6 Fase 5: Expansion & Scale (2027+)

**Mål**: Skalere til 2000+ brukere og ekspandere til Norden

**Nye markeder:**
- Sverige (Q1 2027)
- Danmark (Q2 2027)
- Finland (Q3 2027)

**Nye funksjoner:**
- [ ] AI-basert bildekjennelse (varroa, sykdommer)
- [ ] Genetisk tracking (dronningelinjer, avl)
- [ ] Økonomisk rapportering (P&L, kostnadsanalyse)
- [ ] Salgsstyring (ordrer, kunder, fakturering)
- [ ] IoT-integrasjon (sensorer i kuber)

**Plattformutvidelser:**
- [ ] iPad-optimalisert versjon
- [ ] Desktop-app (macOS, Windows)

**Business Development:**
- [ ] Partnership med utstyrsleverandører
- [ ] Integrasjon med Mattilsynet (Norge/Norden)
- [ ] B2B løsninger for kommersielle aktører

**Suksesskriterier (EOY 2027):**
- 2,000 betalende kunder
- 50,000 inspeksjoner/måned
- ARR: 7,200,000 kr
- Tilstedeværelse i 4 nordiske land

---

## 11. Risiko & Mitigering

### 11.1 Produktrisiko

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| **Lav adopsjon blant målgruppe** | Middels | Høy | - Beta-testing med reelle brukere<br>- Kontinuerlig bruker-feedback<br>- Enkel onboarding |
| **Kompleks UX skremmer brukere** | Middels | Høy | - Usability testing<br>- Progressiv avsløring<br>- Video-tutorials |
| **Mangel på produktmarked-fit** | Lav | Høy | - Validere problemstilling med intervjuer<br>- MVP med kun kjerne-funksjoner<br>- Iterer raskt basert på data |
| **Feature creep (scope creep)** | Høy | Middels | - Streng MoSCoW-prioritering<br>- Produkteier godkjenner alle features<br>- Fokus på MVP først |

### 11.2 Teknisk Risiko

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| **Offline-sync konflikter** | Middels | Høy | - Grundig testing av konfliktløsning<br>- Last-write-wins strategi<br>- Brukerveiledning for konflikter |
| **Database ytelse ved skala** | Lav | Middels | - Indeksering fra start<br>- Read replicas for analytics<br>- Caching (Redis) |
| **Mobilapp crashes** | Middels | Høy | - Extensive testing på ekte enheter<br>- Sentry error tracking<br>- Beta-fase for stabilisering |
| **Tap av data** | Lav | Kritisk | - Daglige backups<br>- Redundante databaser<br>- Point-in-time recovery |

### 11.3 Forretningsrisiko

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| **Lav betalingsvilje** | Middels | Høy | - Freemium-modell for å tiltrekke brukere<br>- Demonstrer ROI tidlig<br>- Fleksible prisplaner |
| **Sesongbasert bruk** | Høy | Middels | - Årlig abonnement istedenfor månedlig<br>- Verdiskapende funksjoner for vinter (analyse, planlegging) |
| **Konkurrent lanserer lignende** | Lav | Middels | - First-mover advantage<br>- Bygge community<br>- Kontinuerlig innovasjon |
| **Regulatoriske endringer** | Lav | Middels | - Følge med på Mattilsynets krav<br>- Fleksibel arkitektur for endringer |

### 11.4 Operasjonell Risiko

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| **Nøkkelperson avhengighet** | Middels | Høy | - Dokumentere alt<br>- Cross-training<br>- Backup-utviklere |
| **Infrastruktur-nedetid** | Lav | Høy | - Multi-region deployment<br>- Monitoring & alerts<br>- Incident response plan |
| **Support-kapasitet** | Høy | Middels | - Omfattende FAQ og dokumentasjon<br>- Chatbot for vanlige spørsmål<br>- Community-forum |

---

## 12. Avhengigheter & Begrensninger

### 12.1 Eksterne Avhengigheter

| Avhengighet | Beskrivelse | Alternativ |
|-------------|-------------|------------|
| **YR.no API** | Værdata for automatisk logging | Met.no API, OpenWeatherMap |
| **Expo / React Native** | Mobil-utviklingsplattform | Flutter, Native iOS/Android |
| **PostgreSQL** | Database | MySQL, MongoDB |
| **Stripe/Vipps** | Betalingsløsning | Klarna, Paypal |
| **Cloudflare R2/AWS S3** | Fillagring | MinIO (self-hosted), Google Cloud Storage |

### 12.2 Interne Avhengigheter

- **Team-kapasitet**: 2-3 utviklere for MVP
- **Budget**: Estimert 500,000 kr for MVP (utvikling + infrastruktur)
- **Tid**: 6 måneder til beta-lansering

### 12.3 Begrensninger

**Tekniske:**
- React Native begrensninger (native features krever plugins)
- Offline sync-kompleksitet (konflikter)
- Mobilapp størrelse (<50 MB ønsket)

**Forretning:**
- Begrenset marketing-budsjett i oppstartsfase
- Avhengig av organisk vekst (word-of-mouth, birøkterlag)
- Sesongbasert bruk (lavere aktivitet oktober-mars)

**Marked:**
- Norsk marked er lite (4,850 potensielle brukere)
- Må ekspandere til Norden for vekst
- Eldre birøktere kan være skeptiske til teknologi

---

## 13. Vedlegg

### 13.1 Relaterte Dokumenter

- [Teknisk Arkitektur](./teknisk-arkitektur.md)
- [API Spesifikasjon (OpenAPI)](./openapi-spec.yaml)
- [Database Schema](./001_initial_schema.sql)
- [Wireframes & Mockups](./birokt-wireframes.html)
- [Setup Guide](./SETUP.md)

### 13.2 Referanser

**Konkurrenter:**
- Hive Tracks: https://www.hivetracks.com
- BeeKeeper: https://beekeeper.cloud
- Apiary Book: https://apiarybook.com

**Inspirasjon:**
- Agrello (norsk landbrukssoftware)
- Farmable (dansk landbruksstyring)

**Ressurser:**
- Norges Birøkterlag: https://www.norbi.no
- Mattilsynet (birøkt): https://www.mattilsynet.no

### 13.3 Ordliste

| Term | Definisjon |
|------|------------|
| **Bigård** | Lokasjon hvor kuber står (apiary) |
| **Kube** | Bikube (hive) |
| **Inspeksjon** | Gjennomgang av en kube (inspection) |
| **Dronning** | Bidronning (queen bee) |
| **Yngel** | Bilarver og egg (brood) |
| **Honningrom** | Øverste boks for honningproduksjon (honey super) |
| **Karenstid** | Tidsperiode etter behandling hvor honning ikke kan høstes (withholding period) |
| **Avlegger** | Liten koloni / startkoloni (nucleus / nuc) |
| **Varroa** | Parasittmidd som angriper bier (varroa mite) |

### 13.4 Godkjenning

**Produkteier:** Lars Johansen  
**Signatur:** ________________  
**Dato:** 31. januar 2026

**Teknisk Lead:** [Navn]  
**Signatur:** ________________  
**Dato:** _____

**Designlead:** [Navn]  
**Signatur:** ________________  
**Dato:** _____

---

## Dokumenthistorikk

| Versjon | Dato | Forfatter | Endringer |
|---------|------|-----------|-----------|
| 1.0 | 31.01.2026 | Lars Johansen | Initial draft - komplett PRD |
| 0.9 | 30.01.2026 | Lars Johansen | Wireframes & Teknisk arkitektur |

---

**Kontakt:**  
Lars Johansen  
E-post: lars@birokt.no  
Telefon: +47 XXX XX XXX

---

*Dette dokumentet er konfidensielt og inneholder proprietær informasjon om Birøkt-systemet. Ikke distribuer uten tillatelse.*
