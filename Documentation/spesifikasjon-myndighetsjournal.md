# Birøkt – spesifikasjon for myndighetsjournal og sporbar dokumentasjon

**Versjon:** 1.0
**Dato:** 20. august 2026
**Status:** Klar for implementering
**Prioritet:** Høy
**Omfang:** Backend, web, mobil/offline, eksport, migrering og dokumentasjon

> **For Hermes/Codex:** Implementer spesifikasjonen fasevis og testdrevet. Ikke overskriv eller slett eksisterende produksjonsdata. Bevar bakoverkompatibilitet der det er praktisk, og bruk eksplisitte migreringer for alle databaseskjemaendringer.

## 1. Mål

Utbedre Birøkt slik at løsningen kan brukes som:

1. digital kube- og driftsjournal
2. sporbar journal for plassering og flytting av bikuber
3. komplett journal for veterinære legemidler
4. journal for relevante sykdoms-, dødelighets-, prøve-, analyse-, biosikkerhets- og kontrollhendelser
5. dokumentasjon ved produksjon og omsetning av honning
6. etterprøvbar eksport ved egenkontroll eller forespørsel fra Mattilsynet

Løsningen skal støtte aktuelle dokumentasjonsplikter. Den skal ikke love automatisk juridisk etterlevelse uavhengig av hvilke opplysninger brukeren faktisk registrerer.

## 2. Rettslig og faglig utgangspunkt

Spesifikasjonen bygger særlig på følgende regelverk slik det foreligger 20. august 2026:

- forskrift om dyrehelse, som gjennomfører forordning (EU) 2016/429, blant annet artikkel 102 om journalføring
- landdyrsporbarhetsforskriften og delegert forordning (EU) 2019/2035, blant annet artikkel 27 om midlertidig flytting av honningbier
- forskrift om legemidler til dyr og forordning (EU) 2019/6 artikkel 108
- næringsmiddelhygieneforskriften og forordning (EF) 852/2004 vedlegg I del A punkt III

Det finnes ikke et uttrykkelig krav om et dokument som heter «kubekort». Kravet gjelder opplysningene, oppbevaringen og muligheten til å legge frem etterprøvbar dokumentasjon.

Følgende presiseringer skal vises i produktdokumentasjonen:

- Birøkt erstatter ikke registrering av dyrehold eller bigårdsplasser hos Mattilsynet.
- Birøkteren er ansvarlig for at registreringene er korrekte og fullstendige.
- Ved mistanke om meldepliktig sykdom må Mattilsynet varsles; journalføring alene er ikke varsling.
- Funksjoner og rapporter skal omtales som støtte for dokumentasjon, ikke som juridisk garanti.

## 3. Nåtilstand og identifiserte mangler

Eksisterende løsning dekker allerede bigårder, kuber, inspeksjoner, helseobservasjoner, behandlinger, produksjon og rapporter. Følgende mangler skal lukkes:

1. Ingen historisk journal over hvor en kube sto i et gitt tidsrom.
2. Behandlingsjournalen mangler leverandør, anskaffelsesdokumentasjon, strukturert mengde/enhet, veterinæropplysninger og sikker registrering av null dagers tilbakeholdelsestid.
3. Journalpliktige registreringer kan endres eller slettes uten revisjonshistorikk.
4. Ingen eksplisitt oppbevaringspolicy eller sperre mot sletting i oppbevaringsperioden.
5. Ingen strukturert journal for dødelighet, biosikkerhet, prøver, analyser, dyrehelsebesøk og offentlig kontroll.
6. Ingen generell dokumentmodell for kvitteringer, resepter, laboratorierapporter og kontrollrapporter.
7. Ingen produksjonsparti-/lotkobling mellom høsting, kuber, behandlinger, analyser og salg.
8. Offline-registrering kan miste sykdoms- og skadedyrdata.
9. Eksportene inneholder ikke alle eksisterende og nye journalopplysninger.
10. Rapportskjermen gir en for sterk påstand om at rapporten er komplett og kan brukes for Mattilsynet.

## 4. Overordnede produktkrav

### 4.1 Prinsipper

- Alle journalhendelser skal ha en tydelig dato, ansvarlig bruker og berørt bigård/kube/bifolk når relevant.
- Historiske plasseringer og identiteter skal ikke endres når navn eller nummer endres senere.
- Journaldata skal kunne korrigeres, men opprinnelig verdi og rettelsesgrunn skal bevares.
- «Revisjonsspor» betyr applikasjonslogg og integritetskontrollert eksport, ikke en garanti mot endringer utført av databaseadministrator. Sterkere manipulasjonsvern krever separat trusselmodell, signering/hashkjede eller uforanderlig ekstern lagring.
- Journaldata skal fungere både online og offline.
- Synkronisering skal være idempotent og ikke opprette duplikater.
- Felter som er juridisk påkrevd for den valgte hendelsestypen, skal valideres i API-et – ikke bare i brukergrensesnittet.
- Tidspunkter lagres i UTC og vises i brukerens lokale tidssone. Rene kalenderdatoer som anskaffelsesdato og dokumentdato sendes som `YYYY-MM-DD` og skal ikke forskyves ved tidssonekonvertering.
- Eksport skal vise både gjeldende data og rettelseshistorikk.
- Norske feltnavn brukes i UI; stabile engelske navn brukes i API og database.

### 4.2 Oppbevaring

- Veterinærlegemiddelregistreringer og tilhørende dokumenter skal beskyttes mot permanent sletting i minst fem år fra registrerings-/behandlingsdato.
- For enkel og konservativ drift skal standard oppbevaringstid for alle myndighetsjournaler settes til fem år.
- Oppbevaringstiden skal kunne økes, men ikke reduseres under fem år for legemiddelregistreringer.
- Retensjon er ikke oppfylt bare fordi data finnes i databasen. Backup, vedlegg og gjenoppretting inngår.

## 5. Fase A – kritiske utbedringer

Fase A skal fullføres før produktet omtales som en samlet myndighetsjournal.

---

## 5.1 Bigårds- og driftsopplysninger

### Krav

Utvid `Apiary` med følgende valgfrie felt:

```prisma
registrationNumber String?   @map("registration_number")
operatorName       String?   @map("operator_name")
operatorAddress    String?   @map("operator_address")
organizationNumber String?  @map("organization_number")
validFrom          DateTime? @map("valid_from")
validTo            DateTime? @map("valid_to")
```

Eksisterende felter `locationName`, `locationLat`, `locationLng`, `type` og `active` beholdes.

### Funksjonelle krav

