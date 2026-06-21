# Hermes-integrasjon

Hermes på Raspberry Pi kan styre Birøkt gjennom samme API som web- og mobilappen.
Agenten arbeider derfor alltid på de faktiske bigårdene, kubene og registreringene.

## API

| Endepunkt | Formål |
|---|---|
| `GET /api/v1/agent/manifest` | Maskinlesbar oversikt over alle tilgjengelige områder og operasjoner |
| `GET /api/v1/agent/skill` | Ferdig Hermes-skill i Markdown |
| `/api/v1/apiaries`, `/hives`, `/inspections`, osv. | Selve CRUD-operasjonene |

På Pi brukes `http://127.0.0.1:3100/api/v1`. Ingen token skal legges i skillen;
Birøkt er en personlig én-bruker-installasjon og API-et knytter lokale forespørsler
til den ene brukeren.

## Installer eller oppdater skillen på Pi

```bash
mkdir -p ~/.hermes/skills/domain/birokt
curl -fsS http://127.0.0.1:3100/api/v1/agent/skill \
  -o ~/.hermes/skills/domain/birokt/SKILL.md
```

Start Hermes på nytt etter installasjon. Hermes kan bruke skillen som grunnlag for
egne rutiner, men skal alltid lese `/agent/manifest` før nye eller sammensatte
oppgaver.

## Eksempel

```bash
curl -s http://127.0.0.1:3100/api/v1/stats/actions-needed
curl -s 'http://127.0.0.1:3100/api/v1/search?q=Innom%20Elva'
```

Sletting skal bare utføres når brukeren eksplisitt har bedt om det.
