# Feltbesøk med opptak og PC-gjennomgang

Implementert i kildekoden 06.10.2026. Produksjonsinstallasjon og opptak på fysisk telefon er egne verifikasjoner.

## Arbeidsflyt

1. Åpne Felt på telefonen og velg bigård.
2. Trykk Start. Telefonen tar opp hele besøket, uten løpende transkripsjon eller lydsvar.
3. Trykk Stopp. Appen kopierer opptaket til varig applagring og sender det når forbindelsen er tilgjengelig.
4. Backend bekrefter sikret mottak før besøket settes i behandlingskø.
5. Voice-proxyen transkriberer det ferdige opptaket med Hermes sin skytranskripsjon. Hermes sin konfigurerte modell lager registreringsforslag uten agentverktøy.
6. Åpne Besøk på PC. Lytt til opptaket, se original transkripsjon, rett eller avvis forslag og legg til opplysninger i ettertid.
7. Godkjenn observasjoner, utførte fôringer og oppfølginger. Godkjenning bruker samme validerte inspeksjons-/fôringsoperasjoner som ordinær innlegging. Strukturelle endringer blir avklaringer.

«Gjennomgått» og «ferdig behandlet» er separate statuser. Gjennomgang lukker ikke uløste forslag. Godkjente opplysninger kan rettes fra besøket, med bevart kilde og revisjonsspor. Oppfølging registreres i eksisterende kalender; automatisk varsling er ikke innført.

En oppfølging uten kjent dato blir stående åpen i besøket. Kalenderføring krever at du velger en dato; systemet lager ikke en frist ut fra en gjetning.

## Sikring av lyd

- Android-opptak bruker mono AAC/M4A med 64 kbit/s. Omtrent 20 minutter gir rundt 10 MB. Grensen er 24 MiB per opptak; lengre opptak kan nå denne grensen og merkes som avbrutt.
- Native opptaker lever videre ved skifte av fane. Bakgrunnsopptak er aktivert med `expo-audio` sin native konfigurasjon og forgrunnstjeneste.
- Ved Stopp kopieres filen fra opptakerens cache til `document/field-recordings/`. Besøks-ID, filadresse og status er lagret i telefonens SQLite før opptaket starter.
- Ved appkrasj forsøkes gjenoppretting av den kjente cachefilen. Den merkes som avbrutt; cache eller uferdig M4A kan ikke garanteres gjenopprettet etter alle Android-avbrudd.
- Telefonen beholder også mottatte opptak foreløpig. Automatisk sletting er utsatt til lydoppbevaring er besluttet. Følg med på ledig lagringsplass.
- Opptakskøen prøver igjen ved tilgjengelig nett og når appen åpnes. Overføring bruker samme besøks-ID. Serveren sammenligner SHA-256 og avviser en annen lydfil med samme ID.
- Serverlyd ligger i `VISIT_AUDIO_DIR`, utenfor den offentlige `uploads`-mappen, og hentes via besøks-API-et.
- Transkripsjonsfeil, ugyldig Hermes-svar og nettfeil bevarer serverlyden. «Prøv behandling igjen» behandler samme kilde. Godkjente registreringer har varig kobling til en besøksregistrering, som hindrer doble biologiske hendelser ved gjentatt godkjenning.

## Observasjoner og eldre data

Nye inspeksjoner skiller `null`/utelatt fra `false`, `0` og `healthy`. Manuelle skjemaer har ingen forhåndsvalgte funn. Dronningobservasjoner kan være ukjent, ja eller nei. Manglende rammetelling blir ikke null rammer.

Migreringen beholder eldre originalverdier. Metadata uten `observationVersion: 1` merkes som eldre, uverifisert observasjonsgrunnlag. Dette betyr at standardverdier **kan** være automatiske; vi vet ikke hvilke gamle nei-/nullverdier som faktisk ble undersøkt. De blir ikke automatisk omtolket til ukjent. Inspeksjonsvisning og eksport viser forbeholdet.

## Konfigurasjon og installasjon

Backend:

| Variabel | Bruk |
|---|---|
| `FIELD_VOICE_URL` | Voice-proxy, normalt `http://127.0.0.1:9100` på Pi |
| `VISIT_AUDIO_DIR` | Varig lydlagring, standard `data/visits` i backendens arbeidsmappe |

Ingen nye innloggings- eller flerbrukerfunksjoner er innført. Eksisterende personlig tilgang og Tailscale-oppsett videreføres. Bekreft tjenestebinding/brannmur i installasjonen.

Voice-proxyen bruker installert Hermes-miljø og konfigurasjon, uten nye AI-nøkler i klientene. `/visits/process` bruker `AIAgent(enabled_toolsets=[])` og avviser behandling hvis verktøy likevel lastes. Det ordinære Hermes API-et og eldre `/voice` er fortsatt tilgjengelige, men brukes ikke av den nye feltflyten.

