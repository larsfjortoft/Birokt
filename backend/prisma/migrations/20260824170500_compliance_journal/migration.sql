-- AlterTable
ALTER TABLE "apiaries" ADD COLUMN "operator_address" TEXT;
ALTER TABLE "apiaries" ADD COLUMN "operator_name" TEXT;
ALTER TABLE "apiaries" ADD COLUMN "organization_number" TEXT;
ALTER TABLE "apiaries" ADD COLUMN "registration_number" TEXT;
ALTER TABLE "apiaries" ADD COLUMN "valid_from" DATETIME;
ALTER TABLE "apiaries" ADD COLUMN "valid_to" DATETIME;

-- AlterTable
ALTER TABLE "queen_hive_logs" ADD COLUMN "colony_number" INTEGER;

-- AlterTable
ALTER TABLE "queens" ADD COLUMN "current_colony_number" INTEGER;

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "inspection_reminders" BOOLEAN NOT NULL DEFAULT true,
    "treatment_reminders" BOOLEAN NOT NULL DEFAULT true,
    "weather_alerts" BOOLEAN NOT NULL DEFAULT true,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event_date" DATETIME NOT NULL,
    "end_date" DATETIME,
    "event_type" TEXT NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "apiary_id" TEXT,
    "hive_id" TEXT,
    "notes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "google_event_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "calendar_events_apiary_id_fkey" FOREIGN KEY ("apiary_id") REFERENCES "apiaries" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "calendar_events_hive_id_fkey" FOREIGN KEY ("hive_id") REFERENCES "hives" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "entry_date" DATETIME NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "mood" TEXT,
    "temperature" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hive_placements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hive_id" TEXT NOT NULL,
    "apiary_id" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL,
    "ended_at" DATETIME,
    "movement_type" TEXT NOT NULL,
    "reason" TEXT,
    "apiary_name_snapshot" TEXT NOT NULL,
    "location_name_snapshot" TEXT,
    "location_lat_snapshot" REAL,
    "location_lng_snapshot" REAL,
    "created_by_id" TEXT NOT NULL,
    "movement_batch_id" TEXT,
    "correction_of_id" TEXT,
    "voided_at" DATETIME,
    "void_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hive_placements_hive_id_fkey" FOREIGN KEY ("hive_id") REFERENCES "hives" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "hive_placements_apiary_id_fkey" FOREIGN KEY ("apiary_id") REFERENCES "apiaries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "hive_placements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "hive_placements_correction_of_id_fkey" FOREIGN KEY ("correction_of_id") REFERENCES "hive_placements" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "idempotency_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'processing',
    "status_code" INTEGER,
    "response_json" TEXT,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "idempotency_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "medicine_acquisitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "acquired_on" DATETIME NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "supplier_address" TEXT,
    "acquired_amount" REAL NOT NULL,
    "acquired_unit" TEXT NOT NULL,
    "acquisition_reference" TEXT,
    "retention_until" DATETIME NOT NULL,
    "voided_at" DATETIME,
    "void_reason" TEXT,
    "voided_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "medicine_acquisitions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "medicine_acquisitions_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "compliance_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "document_date" DATETIME,
    "issuer" TEXT,
    "reference" TEXT,
    "retention_until" DATETIME,
    "voided_at" DATETIME,
    "void_reason" TEXT,
    "voided_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compliance_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "compliance_documents_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_json" TEXT,
    "after_json" TEXT,
    "reason" TEXT,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_id" TEXT,
    CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "compliance_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "apiary_id" TEXT,
    "hive_id" TEXT,
    "colony_number" INTEGER,
    "event_type" TEXT NOT NULL,
    "occurred_at" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mortality_count" INTEGER,
    "suspected_cause" TEXT,
    "disease_name" TEXT,
    "diagnosis_status" TEXT,
    "sample_reference" TEXT,
    "sample_taken_at" DATETIME,
    "laboratory_name" TEXT,
    "analysis_type" TEXT,
    "analysis_result" TEXT,
    "result_received_at" DATETIME,
    "professional_name" TEXT,
    "professional_contact" TEXT,
    "authority_name" TEXT,
    "authority_reference" TEXT,
    "notification_required" BOOLEAN,
    "notified_at" DATETIME,
    "follow_up_due_at" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "voided_at" DATETIME,
    "void_reason" TEXT,
    "voided_by_id" TEXT,
    "retention_until" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "compliance_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "compliance_events_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "compliance_events_apiary_id_fkey" FOREIGN KEY ("apiary_id") REFERENCES "apiaries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "compliance_events_hive_id_fkey" FOREIGN KEY ("hive_id") REFERENCES "hives" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "product_type" TEXT NOT NULL,
    "harvest_started_at" DATETIME NOT NULL,
    "harvest_ended_at" DATETIME,
    "total_quantity_kg" REAL,
    "moisture_percent" REAL,
    "release_status" TEXT NOT NULL DEFAULT 'pending',
    "release_decision_at" DATETIME,
    "release_reason" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "voided_at" DATETIME,
    "void_reason" TEXT,
    "voided_by_id" TEXT,
    "retention_until" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "production_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_batches_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_batch_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "production_batch_id" TEXT NOT NULL,
    "production_id" TEXT NOT NULL,
    "hive_id" TEXT NOT NULL,
    "hive_number_snapshot" TEXT NOT NULL,
    "apiary_name_snapshot" TEXT NOT NULL,
    "source_quantity_kg" REAL,
    CONSTRAINT "production_batch_sources_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_batch_sources_production_id_fkey" FOREIGN KEY ("production_id") REFERENCES "production" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_hives" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiary_id" TEXT NOT NULL,
    "hive_number" TEXT NOT NULL,
    "qr_code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "strength" TEXT,
    "hive_type" TEXT NOT NULL DEFAULT 'single_queen',
    "box_count" INTEGER NOT NULL DEFAULT 1,
    "queen_year" INTEGER,
    "queen_marked" BOOLEAN NOT NULL DEFAULT false,
    "queen_color" TEXT,
    "queen_race" TEXT,
    "current_brood_frames" INTEGER NOT NULL DEFAULT 0,
    "current_honey_frames" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "hives_apiary_id_fkey" FOREIGN KEY ("apiary_id") REFERENCES "apiaries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_hives" ("apiary_id", "box_count", "created_at", "current_brood_frames", "current_honey_frames", "hive_number", "hive_type", "id", "metadata", "notes", "qr_code", "queen_color", "queen_marked", "queen_race", "queen_year", "status", "strength", "updated_at") SELECT "apiary_id", "box_count", "created_at", "current_brood_frames", "current_honey_frames", "hive_number", "hive_type", "id", "metadata", "notes", "qr_code", "queen_color", "queen_marked", "queen_race", "queen_year", "status", "strength", "updated_at" FROM "hives";