- Webskjemaet for bigård skal eksponere `type` med valgene permanent, sesong og lyngtrekk.
- Registreringsnummer og driftsansvarlig skal kunne registreres.
- GPS og lesbart stedsnavn skal kunne lagres samtidig.
- Endring av navn eller lokasjon skal skrives til revisjonsloggen.
- Tidligere plasseringer skal ikke rekonstrueres fra dagens `Apiary`; de skal dokumenteres gjennom kubeplasseringer, se punkt 5.2.

### Berørte filer

- `backend/prisma/schema.prisma`
- ny Prisma-migrering under `backend/prisma/migrations/`
- `backend/src/routes/apiary.routes.ts`
- `backend/src/__tests__/apiaries.test.ts`
- `frontend-web/src/app/(dashboard)/apiaries/page.tsx`
- `frontend-web/src/lib/api.ts`
- `mobile/src/lib/api.ts`

### Akseptansekriterier

- En bigård kan opprettes og redigeres med alle nye felt.
- API-et returnerer feltene i liste- og detaljrespons.
- `type` kan velges i web.
- Endring av lokasjon lager en audit-hendelse med gammel og ny verdi.

---

## 5.2 Plasserings- og flyttejournal

### Valgt modell

Plassering modelleres som perioder. Det skal alltid være maksimalt én åpen plassering per kube.

Opprett modellen:

```prisma
model HivePlacement {
  id             String    @id @default(uuid())
  hiveId         String    @map("hive_id")
  apiaryId       String    @map("apiary_id")
  startedAt      DateTime  @map("started_at")
  endedAt        DateTime? @map("ended_at")
  movementType   String    @map("movement_type") // initial, permanent, temporary, return, other
  reason         String?
  apiaryName     String    @map("apiary_name_snapshot")
  locationName   String?   @map("location_name_snapshot")
  locationLat    Float?    @map("location_lat_snapshot")
  locationLng    Float?    @map("location_lng_snapshot")
  createdById    String    @map("created_by_id")
  movementBatchId String?  @map("movement_batch_id")
  correctionOfId String?   @map("correction_of_id")
  voidedAt       DateTime? @map("voided_at")
  voidReason     String?   @map("void_reason")
  createdAt      DateTime  @default(now()) @map("created_at")

  hive         Hive           @relation(fields: [hiveId], references: [id])
  apiary       Apiary         @relation(fields: [apiaryId], references: [id])
  createdBy    User           @relation(fields: [createdById], references: [id])
  correctionOf HivePlacement? @relation("PlacementCorrection", fields: [correctionOfId], references: [id])
  corrections  HivePlacement[] @relation("PlacementCorrection")

  @@index([hiveId, startedAt])
  @@index([apiaryId, startedAt])
  @@map("hive_placements")
}
```

Opprett også en felles `IdempotencyRequest` for mobile POST-mutasjoner. Den skal ha unik `(userId, route, key)`, request-hash, tilstand, statuskode, serialisert respons og utløpstid. En batchflytting får én unik idempotensforespørsel; plasseringene kan dele `movementBatchId`, som ikke er unik per plassering. Samme nøkkel og request-hash returnerer lagret status/body. Samme nøkkel med ulik hash returnerer `409 IDEMPOTENCY_KEY_REUSED`.

Oppdater relasjonene i `Hive`, `Apiary` og `User`. Alle schemautdrag i dokumentet er feltkrav; implementasjonen skal levere et samlet, validerbart Prisma-schema med alle inverse relasjonsfelt for nye modeller.

`Hive.apiaryId` beholdes som nåværende lokasjon/cache for bakoverkompatibilitet. Verdien skal bare endres gjennom flyttetjenesten etter at historikken er innført.

### Forretningsregler

- Første gang en eksisterende kube migreres, opprettes en `initial`-plassering med `startedAt` lik migreringstidspunktet og nåværende bigård. Det skal ikke antas at kuben har stått der siden `Hive.createdAt`.
- Rapporten viser «Plassering ukjent før [migreringstidspunkt]» inntil eldre historikk eventuelt fylles inn manuelt. Slik utfylling auditeres og merkes `manual_backfill`.
- Ved flytting avsluttes den åpne plasseringen og en ny opprettes i samme databasetransaksjon.
- `startedAt` for ny plassering må være senere enn eller lik starttid for gjeldende plassering.
- Plasseringer er halvåpne intervaller `[startedAt, endedAt)`, og perioder for samme kube skal ikke overlappe. Periodefilter bruker `startedAt < to AND (endedAt IS NULL OR endedAt > from)`.
- Migreringen skal opprette en partiell unik SQLite-indeks som håndhever maksimalt én aktiv plassering: `CREATE UNIQUE INDEX ... ON hive_placements(hive_id) WHERE ended_at IS NULL AND voided_at IS NULL`. Tjenestelaget kontrollerer også lukkede intervaller og returnerer `409 PLACEMENT_CONFLICT`.
- Ved midlertidig flytting brukes `movementType=temporary`.
- Retur registreres som ny plassering med `movementType=return`; tidligere plassering overskrives ikke.
- Navn og koordinater kopieres til snapshotfeltene slik at historikken overlever senere endring av bigården.
- Salg/avhending og kjøp fra ekstern part håndteres som egne eierskaps-/statushendelser: salg avslutter åpen plassering, setter kuben `sold` og lagrer mottaker-/destinasjonssnapshot uten å kreve intern målbigård. Kjøp lagrer opprinnelsessnapshot før første interne plassering.
- En bigård med plasseringer kan ikke hard-slettes.
- En plassering kan ikke hard-slettes. Feil rettes ved å markere posten ugyldig med begrunnelse og opprette korrigerende post.
- Batchflytting forhåndsvaliderer alle kuber og er atomisk. Ved én feil rulles hele batchen tilbake og `409` returneres med feil per kube. Per-kube-resultat returneres bare ved full suksess.
- Flytting krever eier-/redigeringsrett til både kilde- og målbigård. `viewer` kan aldri mutere. Historisk tilgang skal ikke avgjøres bare av kubens nåværende bigård.

### API

Opprett rute:

- `backend/src/routes/placement.routes.ts`

Registrer den under `/api/v1/placements` i `backend/src/routes/index.ts`, i tråd med eksisterende Express-struktur.

Endepunkter:

```http
GET  /placements?hiveId=&apiaryId=&from=&to=&page=&perPage=
GET  /placements/:id
POST /placements/move
POST /placements/batch-move
POST /placements/:id/correct
```

Eksempel – enkeltflytting:

```json
{
  "hiveId": "uuid",
  "toApiaryId": "uuid",
  "startedAt": "2026-08-20T09:00:00.000Z",
  "movementType": "temporary",
  "reason": "Lyngtrekk"
}
```

Eksempel – batch:

