# Dataoppbevaring, backup og gjenoppretting

## Omfang og retensjon

Myndighetsjournalen omfatter bigårder, kuber, plasseringer, inspeksjoner, legemiddelanskaffelser og behandlinger, helse-/kontrollhendelser, produksjonspartier, revisjonslogg og dokumentvedlegg. Standard oppbevaring er fem kalenderår. `COMPLIANCE_RETENTION_YEARS` kan økes, men ikke settes lavere enn `5`.

For behandling beregnes `retentionUntil` fra behandlingsslutt, ellers behandlingsstart. En rettelse kan flytte datoen frem, aldri tilbake. 29. februar normaliseres til siste gyldige dag i februar. Retensjon innebærer at både database og dokumentfiler må kunne gjenopprettes.

## Backup

- Ta kryptert backup minst daglig og før hver migrering.
- Inkluder SQLite-databasen og hele katalogen angitt av `COMPLIANCE_DOCUMENT_DIR`.
- Lagre backupen på et annet fysisk/systemmessig sted med tilgang begrenset til driftsansvarlig.
- Behold daglige kopier i minst 30 dager og periodiske kopier så lenge den lengste aktive retensjonsdatoen krever det.
- Registrer størrelse og SHA-256 for databasearkivet og vedleggsarkivet.

Eksempel fra `backend`:

```powershell
$stamp = Get-Date -Format yyyyMMdd-HHmmss
Copy-Item -LiteralPath prisma/prisma/dev.db -Destination "backup/database-$stamp.db"
Compress-Archive -LiteralPath uploads/compliance -DestinationPath "backup/documents-$stamp.zip"
Get-FileHash -Algorithm SHA256 backup/*
```

Bruk produksjonens faktiske databasebane og en kryptert backupdestinasjon. Ikke legg backup eller hemmeligheter i Git.

## Gjenoppretting

1. Opprett et separat, isolert testmiljø.
2. Verifiser SHA-256 før utpakking.
3. Gjenopprett databasen og dokumentkatalogen med samme relative konfigurasjon.
4. Kjør `npm ci`, `npx prisma migrate deploy` og `npm run compliance:verify`.
5. Sammenlign antall bigårder, kuber, inspeksjoner, behandlinger, produksjonsposter og dokumenter med backupjournalen.
6. Generer PDF og ZIP for minst to tilfeldig valgte perioder og verifiser manifest-hashene.
7. Dokumenter resultat, avvik og ansvarlig.

Restore-test gjennomføres minst kvartalsvis og etter vesentlige endringer i backupoppsettet. Integritetskommandoen rapporterer bare; den sletter eller reparerer aldri automatisk.
