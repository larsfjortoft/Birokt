const mockRecords = new Map<string, string>();
const mockFiles = new Map<string, number>();
const mockUpload = jest.fn();
const mockCreate = jest.fn();
const mockGet = jest.fn();
const mockPermission = jest.fn();
const mockRecorder = { uri: 'file:///cache/recording.m4a', isRecording: false, addListener: jest.fn(), prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn() };
jest.mock('../../services/database', () => ({ getDatabase: () => ({
  execAsync: jest.fn(),
  runAsync: (_query: string, id: string, payload: string) => { mockRecords.set(id, payload); return Promise.resolve(); },
  getAllAsync: () => Promise.resolve([...mockRecords.values()].map(payload => ({ payload }))),
}) }));
jest.mock('../../lib/fieldVoice', () => ({ fieldVisitsApi: { create: (...args: unknown[]) => mockCreate(...args), get: (...args: unknown[]) => mockGet(...args) }, uploadVisitAudio: (...args: unknown[]) => mockUpload(...args) }));
jest.mock('expo-audio', () => ({ AudioModule: { AudioRecorder: jest.fn(() => mockRecorder) }, RecordingPresets: { HIGH_QUALITY: { android: { outputFormat: 'mpeg4', audioEncoder: 'aac' } } }, setAudioModeAsync: jest.fn(), requestRecordingPermissionsAsync: () => mockPermission() }));
jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///documents' },
  Directory: class { uri: string; constructor(root: string, child: string) { this.uri = `${root}/${child}`; } create() {} },
  File: class {
    uri: string;
    constructor(root: string | { uri: string }, child?: string) { this.uri = child ? `${typeof root === 'string' ? root : root.uri}/${child}` : String(root); }
    get exists() { return mockFiles.has(this.uri); }
    get size() { return mockFiles.get(this.uri) || 0; }
    copy(destination: { uri: string }) { mockFiles.set(destination.uri, this.size); }
  },
}));

describe('Durable whole-visit recordings', () => {
  beforeEach(() => {
    jest.resetModules(); mockRecords.clear(); mockFiles.clear(); jest.clearAllMocks();
    mockFiles.set(mockRecorder.uri, 1024);
    mockPermission.mockResolvedValue({ granted: true });
    mockRecorder.isRecording = false;
    mockRecorder.record.mockImplementation(() => { mockRecorder.isRecording = true; });
    mockRecorder.stop.mockImplementation(async () => { mockRecorder.isRecording = false; });
    mockCreate.mockResolvedValue({ data: { id: 'unused' } });
  });
  it('does not send audio until stopped and persists a document copy', async () => {
    const service = require('../../services/fieldRecordings');
    const recording = await service.startFieldRecording('apiary-id', 'Bigård');
    expect(mockUpload).not.toHaveBeenCalled(); expect(JSON.parse(mockRecords.get(recording.id)!).state).toBe('recording');
    await service.finishFieldRecording();
    const saved = JSON.parse(mockRecords.get(recording.id)!);
    expect(saved.state).toBe('saved'); expect(saved.uri).toContain('/documents/field-recordings/'); expect(mockFiles.has(saved.uri)).toBe(true);
  });
  it('keeps a failed transfer and retries the same visit and audio', async () => {
    const service = require('../../services/fieldRecordings');
    const item = await service.startFieldRecording('apiary-id', 'Bigård'); await service.finishFieldRecording();
    mockUpload.mockRejectedValueOnce(new Error('network unavailable')); await service.transferFieldRecordings();
    expect(JSON.parse(mockRecords.get(item.id)!).state).toBe('saved');
    mockUpload.mockResolvedValueOnce({ id: item.id, audioReceived: true, status: 'queued' }); await service.transferFieldRecordings();
    const saved = JSON.parse(mockRecords.get(item.id)!);
    expect(saved.state).toBe('received'); expect(mockFiles.has(saved.uri)).toBe(true);
    expect(mockUpload.mock.calls[0][0]).toBe(item.id); expect(mockUpload.mock.calls[1][0]).toBe(item.id);
  });
  it('recovers after app termination and marks the source interrupted', async () => {
    let service = require('../../services/fieldRecordings');
    const item = await service.startFieldRecording('apiary-id', 'Bigård');
    jest.resetModules(); service = require('../../services/fieldRecordings'); await service.recoverFieldRecordings();
    const saved = JSON.parse(mockRecords.get(item.id)!); expect(saved).toMatchObject({ interrupted: true, state: 'saved' });
  });
  it('refuses recording without permission', async () => {
    mockPermission.mockResolvedValue({ granted: false });
    const service = require('../../services/fieldRecordings');
    await expect(service.startFieldRecording('id', 'Bigård')).rejects.toThrow('mikrofontilgang'); expect(mockRecords.size).toBe(0);
  });
});
