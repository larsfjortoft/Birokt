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