Repoets aktuelle Prisma-skjema og migreringslås bruker **SQLite**. Eldre dokumentasjon beskriver PostgreSQL-oppsett; ikke kjør denne SQLite-migreringen mot PostgreSQL. Kontroller faktisk database, aktiv proxy og installert kode før oppgradering.

Ny migrering: `20261006120000_field_visits_and_unknown_observations`. Den må gjennomføres kontrollert sammen med regenerert Prisma-klient, backendbygg og webbygg. Eldre klienter som sender forhåndsvalgte funn må oppdateres samtidig med at den nye observasjonsmodellen tas i bruk.

Android krever en ny APK: `enableBackgroundRecording` er en native innstilling som ikke kan leveres bare som JavaScript-oppdatering. Etter installasjon godkjennes mikrofon/varsling og appen legges i «Aldri sovende apper» på Samsung. Expo Go er ikke tilstrekkelig som opptaksakseptprøve.

## Kontrollert oppgradering

Før produksjonsendring: bekreft faktisk database, migreringshistorikk, proxy og tjenestestier. Sikkerhetskopier SQLite konsistent, vedlegg og konfigurasjon, og prøv gjenoppretting isolert. Nye lydfiler må inngå i backup.

Følgende kommandoer gjelder etter at arbeidsmappe, database og migreringsgrunnlag er kontrollert, i backendens arbeidsmappe på Pi:

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
```

Ikke bruk `db push` mot produksjon som erstatning for avstemt migrering. Repoet hadde to eldre journalmigreringer; kontroller installasjonens migreringsstatus før videreføring. Bygg webappen med faktisk API-adresse. Oppdater aktiv voice-proxy fra repoet og restart tjenestene etter installasjonen.

Ved tilbakeføring må besøk/lyd og registreringer som er lagt inn etter overgang sikres først. En eldre backend forutsetter ikke-null observasjoner; eldre kode kan ikke uten videre brukes mot det nye skjemaet. Tilbakeføring krever avstemt database/klientversjon, og skal ikke overskrive nye registreringer med en gammel backup.

## Verifisering

Isolerte backendtester, fra `backend/`:

```bash
npm test
```

Testkjøreren overstyrer databasetilkobling til `.cache/tests/visits.test.db`, oppretter skjemaet der og sperrer destruktive tester mot andre databaser. For utvalgte tester:

```bash
npm test -- src/__tests__/visits.test.ts
```

Mobiltester og typekontroll, fra `mobile/`:

```bash
npm test -- --runInBand
npx tsc --noEmit
```

Voice-proxyens isolerte tester, fra prosjektrøtten:

```bash
python -m unittest discover -s voice-proxy -p test_voice_proxy.py
```

Automatiske tester dekker mottak, identiske/konfliktende opplastinger, skyfeil, retry, manglende observasjoner, kildekobling, godkjenning én gang, rettelser og gjenoppretting av lokal kø. Testene bruker syntetisk lyd og erstatter AI-kall.

Før vanlig feltbruk gjenstår prøve på fysisk telefon: 20 minutter i bidress med låst skjerm, innkommende samtale, nettbrudd, restart, overføring og faktisk skytranskripsjon/Hermes-svar. Mottaksbekreftelse og hele lydens varighet kontrolleres. Ingen telefon var tilkoblet under utviklingen; dette er ikke dokumentert bestått.

### Utført kontroll 6. oktober 2026

- Backend: TypeScript-bygg og alle 89 tester bestått mot isolert SQLite.
- Mobil: TypeScript-kontroll og alle 35 tester bestått.
- Voice-proxy: fire tester bestått med erstattede transkripsjons- og Hermes-kall.
- Web: produksjonsbygg bestått. Besøksgjennomgang prøvd i nettleser med syntetiske data; godkjenning opprettet én inspeksjon med kildeutdrag og ukjente funn bevart.
- Migrering: kontrollert mot isolerte eldre inspeksjonsdata; originalverdier og relasjoner bevares.
- Android: selvstendig debug-APK bygget med innebygd JavaScript. Ferdig manifest kontrollert for `RECORD_AUDIO`, `FOREGROUND_SERVICE_MICROPHONE`, `POST_NOTIFICATIONS` og mikrofontjeneste.

Lokal pakke: `.cache/artifacts/birokt-field-debug.apk` (cirka 203 MiB). SHA-256: `4f45ee62facf8d10d9b18b229f6278e8f7dc912c5e747b5e84065026782d1b88`. Pakken er ikke installert på telefon. Backend, web, database og voice-proxy er ikke oppgradert på Pi.
