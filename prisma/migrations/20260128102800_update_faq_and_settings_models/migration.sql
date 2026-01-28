/*
  Warnings:

  - You are about to drop the column `accentColor` on the `FaqPageSettings` table. All the data in the column will be lost.
  - You are about to drop the column `backgroundColor` on the `FaqPageSettings` table. All the data in the column will be lost.
  - You are about to drop the column `borderRadius` on the `FaqPageSettings` table. All the data in the column will be lost.
  - You are about to drop the column `showSearch` on the `FaqPageSettings` table. All the data in the column will be lost.
  - You are about to drop the column `textColor` on the `FaqPageSettings` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Faq" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'QuestionCircleIcon',
    CONSTRAINT "Faq_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FaqCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Faq" ("answer", "categoryId", "createdAt", "id", "isActive", "position", "question", "shop", "updatedAt") SELECT "answer", "categoryId", "createdAt", "id", "isActive", "position", "question", "shop", "updatedAt" FROM "Faq";
DROP TABLE "Faq";
ALTER TABLE "new_Faq" RENAME TO "Faq";
CREATE INDEX "Faq_shop_idx" ON "Faq"("shop");
CREATE INDEX "Faq_categoryId_idx" ON "Faq"("categoryId");
CREATE TABLE "new_FaqPageSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "layout" TEXT NOT NULL DEFAULT 'list',
    "appearanceTheme" TEXT NOT NULL DEFAULT 'light',
    "customBackgroundColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "customTextColor" TEXT NOT NULL DEFAULT '#000000',
    "customAccentColor" TEXT NOT NULL DEFAULT '#5C6AC4',
    "customBorderRadius" INTEGER NOT NULL DEFAULT 8,
    "headerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "headerTitle" TEXT NOT NULL DEFAULT 'Frequently Asked Questions',
    "headerDescription" TEXT NOT NULL DEFAULT '',
    "headerAlignment" TEXT NOT NULL DEFAULT 'center',
    "searchEnabled" BOOLEAN NOT NULL DEFAULT true,
    "searchPlaceholder" TEXT NOT NULL DEFAULT 'Search FAQs...',
    "showIcons" BOOLEAN NOT NULL DEFAULT true,
    "showCategories" BOOLEAN NOT NULL DEFAULT true,
    "enableAccordion" BOOLEAN NOT NULL DEFAULT true,
    "faqSpacing" TEXT NOT NULL DEFAULT 'comfortable',
    "contactFormEnabled" BOOLEAN NOT NULL DEFAULT false,
    "contactFormTitle" TEXT NOT NULL DEFAULT 'Can''t find what you''re looking for?',
    "contactFormDescription" TEXT NOT NULL DEFAULT '',
    "contactFormEmailLabel" TEXT NOT NULL DEFAULT 'Your Email',
    "contactFormEmailPlaceholder" TEXT NOT NULL DEFAULT '',
    "contactFormMessageLabel" TEXT NOT NULL DEFAULT 'Message',
    "contactFormMessagePlaceholder" TEXT NOT NULL DEFAULT '',
    "contactFormButtonText" TEXT NOT NULL DEFAULT 'Send Message',
    "customCSS" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FaqPageSettings" ("appearanceTheme", "createdAt", "customCSS", "enableAccordion", "headerDescription", "headerTitle", "id", "layout", "shop", "showIcons", "updatedAt") SELECT "appearanceTheme", "createdAt", "customCSS", "enableAccordion", "headerDescription", "headerTitle", "id", "layout", "shop", "showIcons", "updatedAt" FROM "FaqPageSettings";
DROP TABLE "FaqPageSettings";
ALTER TABLE "new_FaqPageSettings" RENAME TO "FaqPageSettings";
CREATE UNIQUE INDEX "FaqPageSettings_shop_key" ON "FaqPageSettings"("shop");
CREATE INDEX "FaqPageSettings_shop_idx" ON "FaqPageSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
