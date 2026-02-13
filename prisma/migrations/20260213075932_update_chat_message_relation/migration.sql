-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "isBlurred" BOOLEAN NOT NULL DEFAULT false,
    "blurredAt" DATETIME
);
INSERT INTO "new_ChatSession" ("createdAt", "email", "firstName", "id", "isResolved", "lastName", "resolvedAt", "resolvedBy", "sessionId", "shop", "updatedAt") SELECT "createdAt", "email", "firstName", "id", "isResolved", "lastName", "resolvedAt", "resolvedBy", "sessionId", "shop", "updatedAt" FROM "ChatSession";
DROP TABLE "ChatSession";
ALTER TABLE "new_ChatSession" RENAME TO "ChatSession";
CREATE UNIQUE INDEX "ChatSession_sessionId_key" ON "ChatSession"("sessionId");
CREATE INDEX "ChatSession_shop_idx" ON "ChatSession"("shop");
CREATE INDEX "ChatSession_sessionId_idx" ON "ChatSession"("sessionId");
CREATE INDEX "ChatSession_isBlurred_idx" ON "ChatSession"("isBlurred");
CREATE INDEX "ChatSession_shop_createdAt_idx" ON "ChatSession"("shop", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ChatMessage_chatSessionId_idx" ON "ChatMessage"("chatSessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "Subscription_shop_idx" ON "Subscription"("shop");
