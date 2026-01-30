-- CreateTable
CREATE TABLE "FeatureSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "FeatureSuggestion_shop_idx" ON "FeatureSuggestion"("shop");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_status_idx" ON "FeatureSuggestion"("status");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_createdAt_idx" ON "FeatureSuggestion"("createdAt");