DROP TABLE "hives";
ALTER TABLE "new_hives" RENAME TO "hives";
CREATE UNIQUE INDEX "hives_qr_code_key" ON "hives"("qr_code");
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
    "queen_seen" BOOLEAN NOT NULL DEFAULT false,
    "queen_laying" BOOLEAN NOT NULL DEFAULT false,
    "brood_frames" INTEGER NOT NULL DEFAULT 0,
    "honey_frames" INTEGER NOT NULL DEFAULT 0,
    "pollen_frames" INTEGER NOT NULL DEFAULT 0,
    "empty_frames" INTEGER NOT NULL DEFAULT 0,
    "health_status" TEXT NOT NULL DEFAULT 'healthy',
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
INSERT INTO "new_inspections" ("brood_frames", "created_at", "diseases", "empty_frames", "health_status", "hive_id", "honey_frames", "id", "inspection_date", "metadata", "notes", "pests", "pollen_frames", "queen_laying", "queen_seen", "strength", "temperament", "temperature", "updated_at", "user_id", "varroa_level", "weather_condition", "wind_speed") SELECT "brood_frames", "created_at", "diseases", "empty_frames", "health_status", "hive_id", "honey_frames", "id", "inspection_date", "metadata", "notes", "pests", "pollen_frames", "queen_laying", "queen_seen", "strength", "temperament", "temperature", "updated_at", "user_id", "varroa_level", "weather_condition", "wind_speed" FROM "inspections";
DROP TABLE "inspections";
ALTER TABLE "new_inspections" RENAME TO "inspections";
CREATE TABLE "new_production" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hive_id" TEXT,
    "apiary_id" TEXT,
    "user_id" TEXT NOT NULL,
    "harvest_date" DATETIME NOT NULL,
    "product_type" TEXT NOT NULL,
    "honey_type" TEXT,
    "amount_kg" REAL NOT NULL,
    "quality_grade" TEXT,
    "moisture_content" REAL,
    "price_per_kg" REAL,
    "total_revenue" REAL,
    "sold_to" TEXT,
    "sale_date" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "voided_at" DATETIME,
    "void_reason" TEXT,
    "voided_by_id" TEXT,
    CONSTRAINT "production_hive_id_fkey" FOREIGN KEY ("hive_id") REFERENCES "hives" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "production_apiary_id_fkey" FOREIGN KEY ("apiary_id") REFERENCES "apiaries" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "production_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_production" ("amount_kg", "apiary_id", "created_at", "harvest_date", "hive_id", "honey_type", "id", "moisture_content", "notes", "price_per_kg", "product_type", "quality_grade", "sale_date", "sold_to", "total_revenue", "updated_at", "user_id") SELECT "amount_kg", "apiary_id", "created_at", "harvest_date", "hive_id", "honey_type", "id", "moisture_content", "notes", "price_per_kg", "product_type", "quality_grade", "sale_date", "sold_to", "total_revenue", "updated_at", "user_id" FROM "production";
