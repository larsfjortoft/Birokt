import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

// Birøkt is a personal, single-user installation. The shared authentication
// middleware attaches requests without a token to that one local user.
router.use(authenticate);

const resources = [
  { name: 'apiaries', path: '/apiaries', operations: ['list', 'get', 'create', 'update', 'delete'], description: 'Apiaries and locations' },
  { name: 'hives', path: '/hives', operations: ['list', 'get', 'create', 'update', 'delete', 'getByQr'], description: 'Hives, status and queen details' },
  { name: 'inspections', path: '/inspections', operations: ['list', 'get', 'create', 'update', 'delete', 'uploadPhotos'], description: 'Hive inspections' },
  { name: 'treatments', path: '/treatments', operations: ['list', 'get', 'create', 'update', 'delete'], description: 'Treatments and varroa control' },
  { name: 'feedings', path: '/feedings', operations: ['list', 'get', 'create', 'update', 'delete'], description: 'Feedings' },
  { name: 'production', path: '/production', operations: ['list', 'get', 'create', 'update', 'delete'], description: 'Harvest and production' },
  { name: 'queens', path: '/queens', operations: ['list', 'get', 'create', 'update', 'delete', 'move'], description: 'Queen breeding and moves' },
  { name: 'calendar', path: '/calendar', operations: ['list', 'get', 'create', 'update', 'delete', 'sync'], description: 'Beekeeping events' },
  { name: 'journal', path: '/journal', operations: ['list', 'get', 'create', 'update', 'delete'], description: 'Season journal' },
  { name: 'photos', path: '/photos', operations: ['list', 'upload', 'delete'], description: 'Photos and attachments' },
  { name: 'notifications', path: '/notifications', operations: ['getSettings', 'updateSettings'], description: 'Notification settings' },
  { name: 'stats', path: '/stats', operations: ['overview', 'actionsNeeded', 'hive', 'charts', 'exportCsv', 'reportPdf'], description: 'Dashboard and reports' },
  { name: 'weather', path: '/weather', operations: ['current', 'forecast'], description: 'Weather for an apiary location' },
  { name: 'search', path: '/search', operations: ['search'], description: 'Cross-domain search' },
] as const;

function skillMarkdown(baseUrl: string): string {
  return `---
name: birokt
description: "Operate the personal Birøkt web application through its local API."
version: 1.0.0
author: Birøkt
metadata:
  hermes:
    tags: [beekeeping, local-api, raspberry-pi]
---

# Birøkt

Use this skill to read and operate Birøkt on the Raspberry Pi. This is a personal,
single-user installation; no login or API token is required from Hermes on the Pi.

## API

Base URL: \`${baseUrl}\`

Discover the current API before a non-trivial task:

\`\`\`bash
curl -s ${baseUrl}/agent/manifest
\`\`\`

All responses use \`{ success, data, meta }\`. Send JSON with
\`Content-Type: application/json\`.

## Working rules

- Read the relevant apiary, hive or record before updating it.
- Resolve names to IDs with \`GET /apiaries\`, \`GET /hives\`, or \`GET /search?q=...\`.
- Create, update and delete actions change the same data shown in the web and mobile apps.
- Never delete records unless the user explicitly asks. Report the created or changed record afterwards.
- Use ISO dates, for example \`2026-06-21\`.

## Examples

\`\`\`bash
# Overview and lookup
curl -s ${baseUrl}/stats/overview
curl -s '${baseUrl}/search?q=Innom%20Elva'

# Create an inspection after resolving HIVE_ID
curl -s -X POST ${baseUrl}/inspections \\
  -H 'Content-Type: application/json' \\
  -d '{"hiveId":"HIVE_ID","inspectionDate":"2026-06-21","healthStatus":"healthy","strength":"medium"}'

# List action items
curl -s ${baseUrl}/stats/actions-needed
\`\`\`

For all resources and supported operations, read \`/agent/manifest\`.
`;
}

// Machine-readable capability catalogue for agents and skills.
router.get('/manifest', (req: Request, res: Response) => {
  const baseUrl = `${req.protocol}://${req.get('host')}/api/v1`;
  sendSuccess(res, {
    name: 'Birøkt Agent API',
    version: 'v1',
    baseUrl,
    authentication: 'Local single-user access on the Raspberry Pi; no token required.',
    responseFormat: '{ success, data, meta }',
    resources,
    conventions: {
      list: 'GET {path}',
      get: 'GET {path}/:id',
      create: 'POST {path} with JSON body',
      update: 'PUT {path}/:id with JSON body',
      delete: 'DELETE {path}/:id',
      search: 'GET /search?q=<text>&limit=<1-20>',
    },
  });
});

// A Hermes-compatible starter skill. Hermes can save this directly and extend it
// with task-specific routines while keeping the API contract above as its source.
router.get('/skill', (req: Request, res: Response) => {
  const baseUrl = `${req.protocol}://${req.get('host')}/api/v1`;
  res.type('text/markdown').send(skillMarkdown(baseUrl));
});

export default router;
