# Spesifikasjon: Dronningproduksjon og avlshåndtering

> Versjon: 1.0
> Dato: 2026-02-07
> Status: Forslag

---

## 1. Bakgrunn og mål

Mange birøktere driver aktiv dronningproduksjon — enten for eget bruk eller for salg. Dagens system registrerer kun grunnleggende dronninginfo (år, farge, rase) per kube, men mangler støtte for:

- Sporing av dronninglinjer og morlinjer over generasjoner
- Produksjonsplanlegging (podning, parring, evaluering)
- Historikk over dronningbytter per kube
- Salg og distribusjon av dronninger

### Mål

- Gi birøktere full oversikt over avlsarbeidet
- Spore genetikk og ytelse over generasjoner
- Forenkle dronningproduksjons-logistikken
- Integrere sømløst med eksisterende inspeksjon- og kubedata

---

## 2. Datamodell

### 2.1 Queen (Dronning)

Sentral entitet som representerer én enkelt dronning gjennom hele livsløpet.

```
Queen
├── id                  UUID
├── queenCode           String        # Unik kode, f.eks. "B24-042"
├── year                Int           # Klekkeår
├── race                String?       # buckfast, carnica, ligustica, nordisk, etc.
├── color               String?       # Merkefarge (white, yellow, red, green, blue)
├── marked              Boolean       # Om dronningen er merket
├── clipped             Boolean       # Om vingene er klippet
├── origin              Enum          # own_production, purchased, swarm, unknown
├── status              Enum          # virgin, mated, laying, failed, dead, sold
├── statusDate          DateTime      # Dato for siste statusendring
│
├── motherId            UUID?         # FK → Queen (mor-dronning)
├── fatherColonyId      UUID?         # FK → Hive (faderkube for parring)
│
├── graftDate           DateTime?     # Dato for podning
├── graftSourceHiveId   UUID?         # FK → Hive (larvekilde)
├── graftBatchId        UUID?         # FK → GraftBatch
├── matingDate          DateTime?     # Dato for parring/parringstur
├── matingStation       String?       # Parringsstasjon / parringssted
├── layingConfirmedDate DateTime?     # Dato egg først observert
│
├── currentHiveId       UUID?         # FK → Hive (nåværende kube)
├── introducedDate      DateTime?     # Dato satt inn i kube
│
├── rating              Int?          # Helhetsvurdering 1-5
├── temperament         String?       # calm, nervous, aggressive
├── productivity        String?       # low, medium, high
├── hygienic            Boolean?      # Hygienisk adferd observert
├── swarmTendency       String?       # low, medium, high
├── overwintering       String?       # poor, fair, good, excellent
│
├── notes               String?
├── userId              UUID          # Eier
├── createdAt           DateTime
├── updatedAt           DateTime
│
├── daughters           Queen[]       # Inverse relasjon
├── hiveHistory         QueenHiveLog[]
├── evaluations         QueenEvaluation[]
└── buyer               QueenSale?
```

### 2.2 GraftBatch (Podningsserie)

Grupperer dronninger som er podet fra samme kilde i samme omgang.

```
GraftBatch
├── id                  UUID
├── batchCode           String        # F.eks. "P2026-03"
├── graftDate           DateTime      # Dato for podning
├── sourceHiveId        UUID          # FK → Hive (larvekilde)
├── sourceQueenId       UUID?         # FK → Queen (mor-dronning)
├── numberOfCells       Int           # Antall celler podet
├── cellsAccepted       Int?          # Antall akseptert
├── cellsCapped         Int?          # Antall forseglede celler
├── queensEmerged       Int?          # Antall klekket
├── queensMated         Int?          # Antall vellykket paret
├── method              String?       # nicot, jenter, grafting, miller, etc.
├── notes               String?
├── userId              UUID
├── createdAt           DateTime
│
└── queens              Queen[]       # Dronninger fra denne serien
```

### 2.3 QueenHiveLog (Dronning-kube-historikk)

Logger hver gang en dronning flyttes inn/ut av en kube.

```
QueenHiveLog
├── id                  UUID
├── queenId             UUID          # FK → Queen
├── hiveId              UUID          # FK → Hive
├── action              Enum          # introduced, removed, died, sold, swarmed
├── date                DateTime
├── reason              String?       # Årsak til bytte
├── notes               String?
├── userId              UUID
├── createdAt           DateTime
```

