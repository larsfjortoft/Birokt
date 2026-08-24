import * as SQLite from 'expo-sqlite';

// Database instance
let db: SQLite.SQLiteDatabase | null = null;

// Initialize database
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('birokt.db');

  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Create tables
  await db.execAsync(`
    -- Sync queue for offline operations
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      synced_at TEXT
    );

    -- Apiaries table
    CREATE TABLE IF NOT EXISTS apiaries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      location_name TEXT,
      location_lat REAL,
      location_lng REAL,
      type TEXT DEFAULT 'permanent',
      active INTEGER DEFAULT 1,
      hive_count INTEGER DEFAULT 0,
      stats_healthy INTEGER DEFAULT 0,
      stats_warning INTEGER DEFAULT 0,
      stats_critical INTEGER DEFAULT 0,
      synced_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Hives table
    CREATE TABLE IF NOT EXISTS hives (
      id TEXT PRIMARY KEY,
      apiary_id TEXT NOT NULL,
      hive_number TEXT NOT NULL,
      qr_code TEXT UNIQUE,
      status TEXT DEFAULT 'active',
      strength TEXT,
      hive_type TEXT DEFAULT 'langstroth',
      box_count INTEGER DEFAULT 1,
      queen_year INTEGER,
      queen_marked INTEGER DEFAULT 0,
      queen_color TEXT,
      queen_race TEXT,
      current_brood_frames INTEGER DEFAULT 0,
      current_honey_frames INTEGER DEFAULT 0,
      notes TEXT,
      synced_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (apiary_id) REFERENCES apiaries(id) ON DELETE CASCADE
    );

    -- Inspections table
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      hive_id TEXT NOT NULL,
      inspection_date TEXT NOT NULL,
      temperature REAL,
      wind_speed REAL,
      weather_condition TEXT,
      strength TEXT,
      temperament TEXT,
      queen_seen INTEGER DEFAULT 0,
      queen_laying INTEGER DEFAULT 0,
      brood_frames INTEGER DEFAULT 0,
      honey_frames INTEGER DEFAULT 0,
      pollen_frames INTEGER DEFAULT 0,
      empty_frames INTEGER DEFAULT 0,
      health_status TEXT DEFAULT 'healthy',
      varroa_level TEXT,
      notes TEXT,
      synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE CASCADE
    );

    -- Photos table (stores metadata, actual files in filesystem)
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      inspection_id TEXT,
      hive_id TEXT NOT NULL,
      local_path TEXT NOT NULL,
      remote_url TEXT,
      caption TEXT,
      synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
      FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE CASCADE
    );

    -- Treatments table
    CREATE TABLE IF NOT EXISTS treatments (
      id TEXT PRIMARY KEY,
      hive_id TEXT NOT NULL,
      treatment_date TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_type TEXT,
      target TEXT,
      dosage TEXT,
      start_date TEXT,
      end_date TEXT,
      withholding_period_days INTEGER,
      withholding_end_date TEXT,
      notes TEXT,
      synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE CASCADE
    );

    -- Feedings table
    CREATE TABLE IF NOT EXISTS feedings (
      id TEXT PRIMARY KEY,
      hive_id TEXT NOT NULL,
      feeding_date TEXT NOT NULL,
      feed_type TEXT NOT NULL,
      amount_kg REAL NOT NULL,
      sugar_concentration REAL,
      reason TEXT,
      notes TEXT,
      synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE CASCADE
    );

    -- Production table
    CREATE TABLE IF NOT EXISTS production (
      id TEXT PRIMARY KEY,
      hive_id TEXT,
      apiary_id TEXT,
      harvest_date TEXT NOT NULL,
      product_type TEXT NOT NULL,
      honey_type TEXT,
      amount_kg REAL NOT NULL,
      quality_grade TEXT,
      moisture_content REAL,
      price_per_kg REAL,
      total_revenue REAL,
      notes TEXT,
      synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE CASCADE,
      FOREIGN KEY (apiary_id) REFERENCES apiaries(id) ON DELETE CASCADE
    );

    -- Last sync timestamp per entity type
    CREATE TABLE IF NOT EXISTS sync_metadata (
      entity_type TEXT PRIMARY KEY,
      last_sync TEXT NOT NULL
    );

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_hives_apiary ON hives(apiary_id);
    CREATE INDEX IF NOT EXISTS idx_inspections_hive ON inspections(hive_id);
    CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections(inspection_date DESC);
    CREATE INDEX IF NOT EXISTS idx_photos_inspection ON photos(inspection_id);
    CREATE INDEX IF NOT EXISTS idx_treatments_hive ON treatments(hive_id);
    CREATE INDEX IF NOT EXISTS idx_treatments_date ON treatments(treatment_date DESC);
    CREATE INDEX IF NOT EXISTS idx_feedings_hive ON feedings(hive_id);
    CREATE INDEX IF NOT EXISTS idx_feedings_date ON feedings(feeding_date DESC);
    CREATE INDEX IF NOT EXISTS idx_production_hive ON production(hive_id);
    CREATE INDEX IF NOT EXISTS idx_production_date ON production(harvest_date DESC);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(synced_at) WHERE synced_at IS NULL;
  `);

  // Versioned, transactional migrations. CREATE TABLE IF NOT EXISTS above only
  // establishes the legacy baseline; schema evolution is governed by user_version.
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = versionRow?.user_version ?? 0;
  if (version < 1) {
    await db.execAsync(`
      BEGIN IMMEDIATE;
      ALTER TABLE inspections ADD COLUMN diseases TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE inspections ADD COLUMN pests TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE inspections ADD COLUMN colony_number INTEGER;
      ALTER TABLE inspections ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE treatments ADD COLUMN scope TEXT DEFAULT 'whole_hive';
      ALTER TABLE treatments ADD COLUMN colony_number INTEGER;
      ALTER TABLE treatments ADD COLUMN administered_amount REAL;
      ALTER TABLE treatments ADD COLUMN administered_unit TEXT;
      ALTER TABLE treatments ADD COLUMN supplier_name TEXT;
      ALTER TABLE treatments ADD COLUMN supplier_address TEXT;
      ALTER TABLE treatments ADD COLUMN acquisition_date TEXT;
      ALTER TABLE treatments ADD COLUMN veterinarian_name TEXT;
      ALTER TABLE treatments ADD COLUMN veterinarian_contact TEXT;
      ALTER TABLE treatments ADD COLUMN prescription_reference TEXT;
      ALTER TABLE treatments ADD COLUMN product_batch_number TEXT;
      ALTER TABLE treatments ADD COLUMN ongoing INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE treatments ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE sync_queue ADD COLUMN idempotency_key TEXT;
      ALTER TABLE sync_queue ADD COLUMN base_version INTEGER;
      ALTER TABLE sync_queue ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending';
      CREATE TABLE hive_placements (id TEXT PRIMARY KEY,hive_id TEXT NOT NULL,apiary_id TEXT NOT NULL,started_at TEXT NOT NULL,ended_at TEXT,movement_type TEXT NOT NULL,reason TEXT,movement_batch_id TEXT,voided_at TEXT,synced_at TEXT);
      CREATE TABLE compliance_events (id TEXT PRIMARY KEY,apiary_id TEXT,hive_id TEXT,colony_number INTEGER,event_type TEXT NOT NULL,occurred_at TEXT NOT NULL,title TEXT NOT NULL,payload TEXT NOT NULL DEFAULT '{}',version INTEGER NOT NULL DEFAULT 1,voided_at TEXT,synced_at TEXT);
      CREATE TABLE document_upload_queue (id TEXT PRIMARY KEY,entity_type TEXT NOT NULL,entity_local_id TEXT NOT NULL,local_path TEXT NOT NULL,metadata TEXT NOT NULL,idempotency_key TEXT NOT NULL,sync_status TEXT NOT NULL DEFAULT 'pending',last_error TEXT);
      CREATE TABLE production_batches (id TEXT PRIMARY KEY,batch_number TEXT NOT NULL,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,synced_at TEXT);
      CREATE INDEX idx_placements_hive ON hive_placements(hive_id,started_at);
      CREATE INDEX idx_compliance_events_date ON compliance_events(occurred_at);
      PRAGMA user_version = 1;
      COMMIT;
    `);
    version = 1;
  }

  if (__DEV__) console.log('Database initialized');
  return db;
}

// Get database instance
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Close database
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

// Generate UUID for local entities
export function generateLocalId(): string {
  return 'local_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Check if ID is a local (unsynced) ID
export function isLocalId(id: string): boolean {
  return id.startsWith('local_');
}
