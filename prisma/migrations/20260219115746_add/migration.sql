-- CreateTable
CREATE TABLE "ChatImage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "sessionId" TEXT,
    "filename" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ChatImage_shop_idx" ON "ChatImage"("shop");

-- CreateIndex
CREATE INDEX "ChatImage_sessionId_idx" ON "ChatImage"("sessionId");
