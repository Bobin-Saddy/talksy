-- CreateTable
CREATE TABLE "FcmToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "email" TEXT,
    "sessionId" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FcmToken_token_key" ON "FcmToken"("token");

-- CreateIndex
CREATE INDEX "FcmToken_shop_type_idx" ON "FcmToken"("shop", "type");

-- CreateIndex
CREATE INDEX "FcmToken_shop_idx" ON "FcmToken"("shop");