### 2.4 QueenEvaluation (Dronningevaluering)

Strukturert evaluering av dronningens egenskaper over tid.

```
QueenEvaluation
├── id                  UUID
├── queenId             UUID          # FK → Queen
├── evaluationDate      DateTime
├── season              String        # spring, summer, autumn
│
├── temperament         Int           # 1-5 (1=aggressiv, 5=svært rolig)
├── productivity        Int           # 1-5 (1=svak, 5=eksepsjonell)
├── broodPattern        Int           # 1-5 (kompakthet av yngelleie)
├── hygienic            Int           # 1-5 (hygienisk adferd)
├── swarmTendency       Int           # 1-5 (1=sverm-villig, 5=sverm-treg)
├── overwintering       Int?          # 1-5 (kun etter vinter)
├── honeyProduction     Float?        # kg honning denne sesongen
├── diseaseResistance   Int?          # 1-5
│
├── overallRating       Int           # 1-5 beregnet snitt
├── keepForBreeding     Boolean       # Anbefalt som avlsmor?
├── notes               String?
├── userId              UUID
├── createdAt           DateTime
```

### 2.5 QueenSale (Dronningsalg)

For birøktere som selger dronninger.

```
QueenSale
├── id                  UUID
├── queenId             UUID          # FK → Queen
├── saleDate            DateTime
├── buyerName           String
├── buyerContact        String?       # Telefon/e-post
├── price               Float?
├── currency            String        # NOK default
├── shippingMethod      String?       # pickup, post, delivery
├── notes               String?
├── userId              UUID
├── createdAt           DateTime
```

---

## 3. Prisma-skjema (tillegg)

```prisma
model Queen {
  id                  String    @id @default(uuid())
  queenCode           String    @map("queen_code")
  year                Int
  race                String?
  color               String?
  marked              Boolean   @default(false)
  clipped             Boolean   @default(false)
  origin              String    @default("own_production")  // own_production, purchased, swarm, unknown
  status              String    @default("virgin")          // virgin, mated, laying, failed, dead, sold
  statusDate          DateTime  @default(now()) @map("status_date")

  motherId            String?   @map("mother_id")
  fatherColonyId      String?   @map("father_colony_id")

  graftDate           DateTime? @map("graft_date")
  graftSourceHiveId   String?   @map("graft_source_hive_id")
  graftBatchId        String?   @map("graft_batch_id")
  matingDate          DateTime? @map("mating_date")
  matingStation       String?   @map("mating_station")
  layingConfirmedDate DateTime? @map("laying_confirmed_date")

  currentHiveId       String?   @map("current_hive_id")
  introducedDate      DateTime? @map("introduced_date")

  rating              Int?
  temperament         String?
  productivity        String?
  hygienic            Boolean?
  swarmTendency       String?   @map("swarm_tendency")
  overwintering       String?

  notes               String?
  userId              String    @map("user_id")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  // Relations
  mother              Queen?          @relation("QueenLineage", fields: [motherId], references: [id])
  daughters           Queen[]         @relation("QueenLineage")
  fatherColony        Hive?           @relation("FatherColony", fields: [fatherColonyId], references: [id])
  graftSourceHive     Hive?           @relation("GraftSource", fields: [graftSourceHiveId], references: [id])
  graftBatch          GraftBatch?     @relation(fields: [graftBatchId], references: [id])
  currentHive         Hive?           @relation("CurrentQueen", fields: [currentHiveId], references: [id])
  user                User            @relation(fields: [userId], references: [id])
  hiveHistory         QueenHiveLog[]
  evaluations         QueenEvaluation[]
  sale                QueenSale?

  @@map("queens")
}

model GraftBatch {
  id              String    @id @default(uuid())
  batchCode       String    @map("batch_code")
  graftDate       DateTime  @map("graft_date")
  sourceHiveId    String    @map("source_hive_id")
  sourceQueenId   String?   @map("source_queen_id")
  numberOfCells   Int       @map("number_of_cells")
  cellsAccepted   Int?      @map("cells_accepted")
  cellsCapped     Int?      @map("cells_capped")
  queensEmerged   Int?      @map("queens_emerged")
  queensMated     Int?      @map("queens_mated")
  method          String?
  notes           String?
  userId          String    @map("user_id")
  createdAt       DateTime  @default(now()) @map("created_at")

  // Relations
  sourceHive      Hive      @relation(fields: [sourceHiveId], references: [id])
  sourceQueen     Queen?    @relation("BatchSourceQueen", fields: [sourceQueenId], references: [id])
  user            User      @relation(fields: [userId], references: [id])
  queens          Queen[]

  @@map("graft_batches")
}

model QueenHiveLog {
  id        String    @id @default(uuid())
  queenId   String    @map("queen_id")
  hiveId    String    @map("hive_id")
  action    String    // introduced, removed, died, sold, swarmed
  date      DateTime
  reason    String?
  notes     String?
  userId    String    @map("user_id")
  createdAt DateTime  @default(now()) @map("created_at")

  // Relations
  queen     Queen     @relation(fields: [queenId], references: [id], onDelete: Cascade)
  hive      Hive      @relation(fields: [hiveId], references: [id])
  user      User      @relation(fields: [userId], references: [id])

  @@map("queen_hive_logs")
}

model QueenEvaluation {
  id                String    @id @default(uuid())
  queenId           String    @map("queen_id")
  evaluationDate    DateTime  @map("evaluation_date")
  season            String

  temperament       Int
  productivity      Int
  broodPattern      Int       @map("brood_pattern")
  hygienic          Int
  swarmTendency     Int       @map("swarm_tendency")
  overwintering     Int?
  honeyProduction   Float?    @map("honey_production")
  diseaseResistance Int?      @map("disease_resistance")

  overallRating     Int       @map("overall_rating")
  keepForBreeding   Boolean   @default(false) @map("keep_for_breeding")
  notes             String?
  userId            String    @map("user_id")
  createdAt         DateTime  @default(now()) @map("created_at")

  // Relations
  queen             Queen     @relation(fields: [queenId], references: [id], onDelete: Cascade)
  user              User      @relation(fields: [userId], references: [id])

  @@map("queen_evaluations")
}

model QueenSale {
  id              String    @id @default(uuid())
  queenId         String    @unique @map("queen_id")
  saleDate        DateTime  @map("sale_date")
  buyerName       String    @map("buyer_name")
  buyerContact    String?   @map("buyer_contact")
  price           Float?
  currency        String    @default("NOK")
  shippingMethod  String?   @map("shipping_method")
  notes           String?
  userId          String    @map("user_id")
  createdAt       DateTime  @default(now()) @map("created_at")

  // Relations
  queen           Queen     @relation(fields: [queenId], references: [id])
  user            User      @relation(fields: [userId], references: [id])

  @@map("queen_sales")
}
```

