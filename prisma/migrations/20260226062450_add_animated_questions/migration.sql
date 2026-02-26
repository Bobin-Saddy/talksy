-- CreateTable
CREATE TABLE "AnimatedQuestion" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "text" VARCHAR(80) NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '💬',
    "category" TEXT NOT NULL DEFAULT 'general',
    "animationType" TEXT NOT NULL DEFAULT 'float',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultAnswer" TEXT,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "dismissCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimatedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimatedQuestionSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxVisible" INTEGER NOT NULL DEFAULT 3,
    "showDelay" INTEGER NOT NULL DEFAULT 2000,
    "autoHide" BOOLEAN NOT NULL DEFAULT true,
    "autoHideDelay" INTEGER NOT NULL DEFAULT 8000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimatedQuestionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimatedQuestion_shop_isActive_idx" ON "AnimatedQuestion"("shop", "isActive");

-- CreateIndex
CREATE INDEX "AnimatedQuestion_shop_displayOrder_idx" ON "AnimatedQuestion"("shop", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AnimatedQuestionSettings_shop_key" ON "AnimatedQuestionSettings"("shop");