```json
{
  "hiveIds": ["uuid-1", "uuid-2"],
  "toApiaryId": "uuid",
  "startedAt": "2026-08-20T09:00:00.000Z",
  "movementType": "temporary",
  "reason": "Lyngtrekk"
}
```

Kubehistorikk hentes med `GET /placements?hiveId=...`; det skal ikke opprettes en nestet rute som utilsiktet blir `/placements/hives/:id/placements`.

Responsen skal bruke eksisterende `{ success, data, error, meta }`-format og inneholde avsluttet plassering, ny plassering og oppdatert nåværende bigård. Definer stabile feilkoder og statusene `201`, `400`, `403`, `404`, `409`, `413` og `422`; listeendepunkter bruker `meta.pagination`.

### Web

Opprett:

- `frontend-web/src/app/(dashboard)/movements/page.tsx`
- eventuelt gjenbrukbar `frontend-web/src/components/forms/hive-movement-form.tsx`

Funksjoner:

- flytt én eller flere kuber
- velg målbigård, dato/tid, type og årsak
- vis aktiv plassering per kube
- vis tidslinje per kube
- filtrer på bigård og periode
- korriger feil med obligatorisk begrunnelse
- marker tydelig midlertidig plassering og retur

### Mobil og offline

Opprett:

- `mobile/src/app/movement/new.tsx`
- lokale tabeller og køstøtte i `mobile/src/services/database.ts` og relevante offline-/syncfiler

Krav:

- batchvalg av kuber
- generer `Idempotency-Key` på enheten og send den som HTTP-header
- vis operasjonen som ventende til serveren har bekreftet den
- samme synkroniseringsforsøk skal ikke kunne opprette duplikat
- konflikt ved overlappende plassering skal vises for brukeren og ikke overskrives automatisk

### Tester

Opprett `backend/src/__tests__/placements.test.ts` med minst:

1. migrert kube får én åpen initialplassering
2. flytting avslutter gammel og oppretter ny plassering
3. `Hive.apiaryId` oppdateres i samme transaksjon
4. midlertidig flytting og retur gir korrekt tidslinje
5. overlappende perioder avvises
6. bruker uten tilgang avvises
7. batchflytting er atomisk
8. samme idempotensnøkkel gir samme resultat uten duplikat
9. hard delete finnes ikke
10. korreksjon bevarer opprinnelig post

### Akseptansekriterier

- For enhver kube kan systemet vise hvor den sto på datoer dekket av dokumenterte plasseringsperioder. Før første dokumenterte periode vises «ukjent».
- Rapporten viser fra-sted, til-sted og tidsrom.
- Senere navne- eller GPS-endringer i bigården endrer ikke historiske snapshots.
- Ingen flytting kan gjennomføres uten dato, målbigård og berørte kuber.

---

## 5.3 Komplett journal for veterinære legemidler

### Datamodell

Utvid eksisterende `Treatment` uten å fjerne gamle felt i første migrering:

```prisma
colonyNumber          Int?      @map("colony_number")
medicineAcquisitionId String?   @map("medicine_acquisition_id")
treatmentGroupId      String?   @map("treatment_group_id")
administeredAmount    Float?    @map("administered_amount")
administeredUnit      String?   @map("administered_unit")
supplierName          String?   @map("supplier_name")
supplierAddress       String?   @map("supplier_address")
acquisitionDate       DateTime? @map("acquisition_date")
veterinarianName      String?   @map("veterinarian_name")
veterinarianContact   String?   @map("veterinarian_contact")
prescriptionReference String?  @map("prescription_reference")
productBatchNumber    String?   @map("product_batch_number")
hiveNumberSnapshot     String?   @map("hive_number_snapshot")
apiaryIdAtTreatment    String?   @map("apiary_id_at_treatment")
apiaryNameSnapshot     String?   @map("apiary_name_snapshot")
voidedAt              DateTime? @map("voided_at")
voidReason            String?   @map("void_reason")
retentionUntil        DateTime? @map("retention_until")
```

Eksisterende felt brukes slik:

- `startDate` = dato/tid for første administrering
- `endDate` = siste administrering/behandlingsslutt
- `dosage` beholdes som doseringsinstruks/fritekst
- `administeredAmount` + `administeredUnit` = faktisk administrert mengde
- `withholdingPeriodDays` = eksplisitt heltall, inkludert `0`
- `treatmentDate` beholdes for bakoverkompatibilitet og skal for nye registreringer settes lik `startDate`

### Validering for nye behandlinger

Følgende skal være obligatorisk i API-et:

- `hiveId`
- `startDate`
- `productName`
- `administeredAmount`
- `administeredUnit`
- `supplierName`
- `acquisitionDate`
- `withholdingPeriodDays`, der `0` er gyldig og forskjellig fra manglende verdi
- enten `endDate` eller eksplisitt `ongoing=true`

I tillegg:

- `colonyNumber` er obligatorisk for todronningkube dersom behandlingen ikke gjelder hele kuben.
- API-et skal støtte `scope = whole_hive | colony`.
- For enkeltkube tillates bare bifolk 1.
- For todronningkube tillates bifolk 1 eller 2.
- Veterinærfelter skal vises og kunne fylles når veterinær/resept er relevant.
- Identitetssnapshots fylles fra kube og dokumentert plassering ved første administrering, slik at senere flytting eller omnummerering ikke endrer historisk rapport.
- `retentionUntil = addCalendarYears(endDate ?? startDate ?? treatmentDate, COMPLIANCE_RETENTION_YEARS)` i UTC. For pågående behandling beregnes endelig dato når behandlingen avsluttes; en korrigering som forlenger perioden flytter retensjonsdatoen frem, aldri tilbake. 29. februar normaliseres til siste gyldige dag i samme måned fem kalenderår senere.
- Sluttdato kan ikke være før startdato.
- Positiv tilbakeholdelsestid skal gi korrekt `withholdingEndDate`; null dager skal lagres som `0`, ikke `NULL`.

### Anskaffelsesjournal

Opprett en egen anskaffelsesmodell:

```prisma
model MedicineAcquisition {
  id                   String    @id @default(uuid())
  userId               String    @map("user_id")
  productName          String    @map("product_name")
  acquiredOn           DateTime  @map("acquired_on")
  supplierName         String    @map("supplier_name")
  supplierAddress      String?   @map("supplier_address")
  acquiredAmount       Float     @map("acquired_amount")
  acquiredUnit         String    @map("acquired_unit")
  acquisitionReference String?   @map("acquisition_reference")
  retentionUntil       DateTime  @map("retention_until")
  voidedAt             DateTime? @map("voided_at")
  voidReason           String?   @map("void_reason")
  voidedById           String?   @map("voided_by_id")
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  user       User        @relation(fields: [userId], references: [id], onDelete: Restrict)
  treatments Treatment[]

  @@index([userId, acquiredOn])
  @@map("medicine_acquisitions")
}
```

