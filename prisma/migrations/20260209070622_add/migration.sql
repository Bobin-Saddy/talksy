-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'active',
    "billingId" TEXT,
    "currentPeriodEnd" DATETIME,
    "currentPeriodStart" DATETIME,
    "trialEndsAt" DATETIME,
    "trialDays" INTEGER,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Subscription" ("billingId", "cancelledAt", "createdAt", "currentPeriodEnd", "currentPeriodStart", "id", "plan", "shop", "status", "trialEndsAt", "updatedAt") SELECT "billingId", "cancelledAt", "createdAt", "currentPeriodEnd", "currentPeriodStart", "id", "plan", "shop", "status", "trialEndsAt", "updatedAt" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE UNIQUE INDEX "Subscription_shop_key" ON "Subscription"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
