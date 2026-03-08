import { getDatabase, isLocalId } from './database';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';
export type EntityType = 'apiary' | 'hive' | 'inspection' | 'photo' | 'treatment' | 'feeding' | 'production';

export interface QueuedOperation {
  id: number;
  operation: SyncOperation;
  entityType: EntityType;
  entityId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  syncedAt: string | null;
}

// Add operation to sync queue
export async function queueOperation(
  operation: SyncOperation,
  entityType: EntityType,
  entityId: string | null,
  payload: Record<string, unknown>
): Promise<number> {
  const db = getDatabase();

  const result = await db.runAsync(
    `INSERT INTO sync_queue (operation, entity_type, entity_id, payload, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [operation, entityType, entityId, JSON.stringify(payload)]
  );

  if (__DEV__) console.log(`Queued ${operation} ${entityType} operation`, { entityId });
  return result.lastInsertRowId;
}

// Get pending operations
export async function getPendingOperations(): Promise<QueuedOperation[]> {
  const db = getDatabase();

  const rows = await db.getAllAsync<{
    id: number;
    operation: string;
    entity_type: string;
    entity_id: string | null;
    payload: string;
    created_at: string;
    attempts: number;
    last_error: string | null;
    synced_at: string | null;
  }>(
    `SELECT * FROM sync_queue
     WHERE synced_at IS NULL
     ORDER BY created_at ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    operation: row.operation as SyncOperation,
    entityType: row.entity_type as EntityType,
    entityId: row.entity_id,
    payload: JSON.parse(row.payload),
    createdAt: row.created_at,
    attempts: row.attempts,
    lastError: row.last_error,
    syncedAt: row.synced_at,
  }));
}

// Get count of pending operations
export async function getPendingCount(): Promise<number> {
  const db = getDatabase();

  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sync_queue WHERE synced_at IS NULL'
  );

  return result?.count ?? 0;
}

// Mark operation as synced
export async function markOperationSynced(
  queueId: number,
  newEntityId?: string
): Promise<void> {
  const db = getDatabase();

  await db.runAsync(
    `UPDATE sync_queue
     SET synced_at = datetime('now'), entity_id = COALESCE(?, entity_id)
     WHERE id = ?`,
    [newEntityId ?? null, queueId]
  );
}

// Mark operation as failed
export async function markOperationFailed(
  queueId: number,
  error: string
): Promise<void> {
  const db = getDatabase();

  await db.runAsync(
    `UPDATE sync_queue
     SET attempts = attempts + 1, last_error = ?
     WHERE id = ?`,
    [error, queueId]
  );
}

// Remove old synced operations (cleanup)
export async function cleanupSyncedOperations(olderThanDays: number = 7): Promise<number> {
  const db = getDatabase();

  const result = await db.runAsync(
    `DELETE FROM sync_queue
     WHERE synced_at IS NOT NULL
     AND synced_at < datetime('now', '-' || ? || ' days')`,
    [olderThanDays]
  );

  return result.changes;
}

// Update local entity ID to server ID after sync
export async function updateLocalIdToServerId(
  entityType: EntityType,
  localId: string,
  serverId: string
): Promise<void> {
  const db = getDatabase();
  const tableName = getTableName(entityType);

  // Update the entity's ID
  await db.runAsync(
    `UPDATE ${tableName} SET id = ?, synced_at = datetime('now') WHERE id = ?`,
    [serverId, localId]
  );

  // Update foreign keys in related tables
  if (entityType === 'apiary') {
    await db.runAsync(
      'UPDATE hives SET apiary_id = ? WHERE apiary_id = ?',
      [serverId, localId]
    );
  } else if (entityType === 'hive') {
    await db.runAsync(
      'UPDATE inspections SET hive_id = ? WHERE hive_id = ?',
      [serverId, localId]
    );
    await db.runAsync(
      'UPDATE photos SET hive_id = ? WHERE hive_id = ?',
      [serverId, localId]
    );
  } else if (entityType === 'inspection') {
    await db.runAsync(
      'UPDATE photos SET inspection_id = ? WHERE inspection_id = ?',
      [serverId, localId]
    );
  }

  // Update sync queue references
  await db.runAsync(
    `UPDATE sync_queue SET entity_id = ?
     WHERE entity_type = ? AND entity_id = ?`,
    [serverId, entityType, localId]
  );

  // Update payload references in sync queue for related operations
  if (entityType === 'apiary') {
    await db.runAsync(
      `UPDATE sync_queue
       SET payload = REPLACE(payload, '"apiaryId":"${localId}"', '"apiaryId":"${serverId}"')
       WHERE synced_at IS NULL`
    );
  } else if (entityType === 'hive') {
    await db.runAsync(
      `UPDATE sync_queue
       SET payload = REPLACE(payload, '"hiveId":"${localId}"', '"hiveId":"${serverId}"')
       WHERE synced_at IS NULL`
    );
  }
}

function getTableName(entityType: EntityType): string {
  const tables: Record<EntityType, string> = {
    apiary: 'apiaries',
    hive: 'hives',
    inspection: 'inspections',
    photo: 'photos',
    treatment: 'treatments',
    feeding: 'feedings',
    production: 'production',
  };
  return tables[entityType];
}