`Treatment.medicineAcquisitionId` kobles til denne modellen med `onDelete: Restrict`. Anskaffelsen skal kunne dokumenteres selv om preparatet ikke er brukt, og skal ha enten vedlegg eller eksplisitt referanse til faktura/kvittering/resept. Ubrukt eller kassert legemiddel skal ikke feilaktig registreres som behandling.

### Dokumentasjon

Opprett en generell dokumentmodell:

```prisma
model ComplianceDocument {
  id             String   @id @default(uuid())
  userId         String   @map("user_id")
  entityType     String   @map("entity_type") // treatment, compliance_event, production_batch, official_control
  entityId       String   @map("entity_id")
  documentType   String   @map("document_type") // receipt, invoice, prescription, lab_report, control_report, photo, other
  originalName   String   @map("original_name")
  storagePath    String   @map("storage_path")
  mimeType       String   @map("mime_type")
  fileSize       Int      @map("file_size")
  sha256         String
  documentDate   DateTime? @map("document_date")
  issuer         String?
  reference      String?
  retentionUntil DateTime? @map("retention_until")
  voidedAt      DateTime? @map("voided_at")
  voidReason    String?   @map("void_reason")
  voidedById    String?   @map("voided_by_id")
  createdAt      DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@index([entityType, entityId])
  @@map("compliance_documents")
}
```

`entityType/entityId` skal valideres i tjenestelaget. Opplasting må bekrefte at brukeren eier den tilknyttede posten. Den polymorfe koblingen har ingen database-fremmednøkkel; derfor skal sletting av forelder sperres i tjenestelaget, integritetskontrollen rapportere foreldreløse dokumenter, og eksporten angi valideringsstatus.

Tillatte filtyper i første versjon:

- PDF
- JPEG
- PNG
- WebP

Maksimal filstørrelse skal være konfigurerbar. SHA-256 beregnes på serveren før lagring. Dokumentmetadata kan korrigeres, men selve filen skal ikke erstattes lydløst; ny fil blir nytt dokument.

### API

Utvid `/treatments` og opprett dokumentendepunkter:

```http
POST /medicine-acquisitions
GET  /medicine-acquisitions
GET  /medicine-acquisitions/:id
POST /medicine-acquisitions/:id/void
POST /treatments
POST /treatments/batch
GET  /treatments/:id
PUT  /treatments/:id
POST /treatments/:id/void
POST /documents
GET  /documents/:id
GET  /documents/:id/download
POST /documents/:id/void
```

Alle responser skal bruke eksisterende `sendSuccess`/`sendError`-format. Dokumentopplasting bruker `multipart/form-data` med binærfeltet `file` og JSON-metadatafeltene `entityType`, `entityId`, `documentType`, `documentDate`, `issuer` og `reference`. Ugyldig fil gir `422`, for stor fil `413`, konflikt `409`.

`DELETE /treatments/:id` skal fjernes eller returnere:

```json
{
  "code": "RECORD_RETENTION_PROTECTED",
  "message": "Behandlingsjournalen kan ikke slettes. Bruk annullering med begrunnelse."
}
```

Dokumenter innen aktiv retensjonsperiode kan ikke hard-slettes. Feil dokument kobles fra/markeres ugyldig med begrunnelse, men beholdes i arkivet.

### Web

Oppdater:

- `frontend-web/src/app/(dashboard)/treatments/page.tsx`
- `frontend-web/src/lib/api.ts`

Skjemaet skal ha:

- preparatnavn
- første administreringsdato
- behandlingsslutt eller «pågår»
- mål/årsak
- omfang: hele kuben eller bestemt bifolk
- faktisk mengde og enhet
- doseringsnotat
- valg eller opprettelse av anskaffelsespost
- leverandør og adresse
- anskaffelsesdato
- preparatets batch-/lotnummer
- veterinærnavn og kontakt
- reseptreferanse
- tilbakeholdelsestid med eksplisitt valg, inkludert 0 dager
- vedlegg for kvittering/faktura/resept
- notat

Skjemaet skal ikke sende `undefined` når brukeren velger null dagers tilbakeholdelsestid.

Batchbehandling skal kunne registrere samme behandling på flere kuber/bifolk og opprette separate `Treatment`-poster med felles `treatmentGroupId`.

### Mobil og offline

Oppdater:

- `mobile/src/app/treatment/new.tsx`
- `mobile/src/lib/api.ts`
- lokal SQLite-modell og synkronisering

Alle obligatoriske felt skal kunne registreres offline. Vedlegg skal køes separat og lastes opp etter at behandlingsposten er synkronisert.

### Migrering av eksisterende behandlinger

- Eksisterende data skal ikke forkastes.
- `retentionUntil` beregnes fra `endDate`, ellers `startDate`, ellers `treatmentDate`.
- Eksisterende `dosage` beholdes uendret.
- Nye obligatoriske felt kan være `NULL` i databasen for historiske poster, men API-et krever dem for nye poster.
- Rapporten skal merke historiske behandlinger med mangelfull dokumentasjon som «Mangler opplysninger» og liste feltene som mangler.
- Det skal lages en egen webvisning/filter for å komplettere historiske poster.

### Tester

Utvid `backend/src/__tests__/treatments.test.ts` med minst:

1. null dagers tilbakeholdelsestid lagres og returneres som `0`
2. manglende tilbakeholdelsestid avvises for ny behandling
3. mengde uten enhet avvises
4. sluttdato før startdato avvises
5. bifolkvalidering for enkel og dobbel kube
6. batchbehandling oppretter én post per mål og felles gruppe-ID
7. retensjonsdato beregnes korrekt
8. leverandør og anskaffelsesdato er påkrevd
9. behandling kan annulleres med grunn, men ikke hard-slettes
10. bruker uten tilgang kan ikke hente behandling eller dokument
11. dokument får beregnet SHA-256 og riktig kobling
12. historisk ufullstendig behandling kan leses og kompletteres

### Akseptansekriterier

- Alle opplysninger som kreves for en komplett legemiddelregistrering kan registreres, vises og eksporteres.
- `0` og «ikke registrert» er tydelig forskjellige tilstander.
- Behandlet kube/bifolk eller gruppe er entydig.
- Anskaffelser kan dokumenteres uavhengig av om preparatet senere administreres.
- Kvittering, faktura eller resept kan vedlegges.
- Ingen beskyttet behandlingspost kan slettes sporløst.

---

## 5.4 Revisjonslogg, rettelser og sletting

### Datamodell

