-- CreateTable
CREATE TABLE "field_visits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "apiary_id" TEXT NOT NULL,
    "apiary_name" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL,
    "ended_at" DATETIME NOT NULL,
    "interrupted" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'awaiting_audio',
    "audio_path" TEXT,
    "audio_hash" TEXT,
    "audio_bytes" INTEGER,
    "transcript" TEXT,
    "summary" TEXT,
    "last_error" TEXT,
    "processing_token" TEXT,
    "processing_at" DATETIME,
    "reviewed_at" DATETIME,
    "review_notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "field_visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "field_visits_apiary_id_fkey" FOREIGN KEY ("apiary_id") REFERENCES "apiaries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "visit_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visit_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "hive_id" TEXT,
    "source_text" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "origin" TEXT NOT NULL DEFAULT 'hermes',
    "entity_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "visit_entries_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "field_visits" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_inspections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hive_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "inspection_date" DATETIME NOT NULL,
    "temperature" REAL,
    "wind_speed" REAL,
    "weather_condition" TEXT,
    "strength" TEXT,
    "temperament" TEXT,
    "queen_seen" BOOLEAN,
    "queen_laying" BOOLEAN,
    "brood_frames" INTEGER,
    "honey_frames" INTEGER,
    "pollen_frames" INTEGER,
    "empty_frames" INTEGER,
    "health_status" TEXT,
    "varroa_level" TEXT,
    "diseases" TEXT NOT NULL DEFAULT '[]',
    "pests" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "voided_at" DATETIME,
    "void_reason" TEXT,
    "voided_by_id" TEXT,
    CONSTRAINT "inspections_hive_id_fkey" FOREIGN KEY ("hive_id") REFERENCES "hives" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inspections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inspections_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_inspections" ("brood_frames", "created_at", "diseases", "empty_frames", "health_status", "hive_id", "honey_frames", "id", "inspection_date", "metadata", "notes", "pests", "pollen_frames", "queen_laying", "queen_seen", "strength", "temperament", "temperature", "updated_at", "user_id", "varroa_level", "version", "void_reason", "voided_at", "voided_by_id", "weather_condition", "wind_speed") SELECT "brood_frames", "created_at", "diseases", "empty_frames", "health_status", "hive_id", "honey_frames", "id", "inspection_date", "metadata", "notes", "pests", "pollen_frames", "queen_laying", "queen_seen", "strength", "temperament", "temperature", "updated_at", "user_id", "varroa_level", "version", "void_reason", "voided_at", "voided_by_id", "weather_condition", "wind_speed" FROM "inspections";
DROP TABLE "inspections";
ALTER TABLE "new_inspections" RENAME TO "inspections";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "field_visits_status_processing_at_idx" ON "field_visits"("status", "processing_at");

-- CreateIndex
CREATE INDEX "visit_entries_visit_id_idx" ON "visit_entries"("visit_id");
