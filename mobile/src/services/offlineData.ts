import { getDatabase, generateLocalId } from './database';
import { queueOperation } from './syncQueue';

// ==================== APIARIES ====================

export interface LocalApiary {
  id: string;
  name: string;
  description?: string;
  locationName?: string;
  locationLat?: number;
  locationLng?: number;
  type: string;
  active: boolean;
  hiveCount: number;
  stats: { healthy: number; warning: number; critical: number };
  syncedAt?: string;
  updatedAt: string;
}

export async function getApiaries(): Promise<LocalApiary[]> {
  const db = getDatabase();

  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    description: string | null;
    location_name: string | null;
    location_lat: number | null;
    location_lng: number | null;
    type: string;
    active: number;
    hive_count: number;
    stats_healthy: number;
    stats_warning: number;
    stats_critical: number;
    synced_at: string | null;
    updated_at: string;
  }>('SELECT * FROM apiaries WHERE active = 1 ORDER BY name ASC');

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    locationName: row.location_name ?? undefined,
    locationLat: row.location_lat ?? undefined,
    locationLng: row.location_lng ?? undefined,
    type: row.type,
    active: row.active === 1,
    hiveCount: row.hive_count,
    stats: {
      healthy: row.stats_healthy,
      warning: row.stats_warning,
      critical: row.stats_critical,
    },
    syncedAt: row.synced_at ?? undefined,
    updatedAt: row.updated_at,
  }));
}