Opprett:

```prisma
model AuditLog {
  id          String   @id @default(uuid())
  userId      String?  @map("user_id")
  entityType  String   @map("entity_type")
  entityId    String   @map("entity_id")
  action      String   // create, update, void, correct, export, login_sensitive
  beforeJson  String?  @map("before_json")
  afterJson   String?  @map("after_json")
  reason      String?
  occurredAt  DateTime @default(now()) @map("occurred_at")
  requestId   String?  @map("request_id")

  user User? @relation(fields: [userId], references: [id])

  @@index([entityType, entityId, occurredAt])
  @@index([userId, occurredAt])
  @@map("audit_log")
}
```

### Krav

- Opprettelse, endring, annullering og korrigering av myndighetsjournal skal logges.
- Loggskriving og dataendring skal skje i samme databasetransaksjon.
- `AuditLog` skal ikke ha offentlige PUT-, PATCH- eller DELETE-endepunkter.
- Før- og etterdata skal saniteres for passord, tokens og andre hemmeligheter.
- Rettelser krever begrunnelse.
- UI skal vise rettelseshistorikk for behandlinger, plasseringer og compliance-hendelser.
- `updatedAt` alene regnes ikke som revisjonshistorikk.

### Omfang i første versjon

Audit er obligatorisk for:

- `Apiary`
- `Hive`
- `HivePlacement`
- `Inspection`
- `Treatment`
- `ComplianceEvent`
- `Production`
- `ProductionBatch`
- `ComplianceDocument`

### Slettestrategi

- `Inspection`, `Treatment`, `HivePlacement`, `ComplianceEvent`, `Production`, `ProductionBatch` og `ComplianceDocument` skal ha `voidedAt`, `voidReason` og `voidedById` og bruke annullering/soft delete. Vanlige listevisninger skjuler annullerte poster; rapport og eksport inkluderer dem med status og begrunnelse.
- Alle journalførende relasjoner som i dag bruker `onDelete: Cascade` fra bigård, kube, behandling eller produksjon, endres til `Restrict`/`NoAction` der sletting kan ødelegge retensjonspliktig historikk. Dette skal også verifiseres ved direkte Prisma-sletting i integrasjonstest.
- Hard delete av bigård
- Hard delete av kube erstattes med inaktiv status.
- Kontoavslutning må håndtere retensjonsplikt eksplisitt og skal ikke kaskadeslette beskyttede journaler uten kontrollert prosess.
- Dersom løsningen tilbys som SaaS, må kontoavslutning og personvern vurderes særskilt opp mot lovpålagt oppbevaring.

### Tester

Opprett `backend/src/__tests__/audit.test.ts`:

1. journalendring og auditpost opprettes atomisk
2. gammel og ny verdi bevares
3. hemmelige felt filtreres
4. rettelse uten begrunnelse avvises
5. auditpost kan ikke endres eller slettes via API
6. hard delete av beskyttet post returnerer korrekt feilkode

---

## 5.5 Retensjon, backup og gjenoppretting

### Krav

Opprett dokumentet:

- `Documentation/DATA-RETENTION-AND-BACKUP.md`

Det skal beskrive:

- hvilke datatyper som oppbevares
- beregning av `retentionUntil`
- backupfrekvens
- hvor database og dokumentfiler sikkerhetskopieres
- kryptering og tilgang
- hvor lenge backupene beholdes
- gjenopprettingsprosedyre
- kontroll av at vedlegg og database er konsistente
- planlagt restore-test minst kvartalsvis

### Teknisk implementering

- Legg til konfigurasjon `COMPLIANCE_RETENTION_YEARS`, minimum `5`.
- Opprett kontrollkommando/script som rapporterer:
  - poster uten `retentionUntil`
  - manglende dokumentfiler
  - avvikende SHA-256
  - foreldreløse dokumenter
  - åpne kubeplasseringer som er inkonsistente med `Hive.apiaryId`
- Scriptet skal kun rapportere som standard og aldri slette automatisk.
- Backup skal inkludere både database og opplastede dokumenter.
- Restore-test skal verifisere antall poster, dokumenthash og tilfeldig utvalgte rapporter.

Foreslått fil:

- `backend/src/scripts/verifyComplianceIntegrity.ts`

Foreslått kommando i `backend/package.json`:

```json
"compliance:verify": "tsx src/scripts/verifyComplianceIntegrity.ts"
```

### Akseptansekriterier

- Hver beskyttet post får korrekt beregnet retensjonsdato, sletting før denne datoen avvises, backup inkluderer database og vedlegg, og en dokumentert restore-test lykkes. Faktisk historisk oppbevaringstid kan først dokumenteres over tid.
- En restore-test kan gjennomføres etter skriftlig prosedyre.
- Integritetskontrollen returnerer exit code 1 ved kritiske avvik.

## 6. Fase B – helse-, biosikkerhets- og kontrolljournal

---

## 6.1 Samlet compliance-hendelse

Opprett en fleksibel, men strukturert modell:

```prisma
model ComplianceEvent {
  id                    String    @id @default(uuid())
  userId                String    @map("user_id")
  apiaryId              String?   @map("apiary_id")
  hiveId                String?   @map("hive_id")
  colonyNumber          Int?      @map("colony_number")
  eventType             String    @map("event_type")
  occurredAt            DateTime  @map("occurred_at")
  title                 String
  description           String?
  mortalityCount        Int?      @map("mortality_count")
  suspectedCause        String?   @map("suspected_cause")
  diseaseName           String?   @map("disease_name")
  diagnosisStatus       String?   @map("diagnosis_status") // suspected, confirmed, ruled_out, unknown
  sampleReference       String?   @map("sample_reference")
  sampleTakenAt         DateTime? @map("sample_taken_at")
  laboratoryName        String?   @map("laboratory_name")
  analysisType          String?   @map("analysis_type")
  analysisResult        String?   @map("analysis_result")
  resultReceivedAt      DateTime? @map("result_received_at")
  professionalName      String?   @map("professional_name")
  professionalContact   String?   @map("professional_contact")
  authorityName         String?   @map("authority_name")
  authorityReference    String?   @map("authority_reference")
  notificationRequired  Boolean?  @map("notification_required")
  notifiedAt            DateTime? @map("notified_at")
  followUpDueAt         DateTime? @map("follow_up_due_at")
  voidedAt              DateTime? @map("voided_at")
  voidReason            String?   @map("void_reason")
  retentionUntil        DateTime? @map("retention_until")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  user   User    @relation(fields: [userId], references: [id])
  apiary Apiary? @relation(fields: [apiaryId], references: [id])
  hive   Hive?   @relation(fields: [hiveId], references: [id])

  @@index([eventType, occurredAt])
  @@index([apiaryId, occurredAt])
  @@index([hiveId, occurredAt])
  @@map("compliance_events")
}
```