---

## 4. API-endepunkter

### 4.1 Queens

| Metode | Endepunkt | Beskrivelse |
|--------|-----------|-------------|
| GET | `/queens` | Liste dronninger med filtrering |
| POST | `/queens` | Registrer ny dronning |
| GET | `/queens/:id` | Hent dronningdetaljer med historikk |
| PUT | `/queens/:id` | Oppdater dronning |
| DELETE | `/queens/:id` | Slett dronning |
| GET | `/queens/:id/lineage` | Hent slektstre (mor, døtre, mormor) |
| POST | `/queens/:id/evaluate` | Legg til evaluering |
| POST | `/queens/:id/move` | Flytt til annen kube (logger historikk) |
| POST | `/queens/:id/sell` | Registrer salg |

#### GET /queens — Query-parametre

| Parameter | Type | Beskrivelse |
|-----------|------|-------------|
| `status` | string | Filtrer på status (virgin, mated, laying, etc.) |
| `year` | number | Filtrer på klekkeår |
| `race` | string | Filtrer på rase |
| `origin` | string | Filtrer på opprinnelse |
| `hiveId` | string | Dronninger i en bestemt kube |
| `motherId` | string | Døtre av en bestemt dronning |
| `batchId` | string | Dronninger fra en bestemt podningsserie |
| `keepForBreeding` | boolean | Kun avlsanbefalte |
| `search` | string | Søk i queenCode, notes |
| `page`, `perPage` | number | Paginering |

#### POST /queens — Request body

```json
{
  "queenCode": "B24-042",
  "year": 2024,
  "race": "buckfast",
  "color": "yellow",
  "marked": true,
  "origin": "own_production",
  "motherId": "uuid-of-mother",
  "graftDate": "2024-06-15",
  "graftSourceHiveId": "uuid-of-source-hive",
  "graftBatchId": "uuid-of-batch",
  "matingStation": "Lygra parringstasjon",
  "currentHiveId": "uuid-of-hive",
  "notes": "Fin dronning fra beste mor"
}
```

