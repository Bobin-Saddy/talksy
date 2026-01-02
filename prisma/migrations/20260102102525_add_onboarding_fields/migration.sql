-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#4F46E5',
    "headerBgColor" TEXT NOT NULL DEFAULT '#384959',
    "heroBgColor" TEXT NOT NULL DEFAULT '#bdddfc',
    "headerTextColor" TEXT NOT NULL DEFAULT '#bdddfc',
    "heroTextColor" TEXT NOT NULL DEFAULT '#384959',
    "cardTitleColor" TEXT NOT NULL DEFAULT '#384959',
    "cardSubtitleColor" TEXT NOT NULL DEFAULT '#64748b',
    "onboardingTextColor" TEXT NOT NULL DEFAULT '#384959',
    "welcomeImg" TEXT NOT NULL DEFAULT 'https://ui-avatars.com/api/?name=Support&background=fff&color=4F46E5',
    "headerTitle" TEXT NOT NULL DEFAULT 'Live Support',
    "headerSubtitle" TEXT NOT NULL DEFAULT 'Online now',
    "welcomeText" TEXT NOT NULL DEFAULT 'Hi there 👋',
    "welcomeSubtext" TEXT NOT NULL DEFAULT 'We are here to help you! Ask us anything.',
    "replyTimeText" TEXT NOT NULL DEFAULT 'Typically replies in 5 minutes',
    "startConversationText" TEXT NOT NULL DEFAULT 'Send us a message',
    "onboardingTitle" TEXT NOT NULL DEFAULT 'Start a conversation',
    "onboardingSubtitle" TEXT NOT NULL DEFAULT 'Please provide your details to begin.',
    "launcherIcon" TEXT NOT NULL DEFAULT 'bubble',
    "fontFamily" TEXT NOT NULL DEFAULT '-apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif',
    "baseFontSize" TEXT NOT NULL DEFAULT '15px',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ChatSettings" ("baseFontSize", "cardSubtitleColor", "cardTitleColor", "createdAt", "fontFamily", "headerBgColor", "headerSubtitle", "headerTextColor", "headerTitle", "heroBgColor", "heroTextColor", "id", "launcherIcon", "onboardingTextColor", "primaryColor", "replyTimeText", "shop", "startConversationText", "updatedAt", "welcomeImg", "welcomeSubtext", "welcomeText") SELECT "baseFontSize", "cardSubtitleColor", "cardTitleColor", "createdAt", "fontFamily", "headerBgColor", "headerSubtitle", "headerTextColor", "headerTitle", "heroBgColor", "heroTextColor", "id", "launcherIcon", "onboardingTextColor", "primaryColor", "replyTimeText", "shop", "startConversationText", "updatedAt", "welcomeImg", "welcomeSubtext", "welcomeText" FROM "ChatSettings";
DROP TABLE "ChatSettings";
ALTER TABLE "new_ChatSettings" RENAME TO "ChatSettings";
CREATE UNIQUE INDEX "ChatSettings_shop_key" ON "ChatSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
