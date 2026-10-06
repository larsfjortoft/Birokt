import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import { testRequest, createTestUser, loginTestUser, createTestApiary, createTestHive, TestUser } from './helpers.js';
import { prisma } from './setup.js';
import { processNextVisit } from '../services/visitService.js';
import { exportInspectionsCsv } from '../services/csvExport.js';

describe('Completed field visits', () => {
  let user: TestUser; let apiary: { id: string }; let hive: { id: string };
  const headers = () => ({ Authorization: `Bearer ${user.accessToken}` });
  const originalFetch = global.fetch;
  beforeEach(async () => {
    user = await loginTestUser(await createTestUser()); apiary = await createTestApiary(user); hive = await createTestHive(apiary);
  });
  afterEach(() => { global.fetch = originalFetch; });
  async function visitWithAudio() {
    const id = randomUUID();
    const body = { id, apiaryId: apiary.id, startedAt: '2026-10-06T08:00:00.000Z', endedAt: '2026-10-06T08:20:00.000Z', interrupted: false };
    await testRequest.post('/api/v1/visits').set(headers()).send(body).expect(201);
    await testRequest.post('/api/v1/visits').set(headers()).send(body).expect(200);
    const result = await testRequest.post(`/api/v1/visits/${id}/audio`).set(headers()).attach('audio', Buffer.from('fixture audio'), { filename: 'visit.m4a', contentType: 'audio/mp4' }).expect(200);
    expect(result.body.data).toMatchObject({ audioReceived: true, status: 'queued' });
    expect(result.body.data.audioPath).toBeUndefined();
    return id;
  }
  it('keeps identical uploads idempotent and rejects a different recording', async () => {
    const id = await visitWithAudio();
    await testRequest.post(`/api/v1/visits/${id}/audio`).set(headers()).attach('audio', Buffer.from('fixture audio'), { filename: 'again.m4a', contentType: 'audio/mp4' }).expect(200);
    await testRequest.post(`/api/v1/visits/${id}/audio`).set(headers()).attach('audio', Buffer.from('other audio'), { filename: 'other.m4a', contentType: 'audio/mp4' }).expect(409);
    expect(await prisma.fieldVisit.count()).toBe(1);
    const visit = await prisma.fieldVisit.findUniqueOrThrow({ where: { id } });
    expect((await fs.readFile(visit.audioPath!)).toString()).toBe('fixture audio');
  });
  it('processes after receipt, preserves unknown findings, and accepts once', async () => {
    const id = await visitWithAudio();
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ transcript: 'Kube 1. Egg observert.', summary: 'Egg i kube 1.', entries: [{ kind: 'inspection', hiveId: hive.id, sourceText: 'Egg observert.', payload: { inspectionDate: '2026-10-06T08:10:00.000Z', assessment: { queenLaying: true }, notes: 'Egg observert.' } }] }), { status: 200 }));
    await processNextVisit();
    const result = await testRequest.get(`/api/v1/visits/${id}`).set(headers()).expect(200);
    expect(result.body.data.status).toBe('ready'); expect(await prisma.inspection.count()).toBe(0);
    const entry = result.body.data.entries[0];
    for (let i = 0; i < 2; i++) await testRequest.post(`/api/v1/visits/${id}/entries/${entry.id}/accept`).set(headers()).send({ version: entry.version }).expect(200);
    expect(await prisma.inspection.count()).toBe(1);
    const inspection = await prisma.inspection.findFirstOrThrow();
    expect(inspection).toMatchObject({ queenSeen: null, queenLaying: true, broodFrames: null, healthStatus: null });
    expect(JSON.parse(inspection.metadata).source).toMatchObject({ visitId: id, entryId: entry.id });
    expect(await exportInspectionsCsv(user.id)).toContain('Ukjent');
  });
  it('retains audio on a cloud error and retries without duplicate entries', async () => {
    const id = await visitWithAudio();
    global.fetch = jest.fn().mockRejectedValue(new Error('cloud unavailable')); await processNextVisit();
    let visit = await prisma.fieldVisit.findUniqueOrThrow({ where: { id } });
    expect(visit.status).toBe('failed'); expect(await fs.stat(visit.audioPath!)).toBeTruthy();
    await testRequest.post(`/api/v1/visits/${id}/retry`).set(headers()).expect(200);
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ transcript: 'Kube 1.', summary: 'Ingen observasjoner.', entries: [] }), { status: 200 }));
    await processNextVisit(); await processNextVisit();
    visit = await prisma.fieldVisit.findUniqueOrThrow({ where: { id } });
    expect(visit.status).toBe('ready'); expect(await prisma.visitEntry.count()).toBe(0);
  });
  it('preserves source when corrected and does not accept stale edits', async () => {
    const id = await visitWithAudio();
    const entry = await prisma.visitEntry.create({ data: { visitId: id, kind: 'inspection', hiveId: hive.id, sourceText: 'Kube 1, ikke sett dronning.', payload: JSON.stringify({ inspectionDate: '2026-10-06T08:10:00.000Z', assessment: { queenSeen: false } }) } });
    await testRequest.put(`/api/v1/visits/${id}/entries/${entry.id}`).set(headers()).send({ version: 1, kind: 'inspection', hiveId: hive.id, payload: { inspectionDate: '2026-10-06T08:10:00.000Z', notes: 'Tillegg hjemme.', assessment: { queenSeen: false } } }).expect(200);
    await testRequest.post(`/api/v1/visits/${id}/entries/${entry.id}/accept`).set(headers()).send({ version: 1 }).expect(409);
    expect((await prisma.visitEntry.findUniqueOrThrow({ where: { id: entry.id } })).sourceText).toBe(entry.sourceText);
    expect(await prisma.auditLog.count({ where: { entityId: entry.id, action: 'correct' } })).toBe(1);
  });
  it('turns invented excerpts or unknown hive IDs into clarification', async () => {
    const id = await visitWithAudio();
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ transcript: 'Kube 1.', summary: 'Avklaring.', entries: [{ kind: 'inspection', hiveId: randomUUID(), sourceText: 'Frisk kube.', payload: {} }] }), { status: 200 }));
    await processNextVisit();
    const entry = await prisma.visitEntry.findFirstOrThrow(); expect(entry).toMatchObject({ kind: 'clarification', hiveId: null, sourceText: '' });
    await testRequest.post(`/api/v1/visits/${id}/entries/${entry.id}/accept`).set(headers()).send({ version: 1 }).expect(409);
  });
  it('records an executed feeding once, using the validated feeding operation', async () => {
    const id = await visitWithAudio();
    const result = await testRequest.post(`/api/v1/visits/${id}/entries`).set(headers()).send({ kind: 'feeding', hiveId: hive.id, sourceText: '', payload: { feedingDate: '2026-10-05T15:00:00.000Z', feedType: 'fondant', amountKg: 2 } }).expect(201);
    for (let i = 0; i < 2; i++) await testRequest.post(`/api/v1/visits/${id}/entries/${result.body.data.id}/accept`).set(headers()).send({ version: 1 }).expect(200);
    expect(await prisma.feeding.count()).toBe(1); expect((await prisma.feeding.findFirstOrThrow()).feedingDate.toISOString()).toBe('2026-10-05T15:00:00.000Z');
  });
  it('denies another user access to audio and visit details', async () => {
    const id = await visitWithAudio(); const other = await loginTestUser(await createTestUser());
    await testRequest.get(`/api/v1/visits/${id}`).set('Authorization', `Bearer ${other.accessToken}`).expect(409);
    await testRequest.get(`/api/v1/visits/${id}/audio`).set('Authorization', `Bearer ${other.accessToken}`).expect(409);
  });
  it('keeps undated follow-up open without inventing a calendar deadline', async () => {
    const id = await visitWithAudio();
    const entry = await prisma.visitEntry.create({ data: { visitId: id, kind: 'followup', hiveId: hive.id, sourceText: 'Fôre senere.', payload: JSON.stringify({ title: 'Fôre senere' }) } });
    await testRequest.post(`/api/v1/visits/${id}/entries/${entry.id}/accept`).set(headers()).send({ version: 1 }).expect(409);
    expect(await prisma.calendarEvent.count()).toBe(0);
    expect((await prisma.visitEntry.findUniqueOrThrow({ where: { id: entry.id } })).state).toBe('pending');
  });
  it('corrects an accepted observation without replacing its source or creating another event', async () => {
    const id = await visitWithAudio();
    const entry = await prisma.visitEntry.create({ data: { visitId: id, kind: 'inspection', hiveId: hive.id, sourceText: 'Egg i kube 1.', payload: JSON.stringify({ inspectionDate: '2026-10-06T08:10:00.000Z', assessment: { queenLaying: true } }) } });
    const accepted = await testRequest.post(`/api/v1/visits/${id}/entries/${entry.id}/accept`).set(headers()).send({ version: 1 }).expect(200);
    await testRequest.put(`/api/v1/visits/${id}/entries/${entry.id}`).set(headers()).send({ version: accepted.body.data.version, state: 'accepted', kind: 'inspection', hiveId: hive.id, payload: { inspectionDate: '2026-10-06T08:10:00.000Z', assessment: { queenLaying: null, queenSeen: false }, frames: { honey: 0 }, notes: 'Rettet på PC.' } }).expect(200);
    expect(await prisma.inspection.count()).toBe(1);
    expect(await prisma.inspection.findFirstOrThrow()).toMatchObject({ queenLaying: null, queenSeen: false, honeyFrames: 0, notes: 'Rettet på PC.' });
    expect((await prisma.visitEntry.findUniqueOrThrow({ where: { id: entry.id } })).sourceText).toBe('Egg i kube 1.');
    expect(await prisma.auditLog.count({ where: { entityType: 'Inspection', action: 'correct' } })).toBe(1);
  });
});
