-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatSessionId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession" ("sessionId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#4F46E5',
    "headerBgColor" TEXT NOT NULL DEFAULT '#111827',
    "heroBgColor" TEXT NOT NULL DEFAULT '#EEF2FF',
    "headerTextColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "heroTextColor" TEXT NOT NULL DEFAULT '#111827',
    "cardTitleColor" TEXT NOT NULL DEFAULT '#384959',
    "cardSubtitleColor" TEXT NOT NULL DEFAULT '#64748b',
    "onboardingTextColor" TEXT NOT NULL DEFAULT '#384959',
    "welcomeImg" TEXT NOT NULL DEFAULT 'https://ui-avatars.com/api/?name=Support&background=4F46E5&color=fff',
    "headerTitle" TEXT NOT NULL DEFAULT 'Customer Care',
    "headerSubtitle" TEXT NOT NULL DEFAULT 'Online & Ready',
    "welcomeText" TEXT NOT NULL DEFAULT 'How can we help?',
    "welcomeSubtext" TEXT NOT NULL DEFAULT 'Our team typically responds in under 5 minutes.',
    "replyTimeText" TEXT NOT NULL DEFAULT 'Replies instantly',
    "fontFamily" TEXT NOT NULL DEFAULT '-apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif',
    "baseFontSize" TEXT NOT NULL DEFAULT '15px',
    "startConversationText" TEXT NOT NULL DEFAULT 'Send us a message',
    "launcherIcon" TEXT NOT NULL DEFAULT 'bubble',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_sessionId_key" ON "ChatSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSettings_shop_key" ON "ChatSettings"("shop");
