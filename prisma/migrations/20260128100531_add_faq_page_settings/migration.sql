-- CreateTable
CREATE TABLE "FaqPageSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "layout" TEXT NOT NULL DEFAULT 'list',
    "appearanceTheme" TEXT NOT NULL DEFAULT 'light',
    "headerTitle" TEXT NOT NULL DEFAULT 'Frequently Asked Questions',
    "headerDescription" TEXT NOT NULL DEFAULT '',
    "backgroundColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "textColor" TEXT NOT NULL DEFAULT '#000000',
    "accentColor" TEXT NOT NULL DEFAULT '#5C6AC4',
    "borderRadius" INTEGER NOT NULL DEFAULT 8,
    "showIcons" BOOLEAN NOT NULL DEFAULT true,
    "showSearch" BOOLEAN NOT NULL DEFAULT true,
    "enableAccordion" BOOLEAN NOT NULL DEFAULT true,
    "customCSS" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FaqPageSettings_shop_key" ON "FaqPageSettings"("shop");

-- CreateIndex
CREATE INDEX "FaqPageSettings_shop_idx" ON "FaqPageSettings"("shop");