Tillatte `eventType` i første versjon:

- `mortality`
- `disease_suspicion`
- `biosecurity_measure`
- `cleaning_disinfection`
- `sample`
- `analysis_result`
- `animal_health_visit`
- `official_control`
- `authority_notification`
- `other`

### Hendelsesspesifikk validering

- `mortality`: krever kube/bifolk, dato og omfang eller forklaring.
- `sample`: krever prøvereferanse, prøvetakingsdato og berørt bigård/kube.
- `analysis_result`: krever analyse, resultat, resultatdato og kobling/referanse til prøve.
- `animal_health_visit`: krever dato og person/virksomhet.
- `official_control`: krever myndighet, dato og referanse eller vedlagt rapport.
- `authority_notification`: krever myndighet og varslingstidspunkt.
- `biosecurity_measure` og `cleaning_disinfection`: krever beskrivelse av utført tiltak.

### API

Opprett:

- `backend/src/routes/compliance.routes.ts` og registrering i `backend/src/routes/index.ts`
- `backend/src/__tests__/compliance.test.ts`

Endepunkter:

```http
GET  /compliance-events
GET  /compliance-events/:id
POST /compliance-events
PUT  /compliance-events/:id
POST /compliance-events/:id/void
GET  /compliance-events?hiveId=&apiaryId=&eventType=&from=&to=
```

Ingen hard delete.

### Web og mobil

Web:

- `frontend-web/src/app/(dashboard)/compliance/page.tsx`
- `frontend-web/src/components/forms/compliance-event-form.tsx`

Mobil:

- `mobile/src/app/compliance/new.tsx`

Skjemaet skal endre felt etter hendelsestype. Ved mistanke om meldepliktig sykdom skal UI vise en tydelig melding:

> Registrering i Birøkt varsler ikke Mattilsynet. Kontakt Mattilsynet umiddelbart dersom varslingsplikt kan foreligge.

Appen skal ikke automatisk sende melding til Mattilsynet uten en separat, uttrykkelig integrasjon og brukerhandling.

### Inspeksjonsintegrasjon

Fra en inspeksjon skal brukeren kunne opprette en compliance-hendelse med forhåndsutfylt kube, dato og relevante observasjoner. Dette erstatter ikke eksisterende `diseases`/`pests`, men gjør alvorlige eller oppfølgingskrevende funn etterprøvbare.

### Akseptansekriterier

- Dødelighet registreres som datert hendelse, ikke bare som kubestatus.
- Prøve og analyseresultat kan kobles gjennom referanse og dokument.
- Kontrollrapport kan lastes opp og finnes igjen på bigård/kube.
- Varslingsplikten kommuniseres tydelig uten å gi inntrykk av at appregistrering er varsling.

## 7. Fase C – mattrygghet og produksjonspartier

---

## 7.1 Produksjonsparti

Opprett:

```prisma
model ProductionBatch {
  id                 String    @id @default(uuid())
  userId             String    @map("user_id")
  batchNumber        String    @map("batch_number")
  productType        String    @map("product_type")
  harvestStartedAt   DateTime  @map("harvest_started_at")
  harvestEndedAt     DateTime? @map("harvest_ended_at")
  totalQuantityKg    Float?    @map("total_quantity_kg")
  moisturePercent    Float?    @map("moisture_percent")
  releaseStatus      String    @default("pending") @map("release_status") // pending, released, held, discarded
  releaseDecisionAt  DateTime? @map("release_decision_at")
  releaseReason      String?   @map("release_reason")
  notes              String?
  voidedAt           DateTime? @map("voided_at")
  voidReason         String?   @map("void_reason")
  retentionUntil     DateTime? @map("retention_until")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id])
  sources ProductionBatchSource[]

  @@unique([userId, batchNumber])
  @@map("production_batches")
}

model ProductionBatchSource {
  id                 String @id @default(uuid())
  productionBatchId  String @map("production_batch_id")
  productionId       String @map("production_id")
  hiveId              String @map("hive_id")
  hiveNumberSnapshot  String @map("hive_number_snapshot")
  apiaryNameSnapshot  String @map("apiary_name_snapshot")
  sourceQuantityKg    Float? @map("source_quantity_kg")

  productionBatch ProductionBatch @relation(fields: [productionBatchId], references: [id])
  production      Production      @relation(fields: [productionId], references: [id])

  @@unique([productionBatchId, productionId])
  @@map("production_batch_sources")
}
```

### Krav

- Et parti skal kunne bestå av én eller flere eksisterende `Production`-registreringer.
- Hver partikilde må kobles eksplisitt til kube og ha identitetssnapshots, også når den opprinnelige `Production` bare er registrert på bigårdsnivå. Frigivelse avvises dersom kubekildene ikke er angitt. Ingen kubekobling skal gjettes automatisk.
- Rapporten skal kontrollere relevante behandlinger og tilbakeholdelsesperioder for kildekubene.
- Brukeren skal kunne koble analyser og kontrollhendelser til partiet via dokument-/eventmekanismen.
- Frigivelsesstatus skal være eksplisitt.
- Salg bør knyttes til parti der parti brukes.
- Parti-ID skal følge eksporten.

### API

```http
GET  /production-batches
GET  /production-batches/:id
POST /production-batches
PUT  /production-batches/:id
POST /production-batches/:id/release
POST /production-batches/:id/hold
POST /production-batches/:id/discard
POST /production-batches/:id/void
```

### Akseptansekriterier

- Et honningparti kan spores tilbake til registrerte høstinger og kuber.
- Systemet varsler dersom registrert behandling overlapper med høsting eller tilbakeholdelsestid.
- Varslet skal være beslutningsstøtte, ikke automatisk faglig godkjenning.
- Analyser og kontrollrapporter kan knyttes til partiet.

## 8. Fase D – rapportering og eksport

---

## 8.1 Compliance-rapport

Opprett en egen rapporttype i tillegg til dagens sesongrapport:

```http
GET /stats/reports/compliance?from=YYYY-MM-DD&to=YYYY-MM-DD&apiaryId=&format=pdf
GET /stats/export/compliance?from=YYYY-MM-DD&to=YYYY-MM-DD&format=zip
```

Rapporten skal inneholde:

1. rapportperiode og genereringstidspunkt
2. driftsansvarlig og registrerte bigårdsopplysninger
3. liste over kuber og identitet
4. plasseringstidslinje og flyttinger
5. relevante inspeksjoner, sykdommer, skadedyr og dødelighet
6. komplett behandlingsjournal
7. biosikkerhetstiltak
8. prøver og analyser
9. dyrehelsebesøk og offentlig kontroll
10. produksjonspartier og mattrygghetsopplysninger
11. liste over dokumentvedlegg med SHA-256
12. annullerte/korrigerte poster og revisjonsinformasjon
13. datakvalitetsavvik og manglende obligatoriske opplysninger