#### GET /queens/:id — Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "queenCode": "B24-042",
    "year": 2024,
    "race": "buckfast",
    "color": "yellow",
    "marked": true,
    "clipped": false,
    "origin": "own_production",
    "status": "laying",
    "statusDate": "2024-07-10T00:00:00Z",
    "mother": {
      "id": "uuid",
      "queenCode": "B22-001",
      "year": 2022,
      "race": "buckfast",
      "rating": 5
    },
    "fatherColony": {
      "id": "uuid",
      "hiveNumber": "12",
      "apiaryName": "Parringsstand"
    },
    "currentHive": {
      "id": "uuid",
      "hiveNumber": "5",
      "apiaryName": "Heimebigård"
    },
    "graftBatch": {
      "id": "uuid",
      "batchCode": "P2024-02",
      "graftDate": "2024-06-15"
    },
    "graftDate": "2024-06-15",
    "matingDate": "2024-07-01",
    "matingStation": "Lygra",
    "layingConfirmedDate": "2024-07-10",
    "introducedDate": "2024-07-12",
    "rating": 4,
    "temperament": "calm",
    "productivity": "high",
    "swarmTendency": "low",
    "daughters": [
      { "id": "uuid", "queenCode": "B25-011", "year": 2025, "status": "laying" }
    ],
    "evaluations": [
      {
        "id": "uuid",
        "evaluationDate": "2024-09-15",
        "season": "summer",
        "overallRating": 4,
        "keepForBreeding": true
      }
    ],
    "hiveHistory": [
      { "hiveNumber": "5", "action": "introduced", "date": "2024-07-12" },
      { "hiveNumber": "Parringskube 3", "action": "removed", "date": "2024-07-12" },
      { "hiveNumber": "Parringskube 3", "action": "introduced", "date": "2024-07-01" }
    ],
    "notes": "Fin dronning fra beste mor"
  }
}
```

#### GET /queens/:id/lineage — Response

```json
{
  "success": true,
  "data": {
    "queen": { "id": "...", "queenCode": "B24-042", "year": 2024, "rating": 4 },
    "mother": { "id": "...", "queenCode": "B22-001", "year": 2022, "rating": 5 },
    "grandmother": { "id": "...", "queenCode": "B20-003", "year": 2020, "rating": 4 },
    "daughters": [
      { "id": "...", "queenCode": "B25-011", "year": 2025, "status": "laying", "rating": null },
      { "id": "...", "queenCode": "B25-012", "year": 2025, "status": "mated", "rating": null }
    ],
    "sisters": [
      { "id": "...", "queenCode": "B24-043", "year": 2024, "status": "laying", "rating": 3 }
    ]
  }
}
```

### 4.2 Graft Batches

| Metode | Endepunkt | Beskrivelse |
|--------|-----------|-------------|
| GET | `/graft-batches` | Liste podningsserier |
| POST | `/graft-batches` | Opprett ny podningsserie |
| GET | `/graft-batches/:id` | Hent detaljer med tilknyttede dronninger |
| PUT | `/graft-batches/:id` | Oppdater (antall akseptert, klekket, etc.) |
| DELETE | `/graft-batches/:id` | Slett |

### 4.3 Queen Sales

| Metode | Endepunkt | Beskrivelse |
|--------|-----------|-------------|
| GET | `/queen-sales` | Liste salg med filtrering |
| POST | `/queens/:id/sell` | Registrer salg |
| GET | `/queen-sales/summary` | Salgsstatistikk (antall, omsetning per år) |

---

## 5. Brukergrensesnitt

### 5.1 Web — Sider

#### Dronningoversikt (`/queens`)

- Filtrerbar liste med alle dronninger
- Kolonner: kode, år, rase, status, kube, rating, mor
- Filtere: status, år, rase, opprinnelse, avlsanbefalt
- Hurtighandlinger: flytt, evaluer, sett status
- Knapp: "Ny dronning", "Ny podningsserie"

#### Dronningdetalj (`/queens/[id]`)

- Komplett informasjon: stamdata, status, nåværende kube
- **Slektstre-visualisering**: mor → dronning → døtre (enkel trevisning)
- **Evalueringshistorikk**: graf over tid med radarkart for egenskaper
- **Kubehistorikk**: tidslinje over flyttinger
- **Podningsserie**: lenke til batch med søstre
- Handlingsknapper: evaluer, flytt, selg, endre status

#### Podningsserier (`/graft-batches`)

- Liste over alle podningsserier
- Visuell fremgang: podet → akseptert → forseglet → klekket → paret
- Klikkbar for detaljer og tilknyttede dronninger

#### Avlsoversikt (`/breeding`)

- Topp avlsmødre sortert på rating og antall døtre
- Rase-fordeling (kakediagram)
- Suksessrate per sesong (andel som nådde "laying"-status)
- Salgsstatistikk

### 5.2 Mobil — Skjermer

#### Dronningliste (`queens/index`)

- Kompakt liste med status-ikoner og fargekoding
- Swipe-handlinger: evaluer, flytt
- FAB: ny dronning

#### Dronningdetalj (`queens/[id]`)

- Sammendragskort med status og rating
- Slektsinfo (mor/døtre som lenker)
- Evalueringshistorikk
- Kubehistorikk

#### Ny dronning (`queens/new`)

- Stegvis skjema:
  1. Grunndata (kode, rase, år, opprinnelse)
  2. Slekt (velg mor, podningsserie)
  3. Plassering (nåværende kube)
  4. Notater

#### Evaluering (`queens/evaluate`)

- Skyveknapper (sliders) for hvert kriterium (1-5)
- Automatisk beregning av samlet score
- Avkryssing: "Anbefalt som avlsmor"

#### Hurtigregistrering fra inspeksjon

- Ved inspeksjon: nytt felt "Dronningbytte" med valg:
  - "Ny dronning observert" → opprett Queen-post
  - "Bytt dronning" → velg fra liste eller opprett ny
  - "Dronning borte" → marker som dead/swarmed

---

## 6. Integrasjon med eksisterende system

### 6.1 Hive ↔ Queen

- `Hive` får en ny relasjon `currentQueen` → `Queen`
- Erstatter de eksisterende flate feltene (`queenYear`, `queenMarked`, `queenColor`, `queenRace`)
- **Migrasjonsstrategi**: eksisterende dronningdata konverteres til Queen-poster ved migrering
- Kubedetalj-visning viser dronninginfo fra `Queen`-modellen i stedet for flate felter

### 6.2 Inspeksjon ↔ Queen

- Inspeksjonsskjemaet beholder "Dronning sett" og "Dronning legger"
- Nytt valgfritt felt: "Dronningbytte registrert" som oppretter `QueenHiveLog`
- Inspeksjonens `queenSeen`-data kan kobles til evalueringshistorikk

### 6.3 Eksisterende data — migrasjon

```sql
-- Migrer eksisterende dronningdata til Queen-tabell
INSERT INTO queens (id, queen_code, year, race, color, marked, status, current_hive_id, user_id)
SELECT
  gen_random_uuid(),
  'AUTO-' || h.hive_number,
  h.queen_year,
  h.queen_race,
  h.queen_color,
  h.queen_marked,
  'laying',
  h.id,
  ua.user_id
