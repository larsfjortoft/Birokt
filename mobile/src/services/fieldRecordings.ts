import { AudioModule, RecordingPresets, setAudioModeAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { getDatabase } from './database';
import { fieldVisitsApi, uploadVisitAudio, VisitStatus } from '../lib/fieldVoice';
export interface LocalRecording {
  id: string; apiaryId: string; apiaryName: string; startedAt: string; endedAt?: string;
  uri: string; state: 'recording' | 'saved' | 'received' | 'missing'; interrupted: boolean;
  error?: string; serverStatus?: VisitStatus['status'];
}
let recorder: InstanceType<typeof AudioModule.AudioRecorder> | null = null;
let active: LocalRecording | null = null;
let busy = false;
let transfer: Promise<void> | null = null;
let finishing: Promise<LocalRecording | undefined> | null = null;
export function getFieldRecorder() {
  if (!recorder) {
    const options = { ...RecordingPresets.HIGH_QUALITY, ...RecordingPresets.HIGH_QUALITY.android, sampleRate: 44100, numberOfChannels: 1, bitRate: 64000, maxFileSize: 24 * 1024 * 1024, isMeteringEnabled: true };
    recorder = new AudioModule.AudioRecorder(options);
    recorder.addListener('recordingStatusUpdate', status => {
      if (active && !finishing && (status.hasError || status.isFinished)) void finishFieldRecording(true).catch(() => undefined);
    });
  }
  return recorder;
}
async function table() {
  const db = getDatabase();
  await db.execAsync('CREATE TABLE IF NOT EXISTS field_recordings (id TEXT PRIMARY KEY, payload TEXT NOT NULL);');
  return db;
}
async function save(item: LocalRecording) {
  const db = await table();
  await db.runAsync('INSERT OR REPLACE INTO field_recordings (id, payload) VALUES (?, ?)', item.id, JSON.stringify(item));
}
export async function listFieldRecordings(): Promise<LocalRecording[]> {
  const db = await table();
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM field_recordings ORDER BY rowid DESC');
  return rows.map(row => JSON.parse(row.payload));
}
export async function startFieldRecording(apiaryId: string, apiaryName: string) {
  if (busy || active) throw new Error('Et opptak er allerede startet.');
  busy = true;
  try {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) throw new Error('Gi mikrofontilgang for å starte opptak.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: true, interruptionMode: 'doNotMix' });
    const audio = getFieldRecorder();
    await audio.prepareToRecordAsync();
    if (!audio.uri) throw new Error('Opptakeren har ikke opprettet en lydfil.');
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
    const item: LocalRecording = { id, apiaryId, apiaryName, startedAt: new Date().toISOString(), uri: audio.uri, state: 'recording', interrupted: false };
    // Persist the native file URI before capture, for recovery after a terminated app.
    await save(item); active = item;
    audio.record();
    if (!audio.isRecording) throw new Error('Mikrofonen startet ikke.');
    return item;
  } catch (error) {
    if (active) await finishFieldRecording(true).catch(() => undefined);
    throw error;
  } finally { busy = false; }
}
async function secure(item: LocalRecording) {
  const source = new File(item.uri);
  const directory = new Directory(Paths.document, 'field-recordings');
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, `${item.id}.m4a`);
  if (!destination.exists && source.exists && source.size > 0) source.copy(destination);
  if (!destination.exists || destination.size === 0) { item.state = 'missing'; item.error = 'Opptaket ble avbrutt og lydfilen kunne ikke gjenopprettes.'; }
  else { item.uri = destination.uri; item.state = 'saved'; if (item.interrupted) item.error = 'Opptaket ble avbrutt. Den bevarte lyden kan sendes.'; }
  await save(item);
}
export async function finishFieldRecording(interrupted = false) {
  if (finishing) return finishing;
  const item = active;
  if (!item) return;
  finishing = (async () => {
    try { await getFieldRecorder().stop(); } catch { interrupted = true; }
    item.endedAt = new Date().toISOString(); item.interrupted = interrupted;
    await secure(item); active = null;
    return item;
  })().finally(() => { finishing = null; });
  return finishing;
}
export async function recoverFieldRecordings() {
  if (active) return;
  for (const item of await listFieldRecordings()) if (item.state === 'recording') {
    item.endedAt = new Date().toISOString(); item.interrupted = true; await secure(item);
  }
}
export function isFieldRecordingActive() { return !!active; }
export async function transferFieldRecordings() {
  if (transfer) return transfer;
  transfer = (async () => {
    for (const item of await listFieldRecordings()) {
      if (item.state !== 'saved' && item.state !== 'received') continue;
      try {
        let status: VisitStatus;
        if (item.state === 'saved') {
          if (!item.endedAt) continue;
          await fieldVisitsApi.create({ id: item.id, apiaryId: item.apiaryId, startedAt: item.startedAt, endedAt: item.endedAt, interrupted: item.interrupted });
          status = await uploadVisitAudio(item.id, item.uri);
          if (status.id !== item.id || !status.audioReceived) throw new Error('Mottaksbekreftelsen gjelder ikke dette opptaket.');
          item.state = 'received'; // Persist receipt; keep the local copy until a retention policy is chosen.
        } else {
          const response = await fieldVisitsApi.get(item.id);
          if (!response.data) throw new Error('Serverstatus er utilgjengelig.');
          status = response.data;
        }
        item.serverStatus = status.status; item.error = status.lastError || undefined;
        await save(item);
      } catch (error) {
        item.error = error instanceof Error ? error.message : 'Overføring feilet. Opptaket beholdes på telefonen.'; await save(item);
      }
    }
  })().finally(() => { transfer = null; });
  return transfer;
}
