-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "apiaries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location_name" TEXT,
    "location_lat" REAL,
    "location_lng" REAL,
    "type" TEXT NOT NULL DEFAULT 'permanent',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_apiaries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "apiary_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_apiaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_apiaries_apiary_id_fkey" FOREIGN KEY ("apiary_id") REFERENCES "apiaries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hives" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiary_id" TEXT NOT NULL,
    "hive_number" TEXT NOT NULL,
    "qr_code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "strength" TEXT,
    "hive_type" TEXT NOT NULL DEFAULT 'langstroth',
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
    CONSTRAINT "hives_apiary_id_fkey" FOREIGN KEY ("apiary_id") REFERENCES "apiaries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inspections" (
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
    CONSTRAINT "inspections_hive_id_fkey" FOREIGN KEY ("hive_id") REFERENCES "hives" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inspections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspection_id" TEXT,
    "hive_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "photos_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "photos_hive_id_fkey" FOREIGN KEY ("hive_id") REFERENCES "hives" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inspection_actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspection_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inspection_actions_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "treatments" (
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "treatments_hive_id_fkey" FOREIGN KEY ("hive_id") REFERENCES "hives" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "treatments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "feedings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hive_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feeding_date" DATETIME NOT NULL,
    "feed_type" TEXT NOT NULL,
    "amount_kg" REAL NOT NULL,
    "sugar_concentration" REAL,
    "reason" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "feedings_hive_id_fkey" FOREIGN KEY ("hive_id") REFERENCES "hives" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "feedings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production" (
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
    CONSTRAINT "production_hive_id_fkey" FOREIGN KEY ("hive_id") REFERENCES "hives" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "production_apiary_id_fkey" FOREIGN KEY ("apiary_id") REFERENCES "apiaries" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "production_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "user_apiaries_user_id_apiary_id_key" ON "user_apiaries"("user_id", "apiary_id");

-- CreateIndex
CREATE UNIQUE INDEX "hives_qr_code_key" ON "hives"("qr_code");
