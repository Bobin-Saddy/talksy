-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "headerGradientStart" TEXT NOT NULL DEFAULT '#F39C12',
    "headerGradientEnd" TEXT NOT NULL DEFAULT '#E67E22',
    "headerBgColor" TEXT NOT NULL DEFAULT '#2c3e50',
    "headerTextColor" TEXT NOT NULL DEFAULT '#ffffff',
    "primaryColor" TEXT NOT NULL DEFAULT '#F39C12',
    "chatBoxBgColor" TEXT NOT NULL DEFAULT '#f5f5f5',
    "messageBgColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "widgetBorderColor" TEXT NOT NULL DEFAULT '#E5E7EB',
    "contactCardBgColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "chatButtonBgColor" TEXT NOT NULL DEFAULT '#F39C12',
    "cardTitleColor" TEXT NOT NULL DEFAULT '#1a1a1a',
    "cardSubtitleColor" TEXT NOT NULL DEFAULT '#777777',
    "onboardingTextColor" TEXT NOT NULL DEFAULT '#1a1a1a',
    "searchCardTitle" TEXT NOT NULL DEFAULT 'Search here',
    "searchCardSubtitle" TEXT NOT NULL DEFAULT 'This is Search',
    "onlineStatusColor" TEXT NOT NULL DEFAULT '#22c55e',
    "offlineStatusColor" TEXT NOT NULL DEFAULT '#ef4444',
    "customLauncherImg" TEXT,
    "welcomeImg" TEXT NOT NULL DEFAULT 'https://ui-avatars.com/api/?name=Support&background=F39C12&color=fff',
    "headerTitle" TEXT NOT NULL DEFAULT 'Live Support',
    "headerSubtitle" TEXT NOT NULL DEFAULT 'Online now',
    "welcomeText" TEXT NOT NULL DEFAULT 'Hello 👋',
    "welcomeSubtext" TEXT NOT NULL DEFAULT 'How can we help you?',
    "replyTimeText" TEXT NOT NULL DEFAULT 'Typically replies in 5 minutes',
    "startConversationText" TEXT NOT NULL DEFAULT 'Contact us',
    "onboardingTitle" TEXT NOT NULL DEFAULT 'Start a conversation',
    "onboardingSubtitle" TEXT NOT NULL DEFAULT 'Please provide your details to begin.',
    "launcherIcon" TEXT NOT NULL DEFAULT 'bubble',
    "fontFamily" TEXT NOT NULL DEFAULT '''Montserrat'', -apple-system, sans-serif',
    "baseFontSize" TEXT NOT NULL DEFAULT '14px',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "showPoweredBy" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_ChatSettings" ("baseFontSize", "cardSubtitleColor", "cardTitleColor", "chatBoxBgColor", "chatButtonBgColor", "contactCardBgColor", "createdAt", "customLauncherImg", "fontFamily", "headerBgColor", "headerGradientEnd", "headerGradientStart", "headerSubtitle", "headerTextColor", "headerTitle", "id", "launcherIcon", "messageBgColor", "offlineStatusColor", "onboardingSubtitle", "onboardingTextColor", "onboardingTitle", "onlineStatusColor", "primaryColor", "replyTimeText", "searchCardSubtitle", "searchCardTitle", "shop", "startConversationText", "updatedAt", "welcomeImg", "welcomeSubtext", "welcomeText", "widgetBorderColor") SELECT "baseFontSize", "cardSubtitleColor", "cardTitleColor", "chatBoxBgColor", "chatButtonBgColor", "contactCardBgColor", "createdAt", "customLauncherImg", "fontFamily", "headerBgColor", "headerGradientEnd", "headerGradientStart", "headerSubtitle", "headerTextColor", "headerTitle", "id", "launcherIcon", "messageBgColor", "offlineStatusColor", "onboardingSubtitle", "onboardingTextColor", "onboardingTitle", "onlineStatusColor", "primaryColor", "replyTimeText", "searchCardSubtitle", "searchCardTitle", "shop", "startConversationText", "updatedAt", "welcomeImg", "welcomeSubtext", "welcomeText", "widgetBorderColor" FROM "ChatSettings";
DROP TABLE "ChatSettings";
ALTER TABLE "new_ChatSettings" RENAME TO "ChatSettings";
CREATE UNIQUE INDEX "ChatSettings_shop_key" ON "ChatSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
