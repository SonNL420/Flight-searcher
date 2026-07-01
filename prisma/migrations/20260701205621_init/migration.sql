-- CreateTable
CREATE TABLE "Route" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "origin" TEXT NOT NULL,
    "destination" TEXT,
    "tripType" TEXT NOT NULL DEFAULT 'ROUND_TRIP',
    "departDateFrom" TEXT NOT NULL,
    "departDateTo" TEXT NOT NULL,
    "stayDurationDays" INTEGER NOT NULL DEFAULT 7,
    "preferredAirlines" TEXT NOT NULL DEFAULT '[]',
    "cabin" TEXT NOT NULL DEFAULT 'ECONOMY',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "maxPrice" REAL,
    "dropPercent" REAL NOT NULL DEFAULT 40,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "routeId" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "airline" TEXT,
    "destination" TEXT,
    "departDate" TEXT,
    "returnDate" TEXT,
    "details" TEXT NOT NULL DEFAULT '{}',
    "bookingLink" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceSnapshot_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "routeId" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "baselineAvg" REAL,
    "baselineMin" REAL,
    "baselineMax" REAL,
    "rule" TEXT NOT NULL,
    "destination" TEXT,
    "departDate" TEXT,
    "returnDate" TEXT,
    "airline" TEXT,
    "details" TEXT NOT NULL DEFAULT '{}',
    "bookingLink" TEXT,
    "emailStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "emailError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "PriceSnapshot_routeId_capturedAt_idx" ON "PriceSnapshot"("routeId", "capturedAt");

-- CreateIndex
CREATE INDEX "Alert_routeId_createdAt_idx" ON "Alert"("routeId", "createdAt");