DROP TABLE "production";
ALTER TABLE "new_production" RENAME TO "production";
CREATE TABLE "new_treatments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hive_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "treatment_date" DATETIME NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_type" TEXT,
    "target" TEXT,
    "dosage" TEXT,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME,
    "withholding_period_days" INTEGER,
    "withholding_end_date" DATETIME,
    "notes" TEXT,
    "colony_number" INTEGER,
    "scope" TEXT DEFAULT 'whole_hive',
    "medicine_acquisition_id" TEXT,
    "treatment_group_id" TEXT,
    "administered_amount" REAL,
    "administered_unit" TEXT,
    "supplier_name" TEXT,
    "supplier_address" TEXT,
    "acquisition_date" DATETIME,
    "veterinarian_name" TEXT,
    "veterinarian_contact" TEXT,
    "prescription_reference" TEXT,
    "product_batch_number" TEXT,
    "hive_number_snapshot" TEXT,
    "apiary_id_at_treatment" TEXT,
    "apiary_name_snapshot" TEXT,
    "ongoing" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "voided_at" DATETIME,
    "void_reason" TEXT,
    "voided_by_id" TEXT,
    "retention_until" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "treatments_hive_id_fkey" FOREIGN KEY ("hive_id") REFERENCES "hives" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "treatments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "treatments_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "treatments_medicine_acquisition_id_fkey" FOREIGN KEY ("medicine_acquisition_id") REFERENCES "medicine_acquisitions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_treatments" ("created_at", "dosage", "end_date", "hive_id", "id", "notes", "product_name", "product_type", "start_date", "target", "treatment_date", "updated_at", "user_id", "withholding_end_date", "withholding_period_days") SELECT "created_at", "dosage", "end_date", "hive_id", "id", "notes", "product_name", "product_type", "start_date", "target", "treatment_date", "updated_at", "user_id", "withholding_end_date", "withholding_period_days" FROM "treatments";
DROP TABLE "treatments";
ALTER TABLE "new_treatments" RENAME TO "treatments";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_user_id_key" ON "notification_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_google_event_id_key" ON "calendar_events"("google_event_id");

-- CreateIndex
CREATE INDEX "hive_placements_hive_id_started_at_idx" ON "hive_placements"("hive_id", "started_at");

-- CreateIndex
CREATE INDEX "hive_placements_apiary_id_started_at_idx" ON "hive_placements"("apiary_id", "started_at");

-- CreateIndex
CREATE INDEX "idempotency_requests_expires_at_idx" ON "idempotency_requests"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_requests_user_id_route_key_key" ON "idempotency_requests"("user_id", "route", "key");

-- CreateIndex
CREATE INDEX "medicine_acquisitions_user_id_acquired_on_idx" ON "medicine_acquisitions"("user_id", "acquired_on");

-- CreateIndex
CREATE INDEX "compliance_documents_entity_type_entity_id_idx" ON "compliance_documents"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_occurred_at_idx" ON "audit_log"("entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_user_id_occurred_at_idx" ON "audit_log"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "compliance_events_event_type_occurred_at_idx" ON "compliance_events"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "compliance_events_apiary_id_occurred_at_idx" ON "compliance_events"("apiary_id", "occurred_at");

-- CreateIndex
CREATE INDEX "compliance_events_hive_id_occurred_at_idx" ON "compliance_events"("hive_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "production_batches_user_id_batch_number_key" ON "production_batches"("user_id", "batch_number");

-- CreateIndex
CREATE UNIQUE INDEX "production_batch_sources_production_batch_id_production_id_key" ON "production_batch_sources"("production_batch_id", "production_id");

-- Backfill one explicitly dated initial placement per existing hive. The migration
-- timestamp is used deliberately; history before this instant remains unknown.
INSERT INTO "hive_placements" (
  "id", "hive_id", "apiary_id", "started_at", "movement_type",
  "apiary_name_snapshot", "location_name_snapshot", "location_lat_snapshot",
  "location_lng_snapshot", "created_by_id", "created_at"
)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6))),
  h."id", h."apiary_id", CURRENT_TIMESTAMP, 'initial', a."name",
  a."location_name", a."location_lat", a."location_lng",
  (SELECT ua."user_id" FROM "user_apiaries" ua
   WHERE ua."apiary_id" = h."apiary_id"
   ORDER BY CASE ua."role" WHEN 'owner' THEN 0 ELSE 1 END, ua."created_at" LIMIT 1),
  CURRENT_TIMESTAMP
FROM "hives" h
JOIN "apiaries" a ON a."id" = h."apiary_id"
WHERE EXISTS (SELECT 1 FROM "user_apiaries" ua WHERE ua."apiary_id" = h."apiary_id");

-- Existing records are retained without inventing missing medicine metadata.
UPDATE "treatments"
SET "retention_until" = datetime(COALESCE("end_date", "start_date", "treatment_date"), '+5 years')
WHERE "retention_until" IS NULL;

-- SQLite partial index: at most one non-voided open placement per hive.
CREATE UNIQUE INDEX "hive_placements_one_open_per_hive"
ON "hive_placements"("hive_id")
WHERE "ended_at" IS NULL AND "voided_at" IS NULL;