export async function getApiary(id: string): Promise<LocalApiary | null> {
  const db = getDatabase();

  const row = await db.getFirstAsync<{
    id: string;
    name: string;
    description: string | null;
    location_name: string | null;
    location_lat: number | null;
    location_lng: number | null;
    type: string;
    active: number;
    hive_count: number;
    stats_healthy: number;
    stats_warning: number;
    stats_critical: number;
    synced_at: string | null;
    updated_at: string;
  }>('SELECT * FROM apiaries WHERE id = ?', [id]);

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    locationName: row.location_name ?? undefined,
    locationLat: row.location_lat ?? undefined,
    locationLng: row.location_lng ?? undefined,
    type: row.type,
    active: row.active === 1,
    hiveCount: row.hive_count,
    stats: {
      healthy: row.stats_healthy,
      warning: row.stats_warning,
      critical: row.stats_critical,
    },
    syncedAt: row.synced_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

export async function saveApiaries(apiaries: LocalApiary[]): Promise<void> {
  const db = getDatabase();

  for (const apiary of apiaries) {
    await db.runAsync(
      `INSERT OR REPLACE INTO apiaries
       (id, name, description, location_name, location_lat, location_lng, type, active,
        hive_count, stats_healthy, stats_warning, stats_critical, synced_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        apiary.id,
        apiary.name,
        apiary.description ?? null,
        apiary.locationName ?? null,
        apiary.locationLat ?? null,
        apiary.locationLng ?? null,
        apiary.type,
        apiary.active ? 1 : 0,
        apiary.hiveCount,
        apiary.stats.healthy,
        apiary.stats.warning,
        apiary.stats.critical,
      ]
    );
  }
}

// ==================== HIVES ====================

export interface LocalHive {
  id: string;
  apiaryId: string;
  hiveNumber: string;
  qrCode?: string;
  status: string;
  strength?: string;
  hiveType: string;
  boxCount: number;
  queen: {
    year?: number;
    marked: boolean;
    color?: string;
    race?: string;
  };
  currentFrames: {
    brood: number;
    honey: number;
  };
  notes?: string;
  syncedAt?: string;
  updatedAt: string;
}

export async function getHives(apiaryId?: string): Promise<LocalHive[]> {
  const db = getDatabase();

  const query = apiaryId
    ? 'SELECT * FROM hives WHERE apiary_id = ? ORDER BY hive_number ASC'
    : 'SELECT * FROM hives ORDER BY hive_number ASC';

  const params = apiaryId ? [apiaryId] : [];

  const rows = await db.getAllAsync<{
    id: string;
    apiary_id: string;
    hive_number: string;
    qr_code: string | null;
    status: string;
    strength: string | null;
    hive_type: string;
    box_count: number;
    queen_year: number | null;
    queen_marked: number;
    queen_color: string | null;
    queen_race: string | null;
    current_brood_frames: number;
    current_honey_frames: number;
    notes: string | null;
    synced_at: string | null;
    updated_at: string;
  }>(query, params);

  return rows.map((row) => ({
    id: row.id,
    apiaryId: row.apiary_id,
    hiveNumber: row.hive_number,
    qrCode: row.qr_code ?? undefined,
    status: row.status,
    strength: row.strength ?? undefined,
    hiveType: row.hive_type,
    boxCount: row.box_count,
    queen: {
      year: row.queen_year ?? undefined,
      marked: row.queen_marked === 1,
      color: row.queen_color ?? undefined,
      race: row.queen_race ?? undefined,
    },
    currentFrames: {
      brood: row.current_brood_frames,
      honey: row.current_honey_frames,
    },
    notes: row.notes ?? undefined,
    syncedAt: row.synced_at ?? undefined,
    updatedAt: row.updated_at,
  }));
}

export async function getHive(id: string): Promise<LocalHive | null> {
  const db = getDatabase();

  const row = await db.getFirstAsync<{
    id: string;
    apiary_id: string;
    hive_number: string;
    qr_code: string | null;
    status: string;
    strength: string | null;
    hive_type: string;
    box_count: number;
    queen_year: number | null;
    queen_marked: number;
    queen_color: string | null;
    queen_race: string | null;
    current_brood_frames: number;
    current_honey_frames: number;
    notes: string | null;
    synced_at: string | null;
    updated_at: string;
  }>('SELECT * FROM hives WHERE id = ?', [id]);

  if (!row) return null;

  return {
    id: row.id,
    apiaryId: row.apiary_id,
    hiveNumber: row.hive_number,
    qrCode: row.qr_code ?? undefined,
    status: row.status,
    strength: row.strength ?? undefined,
    hiveType: row.hive_type,
    boxCount: row.box_count,
    queen: {
      year: row.queen_year ?? undefined,
      marked: row.queen_marked === 1,
      color: row.queen_color ?? undefined,
      race: row.queen_race ?? undefined,
    },
    currentFrames: {
      brood: row.current_brood_frames,
      honey: row.current_honey_frames,
    },
    notes: row.notes ?? undefined,
    syncedAt: row.synced_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

export async function getHiveByQrCode(qrCode: string): Promise<LocalHive | null> {
  const db = getDatabase();

  const row = await db.getFirstAsync<{
    id: string;
    apiary_id: string;
    hive_number: string;
    qr_code: string | null;
    status: string;
    strength: string | null;
    hive_type: string;
    box_count: number;
    queen_year: number | null;
    queen_marked: number;
    queen_color: string | null;
    queen_race: string | null;
    current_brood_frames: number;
    current_honey_frames: number;
    notes: string | null;
    synced_at: string | null;
    updated_at: string;
  }>('SELECT * FROM hives WHERE qr_code = ?', [qrCode]);

  if (!row) return null;

  return {
    id: row.id,
    apiaryId: row.apiary_id,
    hiveNumber: row.hive_number,
    qrCode: row.qr_code ?? undefined,
    status: row.status,
    strength: row.strength ?? undefined,
    hiveType: row.hive_type,
    boxCount: row.box_count,
    queen: {
      year: row.queen_year ?? undefined,
      marked: row.queen_marked === 1,
      color: row.queen_color ?? undefined,
      race: row.queen_race ?? undefined,
    },
    currentFrames: {
      brood: row.current_brood_frames,
      honey: row.current_honey_frames,
    },
    notes: row.notes ?? undefined,
    syncedAt: row.synced_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

export async function saveHives(hives: LocalHive[]): Promise<void> {
  const db = getDatabase();

  for (const hive of hives) {
    await db.runAsync(
      `INSERT OR REPLACE INTO hives
       (id, apiary_id, hive_number, qr_code, status, strength, hive_type, box_count,
        queen_year, queen_marked, queen_color, queen_race, current_brood_frames,
        current_honey_frames, notes, synced_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        hive.id,
        hive.apiaryId,
        hive.hiveNumber,
        hive.qrCode ?? null,
        hive.status,
        hive.strength ?? null,
        hive.hiveType,
        hive.boxCount,
        hive.queen.year ?? null,
        hive.queen.marked ? 1 : 0,
        hive.queen.color ?? null,
        hive.queen.race ?? null,
        hive.currentFrames.brood,
        hive.currentFrames.honey,
        hive.notes ?? null,
      ]
    );
  }
}

// ==================== INSPECTIONS ====================

export interface LocalInspection {
  id: string;
  hiveId: string;
  inspectionDate: string;
  weather: {
    temperature?: number;
    windSpeed?: number;
    condition?: string;
  };
  assessment: {
    strength?: string;
    temperament?: string;
    queenSeen: boolean;
    queenLaying: boolean;
  };
  frames: {
    brood: number;
    honey: number;
    pollen: number;
    empty: number;
  };
  health: {
    status: string;
    varroaLevel?: string;
  };
  notes?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getInspections(hiveId: string, limit: number = 20): Promise<LocalInspection[]> {
  const db = getDatabase();

  const rows = await db.getAllAsync<{
    id: string;
    hive_id: string;
    inspection_date: string;
    temperature: number | null;
    wind_speed: number | null;
    weather_condition: string | null;
    strength: string | null;
    temperament: string | null;
    queen_seen: number;
    queen_laying: number;
    brood_frames: number;
    honey_frames: number;
    pollen_frames: number;
    empty_frames: number;
    health_status: string;
    varroa_level: string | null;
    notes: string | null;
    synced_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT * FROM inspections
     WHERE hive_id = ?
     ORDER BY inspection_date DESC
     LIMIT ?`,
    [hiveId, limit]
  );

  return rows.map((row) => ({
    id: row.id,
    hiveId: row.hive_id,
    inspectionDate: row.inspection_date,
    weather: {
      temperature: row.temperature ?? undefined,
      windSpeed: row.wind_speed ?? undefined,
      condition: row.weather_condition ?? undefined,
    },
    assessment: {
      strength: row.strength ?? undefined,
      temperament: row.temperament ?? undefined,
      queenSeen: row.queen_seen === 1,
      queenLaying: row.queen_laying === 1,
    },
    frames: {
      brood: row.brood_frames,
      honey: row.honey_frames,
      pollen: row.pollen_frames,
      empty: row.empty_frames,
    },
    health: {
      status: row.health_status,
      varroaLevel: row.varroa_level ?? undefined,
    },
    notes: row.notes ?? undefined,
    syncedAt: row.synced_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createInspection(
  inspection: Omit<LocalInspection, 'id' | 'syncedAt' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = getDatabase();
  const id = generateLocalId();

  await db.runAsync(
    `INSERT INTO inspections
     (id, hive_id, inspection_date, temperature, wind_speed, weather_condition,
      strength, temperament, queen_seen, queen_laying, brood_frames, honey_frames,
      pollen_frames, empty_frames, health_status, varroa_level, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      inspection.hiveId,
      inspection.inspectionDate,
      inspection.weather.temperature ?? null,
      inspection.weather.windSpeed ?? null,
      inspection.weather.condition ?? null,
      inspection.assessment.strength ?? null,
      inspection.assessment.temperament ?? null,
      inspection.assessment.queenSeen ? 1 : 0,
      inspection.assessment.queenLaying ? 1 : 0,
      inspection.frames.brood,
      inspection.frames.honey,
      inspection.frames.pollen,
      inspection.frames.empty,
      inspection.health.status,
      inspection.health.varroaLevel ?? null,
      inspection.notes ?? null,
    ]
  );

  // Update hive's current frames
  await db.runAsync(
    `UPDATE hives
     SET current_brood_frames = ?, current_honey_frames = ?,
         strength = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [
      inspection.frames.brood,
      inspection.frames.honey,
      inspection.assessment.strength ?? null,
      inspection.hiveId,
    ]
  );

  // Queue for sync
  await queueOperation('CREATE', 'inspection', id, {
    hiveId: inspection.hiveId,
    inspectionDate: inspection.inspectionDate,
    weather: inspection.weather,
    assessment: inspection.assessment,
    frames: inspection.frames,
    health: inspection.health,
    notes: inspection.notes,
  });

  return id;
}

export async function saveInspections(inspections: LocalInspection[]): Promise<void> {
  const db = getDatabase();

  for (const inspection of inspections) {
    await db.runAsync(
      `INSERT OR REPLACE INTO inspections
       (id, hive_id, inspection_date, temperature, wind_speed, weather_condition,
        strength, temperament, queen_seen, queen_laying, brood_frames, honey_frames,
        pollen_frames, empty_frames, health_status, varroa_level, notes,
        synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))`,
      [
        inspection.id,
        inspection.hiveId,
        inspection.inspectionDate,
        inspection.weather.temperature ?? null,
        inspection.weather.windSpeed ?? null,
        inspection.weather.condition ?? null,
        inspection.assessment.strength ?? null,
        inspection.assessment.temperament ?? null,
        inspection.assessment.queenSeen ? 1 : 0,
        inspection.assessment.queenLaying ? 1 : 0,
        inspection.frames.brood,
        inspection.frames.honey,
        inspection.frames.pollen,
        inspection.frames.empty,
        inspection.health.status,
        inspection.health.varroaLevel ?? null,
        inspection.notes ?? null,
        inspection.createdAt,
      ]
    );
  }
}

// ==================== TREATMENTS ====================

export interface LocalTreatment {
  id: string;
  hiveId: string;
  treatmentDate: string;
  productName: string;
  productType?: string;
  target?: string;
  dosage?: string;
  startDate?: string;
  endDate?: string;
  withholdingPeriodDays?: number;
  withholdingEndDate?: string;
  notes?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getTreatments(hiveId: string, limit: number = 20): Promise<LocalTreatment[]> {
  const db = getDatabase();

  const rows = await db.getAllAsync<{
    id: string;
    hive_id: string;
    treatment_date: string;
    product_name: string;
    product_type: string | null;
    target: string | null;
    dosage: string | null;
    start_date: string | null;
    end_date: string | null;
    withholding_period_days: number | null;
    withholding_end_date: string | null;
    notes: string | null;
    synced_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT * FROM treatments WHERE hive_id = ? ORDER BY treatment_date DESC LIMIT ?`,
    [hiveId, limit]
  );

  return rows.map((row) => ({
    id: row.id,
    hiveId: row.hive_id,
    treatmentDate: row.treatment_date,
    productName: row.product_name,
    productType: row.product_type ?? undefined,
    target: row.target ?? undefined,
    dosage: row.dosage ?? undefined,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    withholdingPeriodDays: row.withholding_period_days ?? undefined,
    withholdingEndDate: row.withholding_end_date ?? undefined,
    notes: row.notes ?? undefined,
    syncedAt: row.synced_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createTreatment(
  treatment: Omit<LocalTreatment, 'id' | 'syncedAt' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = getDatabase();
  const id = generateLocalId();

  await db.runAsync(
    `INSERT INTO treatments
     (id, hive_id, treatment_date, product_name, product_type, target, dosage,
      start_date, end_date, withholding_period_days, withholding_end_date, notes,
      created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      treatment.hiveId,
      treatment.treatmentDate,
      treatment.productName,
      treatment.productType ?? null,
      treatment.target ?? null,
      treatment.dosage ?? null,
      treatment.startDate ?? null,
      treatment.endDate ?? null,
      treatment.withholdingPeriodDays ?? null,
      treatment.withholdingEndDate ?? null,
      treatment.notes ?? null,
    ]
  );

  await queueOperation('CREATE', 'treatment', id, {
    hiveId: treatment.hiveId,
    treatmentDate: treatment.treatmentDate,
    productName: treatment.productName,
    productType: treatment.productType,
    target: treatment.target,
    dosage: treatment.dosage,
    startDate: treatment.startDate,
    endDate: treatment.endDate,
    withholdingPeriodDays: treatment.withholdingPeriodDays,
    notes: treatment.notes,
  });

  return id;
}

export async function saveTreatments(treatments: LocalTreatment[]): Promise<void> {
  const db = getDatabase();

  for (const t of treatments) {
    await db.runAsync(
      `INSERT OR REPLACE INTO treatments
       (id, hive_id, treatment_date, product_name, product_type, target, dosage,
        start_date, end_date, withholding_period_days, withholding_end_date, notes,
        synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))`,
      [
        t.id,
        t.hiveId,
        t.treatmentDate,
        t.productName,
        t.productType ?? null,
        t.target ?? null,
        t.dosage ?? null,
        t.startDate ?? null,
        t.endDate ?? null,
        t.withholdingPeriodDays ?? null,
        t.withholdingEndDate ?? null,
        t.notes ?? null,
        t.createdAt,
      ]
    );
  }
}

// ==================== FEEDINGS ====================

export interface LocalFeeding {
  id: string;
  hiveId: string;
  feedingDate: string;
  feedType: string;
  amountKg: number;
  sugarConcentration?: number;
  reason?: string;
  notes?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getFeedings(hiveId: string, limit: number = 20): Promise<LocalFeeding[]> {
  const db = getDatabase();

  const rows = await db.getAllAsync<{
    id: string;
    hive_id: string;
    feeding_date: string;
    feed_type: string;
    amount_kg: number;
    sugar_concentration: number | null;
    reason: string | null;
    notes: string | null;
    synced_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT * FROM feedings WHERE hive_id = ? ORDER BY feeding_date DESC LIMIT ?`,
    [hiveId, limit]
  );

  return rows.map((row) => ({
    id: row.id,
    hiveId: row.hive_id,
    feedingDate: row.feeding_date,
    feedType: row.feed_type,
    amountKg: row.amount_kg,
    sugarConcentration: row.sugar_concentration ?? undefined,
    reason: row.reason ?? undefined,
    notes: row.notes ?? undefined,
    syncedAt: row.synced_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createFeeding(
  feeding: Omit<LocalFeeding, 'id' | 'syncedAt' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = getDatabase();
  const id = generateLocalId();

  await db.runAsync(
    `INSERT INTO feedings
     (id, hive_id, feeding_date, feed_type, amount_kg, sugar_concentration, reason, notes,
      created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      feeding.hiveId,
      feeding.feedingDate,
      feeding.feedType,
      feeding.amountKg,
      feeding.sugarConcentration ?? null,
      feeding.reason ?? null,
      feeding.notes ?? null,
    ]
  );

  await queueOperation('CREATE', 'feeding', id, {
    hiveId: feeding.hiveId,
    feedingDate: feeding.feedingDate,
    feedType: feeding.feedType,
    amountKg: feeding.amountKg,
    sugarConcentration: feeding.sugarConcentration,
    reason: feeding.reason,
    notes: feeding.notes,
  });

  return id;
}

export async function saveFeedings(feedings: LocalFeeding[]): Promise<void> {
  const db = getDatabase();

  for (const f of feedings) {
    await db.runAsync(
      `INSERT OR REPLACE INTO feedings
       (id, hive_id, feeding_date, feed_type, amount_kg, sugar_concentration, reason, notes,
        synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))`,
      [
        f.id,
        f.hiveId,
        f.feedingDate,
        f.feedType,
        f.amountKg,
        f.sugarConcentration ?? null,
        f.reason ?? null,
        f.notes ?? null,
        f.createdAt,
      ]
    );
  }
}

// ==================== PRODUCTION ====================

export interface LocalProduction {
  id: string;
  hiveId?: string;
  apiaryId?: string;
  harvestDate: string;
  productType: string;
  honeyType?: string;
  amountKg: number;
  qualityGrade?: string;
  moistureContent?: number;
  pricePerKg?: number;
  totalRevenue?: number;
  notes?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getProduction(hiveId?: string, limit: number = 20): Promise<LocalProduction[]> {
  const db = getDatabase();

  const query = hiveId
    ? 'SELECT * FROM production WHERE hive_id = ? ORDER BY harvest_date DESC LIMIT ?'
    : 'SELECT * FROM production ORDER BY harvest_date DESC LIMIT ?';
  const params = hiveId ? [hiveId, limit] : [limit];

  const rows = await db.getAllAsync<{
    id: string;
    hive_id: string | null;
    apiary_id: string | null;
    harvest_date: string;
    product_type: string;
    honey_type: string | null;
    amount_kg: number;
    quality_grade: string | null;
    moisture_content: number | null;
    price_per_kg: number | null;
    total_revenue: number | null;
    notes: string | null;
    synced_at: string | null;
    created_at: string;
    updated_at: string;
  }>(query, params);

  return rows.map((row) => ({
    id: row.id,
    hiveId: row.hive_id ?? undefined,
    apiaryId: row.apiary_id ?? undefined,
    harvestDate: row.harvest_date,
    productType: row.product_type,
    honeyType: row.honey_type ?? undefined,
    amountKg: row.amount_kg,
    qualityGrade: row.quality_grade ?? undefined,
    moistureContent: row.moisture_content ?? undefined,
    pricePerKg: row.price_per_kg ?? undefined,
    totalRevenue: row.total_revenue ?? undefined,
    notes: row.notes ?? undefined,
    syncedAt: row.synced_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createProduction(
  production: Omit<LocalProduction, 'id' | 'syncedAt' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = getDatabase();
  const id = generateLocalId();

  const totalRevenue =
    production.pricePerKg && production.amountKg
      ? production.pricePerKg * production.amountKg
      : null;

  await db.runAsync(
    `INSERT INTO production
     (id, hive_id, apiary_id, harvest_date, product_type, honey_type, amount_kg,
      quality_grade, moisture_content, price_per_kg, total_revenue, notes,
      created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      production.hiveId ?? null,
      production.apiaryId ?? null,
      production.harvestDate,
      production.productType,
      production.honeyType ?? null,
      production.amountKg,
      production.qualityGrade ?? null,
      production.moistureContent ?? null,
      production.pricePerKg ?? null,
      totalRevenue,
      production.notes ?? null,
    ]
  );

  await queueOperation('CREATE', 'production', id, {
    hiveId: production.hiveId,
    apiaryId: production.apiaryId,
    harvestDate: production.harvestDate,
    productType: production.productType,
    honeyType: production.honeyType,
    amountKg: production.amountKg,
    qualityGrade: production.qualityGrade,
    moistureContent: production.moistureContent,
    pricePerKg: production.pricePerKg,
    notes: production.notes,
  });

  return id;
}

export async function saveProduction(productions: LocalProduction[]): Promise<void> {
  const db = getDatabase();

  for (const p of productions) {
    await db.runAsync(
      `INSERT OR REPLACE INTO production
       (id, hive_id, apiary_id, harvest_date, product_type, honey_type, amount_kg,
        quality_grade, moisture_content, price_per_kg, total_revenue, notes,
        synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))`,
      [
        p.id,
        p.hiveId ?? null,
        p.apiaryId ?? null,
        p.harvestDate,
        p.productType,
        p.honeyType ?? null,
        p.amountKg,
        p.qualityGrade ?? null,
        p.moistureContent ?? null,
        p.pricePerKg ?? null,
        p.totalRevenue ?? null,
        p.notes ?? null,
        p.createdAt,
      ]
    );
  }
}

// ==================== UTILITY FUNCTIONS ====================

// Clear all local data (for logout)
export async function clearAllLocalData(): Promise<void> {
  const db = getDatabase();

  await db.execAsync(`
    DELETE FROM photos;
    DELETE FROM production;
    DELETE FROM feedings;
    DELETE FROM treatments;
    DELETE FROM inspections;
    DELETE FROM hives;
    DELETE FROM apiaries;
    DELETE FROM sync_queue;
    DELETE FROM sync_metadata;
  `);
}

// Get sync status
export async function getSyncStatus(): Promise<{
  lastSync: string | null;
  pendingOperations: number;
}> {
  const db = getDatabase();

  const lastSyncResult = await db.getFirstAsync<{ last_sync: string }>(
    `SELECT MAX(last_sync) as last_sync FROM sync_metadata`
  );

  const pendingResult = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE synced_at IS NULL`
  );

  return {
    lastSync: lastSyncResult?.last_sync ?? null,
    pendingOperations: pendingResult?.count ?? 0,
  };
}

// Update last sync timestamp
export async function updateLastSync(entityType: string): Promise<void> {
  const db = getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO sync_metadata (entity_type, last_sync)
     VALUES (?, datetime('now'))`,
    [entityType]
  );
}
