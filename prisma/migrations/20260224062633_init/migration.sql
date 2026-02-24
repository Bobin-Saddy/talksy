-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "isBlurred" BOOLEAN NOT NULL DEFAULT false,
    "blurredAt" TIMESTAMP(3),

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "chatSessionId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenByAdmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSettings" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "showPoweredBy" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChatSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminStatus" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqPage" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shopifyPageId" TEXT,
    "pageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqPageSettings" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customBackgroundImage" TEXT NOT NULL DEFAULT '',
    "customFontSize" INTEGER NOT NULL DEFAULT 16,
    "customLineHeight" DOUBLE PRECISION NOT NULL DEFAULT 1.6,

    CONSTRAINT "FaqPageSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqCategory" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'QuestionCircleIcon',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistedOrder" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "chatSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistedOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureSuggestion" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "searchType" TEXT NOT NULL,
    "userEmail" TEXT,
    "sessionId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'active',
    "billingId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "trialDays" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FcmToken" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "email" TEXT,
    "sessionId" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FcmToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatImage" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "sessionId" TEXT,
    "filename" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_sessionId_key" ON "ChatSession"("sessionId");

-- CreateIndex
CREATE INDEX "ChatSession_shop_idx" ON "ChatSession"("shop");

-- CreateIndex
CREATE INDEX "ChatSession_sessionId_idx" ON "ChatSession"("sessionId");

-- CreateIndex
CREATE INDEX "ChatSession_isBlurred_idx" ON "ChatSession"("isBlurred");

-- CreateIndex
CREATE INDEX "ChatSession_shop_createdAt_idx" ON "ChatSession"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_chatSessionId_idx" ON "ChatMessage"("chatSessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSettings_shop_key" ON "ChatSettings"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "AdminStatus_shop_key" ON "AdminStatus"("shop");

-- CreateIndex
CREATE INDEX "FaqPage_shop_idx" ON "FaqPage"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "FaqPage_shop_handle_key" ON "FaqPage"("shop", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "FaqPageSettings_shop_key" ON "FaqPageSettings"("shop");

-- CreateIndex
CREATE INDEX "FaqPageSettings_shop_idx" ON "FaqPageSettings"("shop");

-- CreateIndex
CREATE INDEX "FaqCategory_shop_idx" ON "FaqCategory"("shop");

-- CreateIndex
CREATE INDEX "FaqCategory_shop_position_idx" ON "FaqCategory"("shop", "position");

-- CreateIndex
CREATE INDEX "Faq_shop_idx" ON "Faq"("shop");

-- CreateIndex
CREATE INDEX "Faq_categoryId_position_idx" ON "Faq"("categoryId", "position");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_shop_idx" ON "FeatureSuggestion"("shop");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_status_idx" ON "FeatureSuggestion"("status");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_createdAt_idx" ON "FeatureSuggestion"("createdAt");

-- CreateIndex
CREATE INDEX "SearchLog_shop_idx" ON "SearchLog"("shop");

-- CreateIndex
CREATE INDEX "SearchLog_createdAt_idx" ON "SearchLog"("createdAt");

-- CreateIndex
CREATE INDEX "SearchLog_searchType_idx" ON "SearchLog"("searchType");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_shop_key" ON "Subscription"("shop");

-- CreateIndex
CREATE INDEX "Subscription_shop_idx" ON "Subscription"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_shop_idx" ON "PushSubscription"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "FcmToken_token_key" ON "FcmToken"("token");

-- CreateIndex
CREATE INDEX "FcmToken_shop_type_idx" ON "FcmToken"("shop", "type");

-- CreateIndex
CREATE INDEX "FcmToken_shop_idx" ON "FcmToken"("shop");

-- CreateIndex
CREATE INDEX "ChatImage_shop_idx" ON "ChatImage"("shop");

-- CreateIndex
CREATE INDEX "ChatImage_sessionId_idx" ON "ChatImage"("sessionId");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession"("sessionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FaqCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
