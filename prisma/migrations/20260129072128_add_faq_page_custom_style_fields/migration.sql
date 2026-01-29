-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "headerDescription" TEXT NOT NULL DEFAULT 'Got a question? We are here to answer!',
    "headerAlignment" TEXT NOT NULL DEFAULT 'center',
    "searchEnabled" BOOLEAN NOT NULL DEFAULT true,
    "searchPlaceholder" TEXT NOT NULL DEFAULT 'Search FAQs...',
    "showIcons" BOOLEAN NOT NULL DEFAULT true,
    "showCategories" BOOLEAN NOT NULL DEFAULT true,
    "enableAccordion" BOOLEAN NOT NULL DEFAULT true,
    "faqSpacing" TEXT NOT NULL DEFAULT 'comfortable',
    "contactFormEnabled" BOOLEAN NOT NULL DEFAULT false,
    "contactFormTitle" TEXT NOT NULL DEFAULT 'Can''t find what you''re looking for?',
    "contactFormDescription" TEXT NOT NULL DEFAULT 'Send us a message and we''ll get back to you soon',
    "contactFormEmailLabel" TEXT NOT NULL DEFAULT 'Your Email',
    "contactFormEmailPlaceholder" TEXT NOT NULL DEFAULT 'you@example.com',
    "contactFormMessageLabel" TEXT NOT NULL DEFAULT 'Message',
    "contactFormMessagePlaceholder" TEXT NOT NULL DEFAULT 'How can we help?',
    "contactFormButtonText" TEXT NOT NULL DEFAULT 'Send Message',
    "customCSS" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "customBackgroundImage" TEXT NOT NULL DEFAULT '',
    "customFontSize" INTEGER NOT NULL DEFAULT 16,
    "customLineHeight" REAL NOT NULL DEFAULT 1.6
);
INSERT INTO "new_FaqPageSettings" ("appearanceTheme", "contactFormButtonText", "contactFormDescription", "contactFormEmailLabel", "contactFormEmailPlaceholder", "contactFormEnabled", "contactFormMessageLabel", "contactFormMessagePlaceholder", "contactFormTitle", "createdAt", "customAccentColor", "customBackgroundColor", "customBorderRadius", "customCSS", "customTextColor", "enableAccordion", "faqSpacing", "headerAlignment", "headerDescription", "headerEnabled", "headerTitle", "id", "layout", "searchEnabled", "searchPlaceholder", "shop", "showCategories", "showIcons", "updatedAt") SELECT "appearanceTheme", "contactFormButtonText", "contactFormDescription", "contactFormEmailLabel", "contactFormEmailPlaceholder", "contactFormEnabled", "contactFormMessageLabel", "contactFormMessagePlaceholder", "contactFormTitle", "createdAt", "customAccentColor", "customBackgroundColor", "customBorderRadius", "customCSS", "customTextColor", "enableAccordion", "faqSpacing", "headerAlignment", "headerDescription", "headerEnabled", "headerTitle", "id", "layout", "searchEnabled", "searchPlaceholder", "shop", "showCategories", "showIcons", "updatedAt" FROM "FaqPageSettings";
DROP TABLE "FaqPageSettings";
ALTER TABLE "new_FaqPageSettings" RENAME TO "FaqPageSettings";
CREATE UNIQUE INDEX "FaqPageSettings_shop_key" ON "FaqPageSettings"("shop");
CREATE INDEX "FaqPageSettings_shop_idx" ON "FaqPageSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
