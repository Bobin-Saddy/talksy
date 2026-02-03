-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#4F46E5',
    "headerBgColor" TEXT NOT NULL DEFAULT '#2c3e50',
    "heroBgColor" TEXT NOT NULL DEFAULT '#f8f9fa',
    "headerTextColor" TEXT NOT NULL DEFAULT '#ffffff',
    "heroTextColor" TEXT NOT NULL DEFAULT '#1a1a1a',
    "cardTitleColor" TEXT NOT NULL DEFAULT '#1a1a1a',
    "cardSubtitleColor" TEXT NOT NULL DEFAULT '#4a5568',
    "onboardingTextColor" TEXT NOT NULL DEFAULT '#1a1a1a',
    "chatBoxBgColor" TEXT NOT NULL DEFAULT '#f8f9fa',
    "messageBgColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "widgetBorderColor" TEXT NOT NULL DEFAULT '#E5E7EB',
    "contactCardBgColor" TEXT NOT NULL DEFAULT '#e8e8e8',
    "chatButtonBgColor" TEXT NOT NULL DEFAULT '#2c3e50',
    "emailButtonBgColor" TEXT NOT NULL DEFAULT '#fbbf24',
    "customLauncherImg" TEXT,
    "welcomeImg" TEXT NOT NULL DEFAULT 'https://ui-avatars.com/api/?name=Support&background=4F46E5&color=fff',
    "headerTitle" TEXT NOT NULL DEFAULT 'Live Support',
    "headerSubtitle" TEXT NOT NULL DEFAULT 'Online now',
    "welcomeText" TEXT NOT NULL DEFAULT 'Hi 👋',
    "welcomeSubtext" TEXT NOT NULL DEFAULT 'How can we help you?',
    "replyTimeText" TEXT NOT NULL DEFAULT 'Typically replies in 5 minutes',
    "startConversationText" TEXT NOT NULL DEFAULT 'Contact us',
    "onboardingTitle" TEXT NOT NULL DEFAULT 'Start a conversation',
    "onboardingSubtitle" TEXT NOT NULL DEFAULT 'Please provide your details to begin.',
    "launcherIcon" TEXT NOT NULL DEFAULT 'bubble',
    "fontFamily" TEXT NOT NULL DEFAULT '''Euclid Circular A Medium'', ''Euclid Circular A'', -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif',
    "baseFontSize" TEXT NOT NULL DEFAULT '15px',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ChatSettings" ("baseFontSize", "cardSubtitleColor", "cardTitleColor", "chatBoxBgColor", "createdAt", "customLauncherImg", "fontFamily", "headerBgColor", "headerSubtitle", "headerTextColor", "headerTitle", "heroBgColor", "heroTextColor", "id", "launcherIcon", "messageBgColor", "onboardingSubtitle", "onboardingTextColor", "onboardingTitle", "primaryColor", "replyTimeText", "shop", "startConversationText", "updatedAt", "welcomeImg", "welcomeSubtext", "welcomeText", "widgetBorderColor") SELECT "baseFontSize", "cardSubtitleColor", "cardTitleColor", "chatBoxBgColor", "createdAt", "customLauncherImg", "fontFamily", "headerBgColor", "headerSubtitle", "headerTextColor", "headerTitle", "heroBgColor", "heroTextColor", "id", "launcherIcon", "messageBgColor", "onboardingSubtitle", "onboardingTextColor", "onboardingTitle", "primaryColor", "replyTimeText", "shop", "startConversationText", "updatedAt", "welcomeImg", "welcomeSubtext", "welcomeText", "widgetBorderColor" FROM "ChatSettings";
DROP TABLE "ChatSettings";
ALTER TABLE "new_ChatSettings" RENAME TO "ChatSettings";
CREATE UNIQUE INDEX "ChatSettings_shop_key" ON "ChatSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