FROM hives h
JOIN user_apiaries ua ON ua.apiary_id = h.apiary_id AND ua.role = 'owner'
WHERE h.queen_year IS NOT NULL;
```

### 6.4 Statistikk-API

Nytt endepunkt `GET /stats/queens`:

```json
{
  "year": 2025,
  "totalQueens": 42,
  "byStatus": { "laying": 28, "virgin": 5, "mated": 3, "sold": 4, "dead": 2 },
  "byRace": { "buckfast": 30, "carnica": 8, "nordisk": 4 },
  "avgRating": 3.8,
  "breedingMothers": 6,
  "graftBatches": 4,
  "successRate": 0.72,
  "sales": { "count": 4, "revenue": 6000 }
}
```

---

## 7. Arbeidsflyt — typiske bruksscenarier

### 7.1 Podning og dronningproduksjon

```
1. Velg avlsmor (Queen med høy rating + keepForBreeding=true)
2. Opprett GraftBatch:
   - Kilde: avlsmors kube
   - Metode: nicot/jenter/grafting
   - Antall celler podet
3. Oppdater batch over tid:
   - Dag 1: cellsAccepted (etter 24t kontroll)
   - Dag 10: cellsCapped
   - Dag 14: queensEmerged → opprett Queen-poster for klekte dronninger
