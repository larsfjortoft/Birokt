-- CreateTable
CREATE TABLE "queens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queen_code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "race" TEXT,
    "color" TEXT,
    "marked" BOOLEAN NOT NULL DEFAULT false,
    "clipped" BOOLEAN NOT NULL DEFAULT false,
    "origin" TEXT NOT NULL DEFAULT 'own_production',
    "status" TEXT NOT NULL DEFAULT 'virgin',
    "status_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mother_id" TEXT,
    "mating_date" DATETIME,
    "mating_station" TEXT,
    "current_hive_id" TEXT,
    "introduced_date" DATETIME,
    "rating" INTEGER,
    "temperament" TEXT,
    "productivity" TEXT,
    "swarm_tendency" TEXT,
    "notes" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "queens_mother_id_fkey" FOREIGN KEY ("mother_id") REFERENCES "queens" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "queens_current_hive_id_fkey" FOREIGN KEY ("current_hive_id") REFERENCES "hives" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "queens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "queen_hive_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queen_id" TEXT NOT NULL,
    "hive_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "queen_hive_logs_queen_id_fkey" FOREIGN KEY ("queen_id") REFERENCES "queens" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "queen_hive_logs_hive_id_fkey" FOREIGN KEY ("hive_id") REFERENCES "hives" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "queen_hive_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "queens_user_id_idx" ON "queens"("user_id");

-- CreateIndex
CREATE INDEX "queens_current_hive_id_idx" ON "queens"("current_hive_id");

-- CreateIndex
CREATE INDEX "queens_mother_id_idx" ON "queens"("mother_id");

-- CreateIndex
CREATE INDEX "queen_hive_logs_queen_id_idx" ON "queen_hive_logs"("queen_id");

-- CreateIndex
CREATE INDEX "queen_hive_logs_hive_id_idx" ON "queen_hive_logs"("hive_id");