### Full eksport

ZIP-eksporten skal inneholde:

```text
manifest.json
apiaries.csv
hives.csv
placements.csv
inspections.csv
treatments.csv
compliance-events.csv
production.csv
production-batches.csv
audit-log.csv
documents.csv
documents/<original files>
```

`manifest.json` skal inneholde:

- eksportversjon
- genereringstidspunkt
- bruker og periode
- antall poster per fil
- SHA-256 for hver eksportfil og hvert dokument
- applikasjonsversjon

### Eksisterende eksport som skal rettes

- Inspeksjons-CSV skal inkludere `diseases` og `pests`.
- Behandlings-CSV og PDF skal inkludere alle nye legemiddelfelt.
- PDF skal vise `0 dager` eksplisitt.
- Rapportsiden skal støtte egendefinert fra-/til-dato og eldre perioder, ikke bare fem kalenderår.
- Mobil trenger ikke generere PDF lokalt, men skal kunne be serveren generere og laste ned rapport.
- Teksten «Komplett oversikt over sesongen. Kan brukes for Mattilsynet.» erstattes med:

> Samlet rapport over registrerte opplysninger. Kontroller at journalen er fullstendig før den brukes som dokumentasjon.

### Datakvalitet

Rapportskjermen skal vise en kontrolliste:

- behandlinger med manglende felt
- kuber uten åpen plassering
- overlappende plasseringer
- dokumenter som mangler eller har feil hash
- compliance-hendelser som mangler påkrevde opplysninger
- produksjon uten parti, dersom partifunksjonen er aktivert
- usynkroniserte mobile registreringer

## 9. Mobil/offline – tverrgående krav

### 9.1 Rett eksisterende datatap

I offline-payload for inspeksjon skal følgende alltid bevares:

- `healthStatus`
- `varroaLevel`
- `diseases`
- `pests`
- bifolknummer
- notater
- bilder/vedleggsreferanser

Det skal legges til test som oppretter inspeksjon offline, synkroniserer den og sammenligner serverposten felt for felt.

### 9.2 Lokal datamodell

Innfør versjonerte Expo-SQLite-migreringer med `PRAGMA user_version`. Migreringene skal kjøre transaksjonelt og bruke `ALTER TABLE` eller kontrollert tabell-rebuild. Det skal finnes oppgraderingstest fra dagens databaseskjema, og eksisterende synkkø må bevares. `CREATE TABLE IF NOT EXISTS` alene er ikke en migreringsmekanisme.

Mobilens SQLite må støtte:

- kubeplasseringer
- utvidede behandlinger
- compliance-hendelser
- dokumentopplastingskø
- produksjonspartier dersom de skal opprettes i mobil
- lokal idempotensnøkkel som sendes som `Idempotency-Key`-header
- synkroniseringsstatus og siste feil

### 9.3 Konflikthåndtering

- Serveren er autoritativ for revisjons- og retensjonsregler.
- Offline-oppdateringer må ikke blindt overskrive en nyere serverversjon.
- Muterbare journalposter skal ha monoton `version Int @default(1)`, og køpayload skal inneholde `baseVersion`. Serveren gjør betinget oppdatering og returnerer `409` med klient- og serverversjon. Lokalt tidspunkt skal ikke brukes som serverversjon.
- Ved konflikt skal mobil vise begge versjoner og kreve brukerens valg eller opprette en korrigering.
- Journalposter skal aldri droppes stille.

## 10. API- og sikkerhetskrav

- Alle nye ruter skal bruke eksisterende `authenticate`-middleware.
- Tilgang skal kontrolleres via brukerens bigårdstilknytning.
- UUID-validering og body/query-validering skal bruke Zod. ISO-tidspunkt valideres eksplisitt; kalenderdato bruker `YYYY-MM-DD`. Mengder må være positive og endelige, dødelighetsantall ikke-negativt, fuktighet 0–100, koordinater innen gyldige intervaller og filer større enn 0 og under konfigurert maksimum.
- Dokumentnedlasting skal kreve autorisasjon; lagringsstier skal ikke eksponeres direkte.
- Filnavn skal saniteres.
- MIME-type og faktisk filinnhold skal kontrolleres så langt praktisk mulig.
- SHA-256 skal beregnes av serveren.
- Maksimal request- og filstørrelse skal konfigureres.
- Auditlogg må ikke inneholde passord, JWT, refresh token eller andre hemmeligheter. Påstander i UI og dokumentasjon begrenses til «revisjonsspor» og «integritetskontrollert eksport»; løsningen skal ikke omtales som manipulasjonssikker uten sterkere mekanismer.
- Batchoperasjoner skal ha øvre grense og være transaksjonelle.
- Alle listeendepunkter skal ha paginering og periodefilter.
- Alle mobile POST-mutasjoner skal sende `Idempotency-Key` og bruke den felles `IdempotencyRequest`-mekanismen. Retry etter timeout skal returnere identisk status/body uten duplikat.

## 11. Migreringsplan

### 11.1 Før migrering

1. Ta verifisert kopi av `backend/prisma/prod.db` og dokument-/bildekatalogen.
2. Registrer filstørrelse og SHA-256 på backupen.
3. Kjør eksisterende tester og bygg.
4. Dokumenter antall bigårder, kuber, inspeksjoner, behandlinger og produksjonsposter.

### 11.2 Databasemigrering

Migreringen skal:

1. legge til nye nullable felt
2. opprette nye tabeller og indekser
3. opprette initialplassering for hver eksisterende kube fra migreringstidspunktet, ikke fra `Hive.createdAt`, og merke tidligere plassering som ukjent
4. beregne `retentionUntil` for eksisterende behandlinger
5. ikke forsøke å gjette leverandør, mengde, veterinær eller tilbakeholdelsestid
6. merke historiske behandlinger som ufullstendige gjennom rapportberegning, ikke ved å fylle inn falske standardverdier
7. bevare eksisterende UUID-er og relasjoner

### 11.3 Etter migrering

Kontroller:

- samme antall eksisterende poster før og etter
- én åpen initialplassering per aktiv kube og partiell unik indeks som håndhever dette
- `Hive.apiaryId` samsvarer med åpen plassering
- alle eksisterende behandlinger kan leses
- gamle klientresponser fungerer så langt bakoverkompatibilitet er avtalt
- eksport kan genereres
- backup kan gjenopprettes i separat testmiljø

