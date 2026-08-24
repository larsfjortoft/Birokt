# Hermes-integrasjon

Hermes pa Raspberry Pi kan styre Birokt gjennom samme API som web- og mobilappen.
Agenten arbeider derfor alltid pa de faktiske bigardene, kubene og registreringene.

## API

| Endepunkt | Formal |
|---|---|
| `GET /api/v1/agent/manifest` | Maskinlesbar oversikt over alle tilgjengelige omrader og operasjoner |
| `GET /api/v1/agent/skill` | Ferdig Hermes-skill i Markdown |
| `/api/v1/apiaries`, `/hives`, `/inspections`, osv. | Selve CRUD-operasjonene |

Pa Pi brukes `http://127.0.0.1:3100/api/v1`. Ingen token skal legges i skillen;
Birokt er en personlig en-bruker-installasjon og API-et knytter lokale foresporsler
til den ene brukeren.

### Dronninger og to-dronningkuber

- `POST /api/v1/queens` og `POST /api/v1/queens/:id/move` stotter na `currentColonyNumber`
  for plassering i `double_queen`-kuber.
- For vanlige kuber brukes alltid bifolk `1`.
- Hvis valgt kubeplass allerede har en dronning, ma Hermes sende:
  - `replaceExisting: true`
  - `replacementAction: "remove"` for a ta den ut av kuben
  - eller `replacementAction: "dead"` for a markere den som dod

```bash
curl -s -X POST http://127.0.0.1:3100/api/v1/queens \
  -H 'Content-Type: application/json' \
  -d '{"queenCode":"S26-12","year":2026,"status":"laying","currentHiveId":"HIVE_ID","currentColonyNumber":2,"replaceExisting":true,"replacementAction":"remove"}'

curl -s -X POST http://127.0.0.1:3100/api/v1/queens/QUEEN_ID/move \
  -H 'Content-Type: application/json' \
  -d '{"hiveId":"HIVE_ID","currentColonyNumber":1,"replaceExisting":true,"replacementAction":"dead","date":"2026-06-27T12:00:00.000Z","reason":"Dronningbytte"}'
```

## Installer eller oppdater skillen pa Pi

```bash
mkdir -p ~/.hermes/skills/domain/birokt
curl -fsS http://127.0.0.1:3100/api/v1/agent/skill \
  -o ~/.hermes/skills/domain/birokt/SKILL.md
```

Start Hermes pa nytt etter installasjon. Hermes kan bruke skillen som grunnlag for
egne rutiner, men skal alltid lese `/agent/manifest` for nye eller sammensatte
oppgaver.

## Feltmodus med stemme

Mobilappen kan sende lydklipp til en liten voice-proxy pa Pi:

| Tjeneste | Port | Formal |
|---|---:|---|
| `birokt-voice-proxy` | `9100` | Tar imot lyd fra appen, transkriberer, sender tekst til Hermes og returnerer TTS-svar |
| Hermes API Server | `8642` | OpenAI-kompatibelt internt endpoint for Hermes |

Flyt:

1. Appen lytter i Felt-fanen og stopper et klipp etter ca. 1,5 sekund stillhet.
2. Appen sender `multipart/form-data` til `POST http://openclaw.tail586d8a.ts.net:9100/voice`.
3. Proxyen sender lyd direkte til OpenAI `gpt-4o-transcribe` med `language=no`, sender teksten til Hermes API Server, lager norsk TTS og returnerer JSON.

Appen kan overstyres med:

```bash
EXPO_PUBLIC_FIELD_VOICE_URL=http://openclaw.tail586d8a.ts.net:9100
```

## Eksempel

```bash
curl -s http://127.0.0.1:3100/api/v1/stats/actions-needed
curl -s 'http://127.0.0.1:3100/api/v1/search?q=Innom%20Elva'
```

Sletting skal bare utfores nar brukeren eksplisitt har bedt om det.
