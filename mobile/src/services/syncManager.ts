import NetInfo from '@react-native-community/netinfo';
import { logError } from '../lib/sentry';
import { api, apiariesApi, hivesApi, inspectionsApi, treatmentsApi, feedingsApi, productionApi } from '../lib/api';
import { isLocalId } from './database';
import {
  getPendingOperations,
  markOperationSynced,
  markOperationFailed,
  updateLocalIdToServerId,
  QueuedOperation,
} from './syncQueue';
import {
  saveApiaries,
  saveHives,
  saveInspections,
  saveTreatments,
  saveFeedings,
  saveProduction,
  getUnsyncedPhotos,
  markPhotosSynced,
  updateLastSync,
  LocalApiary,
  LocalHive,
  LocalInspection,
  LocalTreatment,
  LocalFeeding,
  LocalProduction,
} from './offlineData';

export interface SyncResult {
  success: boolean;
  syncedOperations: number;
  failedOperations: number;
  errors: string[];
}

// Check if device is online
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

// Sync all pending operations to server
export async function syncPendingOperations(): Promise<SyncResult> {
  const online = await isOnline();
  if (!online) {
    return {
      success: false,
      syncedOperations: 0,
      failedOperations: 0,
      errors: ['Device is offline'],
    };
  }

  const pendingOps = await getPendingOperations();
  let syncedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  if (__DEV__) console.log(`Syncing ${pendingOps.length} pending operations...`);

  for (const op of pendingOps) {
    try {
      await syncOperation(op);
      await markOperationSynced(op.id);
      syncedCount++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await markOperationFailed(op.id, errorMsg);
      errors.push(`${op.operation} ${op.entityType}: ${errorMsg}`);
      failedCount++;

      // Don't continue if auth error
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        break;
      }
    }
  }

  if (__DEV__) console.log(`Sync complete: ${syncedCount} synced, ${failedCount} failed`);

  try {
    await syncPendingPhotos();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown photo sync error';
    errors.push(`PHOTO: ${errorMsg}`);
    failedCount++;
  }

  return {
    success: failedCount === 0,
    syncedOperations: syncedCount,
    failedOperations: failedCount,
    errors,
  };
}

async function syncPendingPhotos(): Promise<number> {
  const photos = await getUnsyncedPhotos();
  if (photos.length === 0) return 0;

  const grouped = new Map<string, typeof photos>();

  for (const photo of photos) {
    if (!photo.inspectionId || isLocalId(photo.inspectionId)) continue;

    const key = `${photo.inspectionId}:${photo.hiveId}`;
    const existing = grouped.get(key) || [];
    existing.push(photo);
    grouped.set(key, existing);
  }

  let syncedCount = 0;

  for (const [key, groupedPhotos] of grouped.entries()) {
    const [inspectionId, hiveId] = key.split(':');
    const response = await api.uploadPhotos(
      '/photos/upload',
      groupedPhotos.map((photo) => photo.localPath),
      { inspectionId, hiveId }
    );

    await markPhotosSynced(
      groupedPhotos.map((photo) => photo.id),
      response.data?.urls
    );
    syncedCount += groupedPhotos.length;
  }

  return syncedCount;
}