### 11.4 Utrulling

Anbefalt rekkefølge:

1. backend med bakoverkompatible nullable felt og nye ruter
2. web med nye skjemaer og rapporter
3. mobil database-/syncmigrering
4. aktiver streng validering for nye behandlinger
5. kjør datakvalitetsrapport
6. kompletter historiske behandlinger manuelt der dokumentasjon finnes
7. fjern gammel hard-delete-funksjonalitet i klientene

## 12. Test- og kvalitetskrav

### Backend

Kjør:

```bash
cd backend
npx prisma validate
npm test
npm run lint
npm run build
npm run compliance:verify
```

### Web

Kjør:

```bash
cd frontend-web
npm run lint
npm run build
```

### Mobil

Kjør:

```bash
cd mobile
npm test -- --runInBand
npm run lint
```

### Obligatoriske ende-til-ende-scenarier

1. Opprett bigård med registreringsopplysninger og GPS.
2. Opprett kube og kontroller initialplassering.
3. Flytt flere kuber midlertidig til lyngtrekk mens mobilen er offline.
4. Synkroniser og kontroller at flyttingen bare finnes én gang.
5. Registrer retur og generer plasseringstidslinje.
6. Registrer behandling av bifolk 2 i todronningkube med null dagers tilbakeholdelsestid og kvittering.
7. Kontroller at `0` vises i API, web, mobil, CSV og PDF.
8. Forsøk hard sletting av behandlingen og kontroller at det avvises.
9. Annuller behandlingen med begrunnelse og kontroller auditloggen.
10. Registrer sykdomsmistanke, prøve, analyseresultat og laboratorierapport.
11. Registrer dødelighet med dato og bifolk.
12. Opprett produksjonsparti fra flere høstinger og kontroller behandlingsvarsel.
13. Generer komplett ZIP-eksport og verifiser alle hashverdier.
14. Gjenopprett backup i separat miljø og kjør integritetskontrollen.
15. Opprett inspeksjon offline med sykdommer/skadedyr og bekreft at ingen felt går tapt.

## 13. Implementeringsrekkefølge og foreslåtte commits

### Trinn 1 – grunnmur

- migrering for auditlogg, dokumenter og nye bigårdsfelt
- audit-service og tester

Foreslått commit:

```text
feat(compliance): add audit log and apiary registration fields
```

### Trinn 2 – flyttejournal

- `HivePlacement`
- flyttetjeneste, API og backendtester
- webgrensesnitt
- mobil/offline

Foreslåtte commits:

```text
feat(placements): add hive placement history and move API
feat(web): add hive movement journal
feat(mobile): add offline hive movement workflow
```

### Trinn 3 – legemiddeljournal

- utvidet Treatment
- dokumentopplasting
- retensjonsbeskyttelse
- web og mobil

Foreslåtte commits:

```text
feat(treatments): add compliant veterinary medicine records
feat(documents): add protected compliance attachments
feat(ui): add complete treatment journal forms
```

### Trinn 4 – helse og kontroll

- `ComplianceEvent`
- API, web, mobil og dokumentkobling

Foreslått commit:

```text
feat(compliance): add health biosecurity and control events
```

### Trinn 5 – produksjonsparti

- modeller, API og rapportkobling

Foreslått commit:

```text
feat(production): add traceable honey batches
```

### Trinn 6 – rapporter, migrering og drift

- full eksport
- datakvalitetskontroll
- backup-/retensjonsdokumentasjon
- endelig integrasjonstest

Foreslåtte commits:

```text
feat(reports): add compliance report and complete archive export
docs(operations): add retention backup and restore procedures
fix(mobile): preserve health fields during offline sync
```

## 14. Definisjon av ferdig

Arbeidet er ikke ferdig før:

### 14.1 Ferdigdefinisjon for fase A

Fase A er en begrenset flytte-, legemiddel- og retensjonsjournal. Den er ferdig når:

- alle fase A-krav er implementert
- backend-, web- og mobiltester er grønne
- migrering er testet på kopi av produksjonsdatabasen
- eksisterende data er bevart og kontrollert
- en kube kan spores på alle datoer dekket av dokumentert plasseringshistorikk; eldre perioder vises som ukjent
- en behandling kan dokumenteres med alle påkrevde felt og vedlegg
- null dagers tilbakeholdelsestid fungerer i alle lag
- journalposter ikke kan slettes sporløst
- korrekt retensjonsdato beregnes, sletting før datoen avvises, backup inkluderer database og vedlegg, og restore-test lykkes
- offline-synkronisering ikke mister journaldata
- fase A-rapport og eksport for bigårder, kuber, plasseringer, anskaffelser, behandlinger, dokumenter og audit kan genereres
- restore-test er gjennomført
- produkttekstene ikke lover mer enn systemet faktisk dokumenterer

### 14.2 Ferdigdefinisjon for samlet myndighetsjournal

Samlet løsning er først ferdig når fase B–D også er implementert, full compliance-rapport/ZIP dekker alle entiteter, og ende-til-ende-scenariene for helse, kontroll og produksjonsparti består.

Fase B–D kan leveres etter fase A dersom rask juridisk minimumsforbedring prioriteres, men produktet skal da tydelig opplyse hvilke journalområder som ennå ikke er dekket.

## 15. Avgrensninger

Følgende inngår ikke i denne spesifikasjonen:

- automatisk innsending eller registrering hos Mattilsynet
- automatisk medisinsk/veterinærfaglig vurdering
- automatisk avgjørelse av om en sykdom er meldepliktig
- garanti for juridisk etterlevelse uten korrekt brukerregistrering
- lagerstyring for alle innsatsvarer utover nødvendig legemiddeldokumentasjon
- full HACCP-løsning for videreforedling utover primærproduksjon og enkel honningsporbarhet
- elektronisk signatur med kvalifisert sertifikat

## 16. Kilder og vedlikehold

Regelverk og produkttekst skal gjennomgås før offentlig lansering og deretter ved vesentlige regelendringer. Lenker:

- https://lovdata.no/dokument/SF/forskrift/2022-04-06-631
- https://lovdata.no/dokument/SF/forskrift/2022-04-07-637
- https://lovdata.no/dokument/SF/forskrift/2022-09-08-1573
- https://lovdata.no/dokument/SF/forskrift/2008-12-22-1623
- https://www.mattilsynet.no/dyr/produksjonsdyr/bier

Denne spesifikasjonen er en teknisk kravspesifikasjon basert på gjennomgått regelverk og eksisterende kode. Før Birøkt markedsføres kommersielt med konkrete påstander om regelverksetterlevelse, bør den ferdige løsningen og markedsføringsteksten kvalitetssikres juridisk/faglig.
