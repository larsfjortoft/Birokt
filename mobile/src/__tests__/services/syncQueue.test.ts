import { initDatabase, getDatabase } from '../../services/database';

const mockDb = (global as unknown as { __mockDb: {
  runAsync: jest.Mock;
  getAllAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  execAsync: jest.Mock;
} }).__mockDb;

beforeEach(async () => {
  jest.clearAllMocks();
  // Initialize the database (uses mocked expo-sqlite)
  await initDatabase();
});

describe('Sync Queue', () => {
  describe('queueOperation', () => {
    it('should insert operation into sync_queue table', async () => {
      const { queueOperation } = require('../../services/syncQueue');

      mockDb.runAsync.mockResolvedValueOnce({ lastInsertRowId: 42, changes: 1 });

      const id = await queueOperation('CREATE', 'inspection', 'local_123', {
        hiveId: 'hive_1',
        notes: 'Test inspection',
      });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.arrayContaining(['CREATE', 'inspection', 'local_123', expect.any(String)])
      );
      expect(id).toBe(42);
    });
  });

  describe('getPendingOperations', () => {
    it('should return unsynced operations in creation order', async () => {
      const { getPendingOperations } = require('../../services/syncQueue');

      mockDb.getAllAsync.mockResolvedValueOnce([
        {
          id: 1,
          operation: 'CREATE',
          entity_type: 'inspection',
          entity_id: 'local_1',
          payload: JSON.stringify({ hiveId: 'h1' }),
          created_at: '2024-01-01T00:00:00Z',
          attempts: 0,
          last_error: null,
          synced_at: null,
        },
        {
          id: 2,
          operation: 'CREATE',
          entity_type: 'treatment',
          entity_id: 'local_2',
          payload: JSON.stringify({ hiveId: 'h1', productName: 'Oxalic' }),
          created_at: '2024-01-01T00:01:00Z',
          attempts: 0,
          last_error: null,
          synced_at: null,
        },
      ]);

      const ops = await getPendingOperations();

      expect(ops).toHaveLength(2);
      expect(ops[0].operation).toBe('CREATE');
      expect(ops[0].entityType).toBe('inspection');
      expect(ops[0].payload).toEqual({ hiveId: 'h1' });
      expect(ops[1].entityType).toBe('treatment');
    });
  });

  describe('markOperationSynced', () => {
    it('should update synced_at and optionally entity_id', async () => {
      const { markOperationSynced } = require('../../services/syncQueue');

      await markOperationSynced(1, 'server_abc');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sync_queue'),
        expect.arrayContaining(['server_abc', 1])
      );
    });
  });

  describe('getPendingCount', () => {
    it('should return count of unsynced operations', async () => {
      const { getPendingCount } = require('../../services/syncQueue');

      mockDb.getFirstAsync.mockResolvedValueOnce({ count: 5 });

      const count = await getPendingCount();
      expect(count).toBe(5);
    });

    it('should return 0 when no pending operations', async () => {
      const { getPendingCount } = require('../../services/syncQueue');

      mockDb.getFirstAsync.mockResolvedValueOnce({ count: 0 });

      const count = await getPendingCount();
      expect(count).toBe(0);
    });
  });
});