4. Flytt til parringskuber (Queen.move → QueenHiveLog)
5. Etter parring:
   - Oppdater status: virgin → mated
   - Registrer parringstasjon og dato
6. Etter egglegging bekreftet:
   - Oppdater status: mated → laying
   - Flytt til produksjonskube
```

### 7.2 Dronningbytte i felt

```
1. Under inspeksjon: "Dronningen mangler" eller "Vil bytte dronning"
2. Gammel dronning markeres som removed/dead
3. Velg ny dronning fra liste (eller opprett ny)
4. QueenHiveLog registrerer byttet
5. Hive.currentQueen oppdateres
```

### 7.3 Evaluering etter sesong

```
1. Åpne dronning → "Evaluer"
2. Fyll ut kriterier (1-5 skala)
3. System beregner overallRating
4. Marker "Anbefalt som avlsmor" for beste dronninger
5. Avlsoversikten oppdateres med nye rangeringer
```

### 7.4 Dronningsalg

```
1. Velg dronning → "Selg"
2. Registrer kjøper, pris, leveringsmetode
3. Status endres til "sold"
4. QueenHiveLog: action=sold
5. Dronningen forsvinner fra aktiv kubeoversikt
```

---

## 8. Implementeringsrekkefølge

### Fase 1 — Grunnleggende dronningregister (Should Have for MVP)

- [ ] Prisma-skjema: Queen, QueenHiveLog
- [ ] Backend: CRUD for queens + move-endepunkt
- [ ] Migrasjon: eksisterende flate felter → Queen-poster
- [ ] Web: dronningoversikt og detalj-side
- [ ] Mobil: dronningliste og registrering
- [ ] Integrasjon: kubedetalj viser Queen-data
- [ ] Inspeksjonsskjema: dronningbytte-felt

### Fase 2 — Podning og avl

- [ ] Prisma-skjema: GraftBatch
- [ ] Backend: CRUD for graft-batches
- [ ] Web: podningsserie-oversikt med fremgangsvisning
- [ ] Mobil: registrer podningsserie
- [ ] Kobling Queen → GraftBatch → mor-dronning

### Fase 3 — Evaluering og genetikk

- [ ] Prisma-skjema: QueenEvaluation
- [ ] Backend: evaluate-endepunkt + lineage-endepunkt
- [ ] Web: evalueringsskjema med sliders + radarkart
- [ ] Web: slektstre-visualisering
- [ ] Avlsoversikt med topp-mødre og statistikk

### Fase 4 — Salg og rapportering

- [ ] Prisma-skjema: QueenSale
- [ ] Backend: sell-endepunkt + sales-summary
- [ ] Web: salgsoversikt
- [ ] PDF-rapport: dronningproduksjon per sesong
- [ ] Statistikk-API: /stats/queens

---

## 9. Tekniske hensyn

### Ytelse

- Lineage-spørringer kan bli dype (mormor, oldemor...). Begrens til 3 generasjoner i standard-visning.
- Indekser på `motherId`, `currentHiveId`, `graftBatchId`, `userId`, `status`.

### Tilgangskontroll

- Dronninger tilhører en bruker (`userId`), ikke en bigård.
- Dronninger i en kube arver synlighet via kuben/bigårdens tilgangskontroll.
- Dronninger uten kube er kun synlige for eieren.

### Offline-synk (mobil)

- Queen og QueenHiveLog legges til i offline-databasen.
- Evalueringer kan registreres offline og synkes senere.
- Podningsserier krever nettilgang (lavere prioritet for felt-bruk).

### Migrasjon fra flate felter

- Eksisterende `queenYear`, `queenMarked`, `queenColor`, `queenRace` på Hive beholdes midlertidig for bakoverkompatibilitet.
- Etter vellykket migrasjon og verifisering fjernes de flate feltene.
- Frontend/mobil oppdateres til å lese fra `queen`-relasjonen i stedet.

---

## 10. Ikke i scope (fremtidige utvidelser)

- **Instrumentell inseminasjon**: sporing av sædprøver og donorer
- **DNA-testing**: integrasjon med laboratorietjenester
- **Parringsstasjons-booking**: integrasjon med norske parringsstasjon-registre
- **Dronningmarked**: markedsplass for dronningsalg mellom birøktere
- **Automatisk avlsplanlegging**: AI-baserte anbefalinger for optimal krysning