// Sync a single operation
async function syncOperation(op: QueuedOperation): Promise<void> {
  const { operation, entityType, entityId, payload } = op;

  switch (entityType) {
    case 'inspection':
      await syncInspection(operation, entityId, payload);
      break;
    case 'treatment':
      await syncTreatment(operation, entityId, payload);
      break;
    case 'feeding':
      await syncFeeding(operation, entityId, payload);
      break;
    case 'production':
      await syncProduction(operation, entityId, payload);
      break;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

// Sync inspection operation
async function syncInspection(
  operation: string,
  localId: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  if (operation === 'CREATE') {
    // Check if hiveId needs to be resolved
    let hiveId = payload.hiveId as string;
    if (isLocalId(hiveId)) {
      throw new Error('Hive not yet synced, cannot create inspection');
    }

    const response = await inspectionsApi.create({
      hiveId,
      inspectionDate: payload.inspectionDate as string,
      weather: payload.weather as { temperature?: number; windSpeed?: number; condition?: string },
      assessment: payload.assessment as { strength?: string; temperament?: string; queenSeen?: boolean; queenLaying?: boolean },
      frames: payload.frames as { brood?: number; honey?: number; pollen?: number; empty?: number },
      health: payload.health as { status?: string; varroaLevel?: string },
      notes: payload.notes as string | undefined,
    });

    // Update local ID to server ID
    if (localId && response.data?.id) {
      await updateLocalIdToServerId('inspection', localId, response.data.id);
      await syncPendingPhotos();
    }
  }
}

// Sync treatment operation
async function syncTreatment(
  operation: string,
  localId: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  if (operation === 'CREATE') {
    let hiveId = payload.hiveId as string;
    if (isLocalId(hiveId)) {
      throw new Error('Hive not yet synced, cannot create treatment');
    }

    const response = await treatmentsApi.create({
      hiveId,
      treatmentDate: payload.treatmentDate as string,
      productName: payload.productName as string,
      productType: payload.productType as string | undefined,
      target: payload.target as string | undefined,
      dosage: payload.dosage as string | undefined,
      startDate: (payload.startDate as string) || new Date().toISOString(),
      endDate: payload.endDate as string | undefined,
      withholdingPeriodDays: payload.withholdingPeriodDays as number | undefined,
      notes: payload.notes as string | undefined,
    });

    if (localId && response.data?.id) {
      await updateLocalIdToServerId('treatment', localId, response.data.id);
    }
  }
}

// Sync feeding operation
async function syncFeeding(
  operation: string,
  localId: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  if (operation === 'CREATE') {
    let hiveId = payload.hiveId as string;
    if (isLocalId(hiveId)) {
      throw new Error('Hive not yet synced, cannot create feeding');
    }

    const response = await feedingsApi.create({
      hiveId,
      feedingDate: payload.feedingDate as string,
      feedType: payload.feedType as string,
      amountKg: payload.amountKg as number,
      sugarConcentration: payload.sugarConcentration as number | undefined,
      reason: payload.reason as string | undefined,
      notes: payload.notes as string | undefined,
    });

    if (localId && response.data?.id) {
      await updateLocalIdToServerId('feeding', localId, response.data.id);
    }
  }
}

// Sync production operation
async function syncProduction(
  operation: string,
  localId: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  if (operation === 'CREATE') {
    const hiveId = payload.hiveId as string | undefined;
    if (hiveId && isLocalId(hiveId)) {
      throw new Error('Hive not yet synced, cannot create production record');
    }

    const response = await productionApi.create({
      hiveId: hiveId || undefined,
      apiaryId: payload.apiaryId as string | undefined,
      harvestDate: payload.harvestDate as string,
      productType: payload.productType as string,
      honeyType: payload.honeyType as string | undefined,
      amountKg: payload.amountKg as number,
      qualityGrade: payload.qualityGrade as string | undefined,
      moistureContent: payload.moistureContent as number | undefined,
      pricePerKg: payload.pricePerKg as number | undefined,
      notes: payload.notes as string | undefined,
    });

    if (localId && response.data?.id) {
      await updateLocalIdToServerId('production', localId, response.data.id);
    }
  }
}

// Pull data from server
export async function pullFromServer(): Promise<{
  apiaries: number;
  hives: number;
  inspections: number;
  treatments: number;
  feedings: number;
  production: number;
}> {
  const online = await isOnline();
  if (!online) {
    throw new Error('Device is offline');
  }

  let apiaryCount = 0;
  let hiveCount = 0;
  let inspectionCount = 0;
  let treatmentCount = 0;
  let feedingCount = 0;
  let productionCount = 0;

  try {
    // Fetch apiaries
    const apiariesResponse = await apiariesApi.list();
    if (apiariesResponse.data) {
      const localApiaries: LocalApiary[] = apiariesResponse.data.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        locationName: a.location?.name,
        locationLat: a.location?.lat,
        locationLng: a.location?.lng,
        type: 'permanent',
        active: true,
        hiveCount: a.hiveCount,
        stats: a.stats,
        updatedAt: new Date().toISOString(),
      }));
      await saveApiaries(localApiaries);
      apiaryCount = localApiaries.length;
      await updateLastSync('apiaries');
    }

    // Fetch hives
    const hivesResponse = await hivesApi.list();
    if (hivesResponse.data) {
      const localHives: LocalHive[] = hivesResponse.data.map((h) => ({
        id: h.id,
        apiaryId: h.apiary.id,
        hiveNumber: h.hiveNumber,
        qrCode: h.qrCode,
        status: h.status,
        strength: h.strength,
        hiveType: 'langstroth',
        boxCount: 1,
        queen: {
          marked: false,
        },
        currentFrames: {
          brood: 0,
          honey: 0,
        },
        updatedAt: new Date().toISOString(),
      }));
      await saveHives(localHives);
      hiveCount = localHives.length;
      await updateLastSync('hives');
    }

    // Fetch recent inspections for each hive
    // Note: This is simplified - in production you'd want pagination
    for (const hive of (hivesResponse.data || [])) {
      try {
        const hiveDetail = await hivesApi.get(hive.id);
        if (hiveDetail.data) {
          const hiveData = hiveDetail.data as {
            inspections?: Array<{
              id: string;
              inspectionDate: string;
              temperature?: number;
              windSpeed?: number;
              weatherCondition?: string;
              strength?: string;
              temperament?: string;
              queenSeen?: boolean;
              queenLaying?: boolean;
              broodFrames?: number;
              honeyFrames?: number;
              pollenFrames?: number;
              emptyFrames?: number;
              healthStatus?: string;
              varroaLevel?: string;
              notes?: string;
            }>;
          };

          if (hiveData.inspections) {
            const localInspections: LocalInspection[] = hiveData.inspections.map((i) => ({
              id: i.id,
              hiveId: hive.id,
              inspectionDate: i.inspectionDate,
              weather: {
                temperature: i.temperature,
                windSpeed: i.windSpeed,
                condition: i.weatherCondition,
              },
              assessment: {
                strength: i.strength,
                temperament: i.temperament,
                queenSeen: i.queenSeen ?? false,
                queenLaying: i.queenLaying ?? false,
              },
              frames: {
                brood: i.broodFrames ?? 0,
                honey: i.honeyFrames ?? 0,
                pollen: i.pollenFrames ?? 0,
                empty: i.emptyFrames ?? 0,
              },
              health: {
                status: i.healthStatus ?? 'healthy',
                varroaLevel: i.varroaLevel,
              },
              notes: i.notes,
              createdAt: i.inspectionDate,
              updatedAt: i.inspectionDate,
            }));
            await saveInspections(localInspections);
            inspectionCount += localInspections.length;
          }
        }
      } catch (e) {
        if (__DEV__) console.warn(`Failed to fetch inspections for hive ${hive.id}:`, e);
      }
    }
    await updateLastSync('inspections');

    // Fetch treatments
    try {
      const treatmentsResponse = await treatmentsApi.list();
      if (treatmentsResponse.data) {
        const localTreatments: LocalTreatment[] = treatmentsResponse.data.map((t) => ({
          id: t.id,
          hiveId: t.hive.id,
          treatmentDate: t.treatmentDate,
          productName: t.productName,
          target: t.target,
          withholdingEndDate: t.withholdingEndDate,
          createdAt: t.treatmentDate,
          updatedAt: t.treatmentDate,
        }));
        await saveTreatments(localTreatments);
        treatmentCount = localTreatments.length;
        await updateLastSync('treatments');
      }
    } catch (e) {
      if (__DEV__) console.warn('Failed to fetch treatments:', e);
    }

    // Fetch feedings
    try {
      const feedingsResponse = await feedingsApi.list();
      if (feedingsResponse.data) {
        const localFeedings: LocalFeeding[] = feedingsResponse.data.map((f) => ({
          id: f.id,
          hiveId: f.hive.id,
          feedingDate: f.feedingDate,
          feedType: f.feedType,
          amountKg: f.amountKg,
          createdAt: f.feedingDate,
          updatedAt: f.feedingDate,
        }));
        await saveFeedings(localFeedings);
        feedingCount = localFeedings.length;
        await updateLastSync('feedings');
      }
    } catch (e) {
      if (__DEV__) console.warn('Failed to fetch feedings:', e);
    }

    // Fetch production
    try {
      const productionResponse = await productionApi.list();
      if (productionResponse.data) {
        const localProduction: LocalProduction[] = productionResponse.data.map((p) => ({
          id: p.id,
          harvestDate: p.harvestDate,
          productType: p.productType,
          amountKg: p.amountKg,
          createdAt: p.harvestDate,
          updatedAt: p.harvestDate,
        }));
        await saveProduction(localProduction);
        productionCount = localProduction.length;
        await updateLastSync('production');
      }
    } catch (e) {
      if (__DEV__) console.warn('Failed to fetch production:', e);
    }
  } catch (error) {
    logError(error, { context: 'pullFromServer' });
    throw error;
  }

  return {
    apiaries: apiaryCount,
    hives: hiveCount,
    inspections: inspectionCount,
    treatments: treatmentCount,
    feedings: feedingCount,
    production: productionCount,
  };
}

// Full sync: push pending, then pull fresh data
export async function fullSync(): Promise<{
  push: SyncResult;
  pull: { apiaries: number; hives: number; inspections: number; treatments: number; feedings: number; production: number };
}> {
  // First push pending operations
  const pushResult = await syncPendingOperations();

  // Then pull fresh data (only if push was at least partially successful)
  const pullResult = await pullFromServer();

  return {
    push: pushResult,
    pull: pullResult,
  };
}
