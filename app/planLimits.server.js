// app/utils/planLimits.server.js - WITH AUTO CHAT HISTORY DELETION
import prisma from "./db.server";

// Plan definitions (must match subscription page)
export const PLAN_LIMITS = {
  FREE: {
    maxChats: 2,
    maxSearchUsers: 2,
    chatHistoryDays: 0.00139, // ⚠️ TESTING: 2 minutes (0.00139 days) | PRODUCTION: change to 30
    canManageFAQs: false,
    canCustomizeWidget: false,
    canCreateCustomFAQPage: false,
  },
  STANDARD: {
    maxChats: 500,
    maxSearchUsers: 500,
    chatHistoryDays: 180, // 6 months
    canManageFAQs: true,
    canCustomizeWidget: true,
    canCreateCustomFAQPage: false,
  },
  PREMIUM: {
    maxChats: -1, // Unlimited
    maxSearchUsers: -1,
    chatHistoryDays: -1, // Never delete
    canManageFAQs: true,
    canCustomizeWidget: true,
    canCreateCustomFAQPage: true,
  },
};

// ✅ HUMAN-READABLE PLAN NAMES FOR MESSAGES
export const PLAN_HISTORY_LABELS = {
  FREE: "2 minutes (Testing) / 30 days (Production)",
  STANDARD: "6 months",
  PREMIUM: "Forever",
};

/**
 * Get current subscription and limits for a shop
 */
export async function getShopLimits(shop) {
  const subscription = await prisma.subscription.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      plan: "FREE",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  const limits = PLAN_LIMITS[subscription.plan] || PLAN_LIMITS.FREE;

  return {
    subscription,
    limits,
    plan: subscription.plan,
  };
}

/**
 * Check if shop can create NEW chat session
 */
export async function canCreateChat(shop) {
  const { limits } = await getShopLimits(shop);

  if (limits.maxChats === -1) {
    return {
      allowed: true,
      current: 0,
      max: -1,
      remaining: -1,
      unlimited: true,
    };
  }

  const chatCount = await prisma.chatSession.count({
    where: { shop },
  });

  const allowed = chatCount < limits.maxChats;

  return {
    allowed,
    current: chatCount,
    max: limits.maxChats,
    remaining: Math.max(0, limits.maxChats - chatCount),
    unlimited: false,
  };
}

/**
 * ✅ AUTO CLEANUP: Delete old chats based on plan limits
 * FREE    → 2 min (testing) / 30 days (production)
 * STANDARD → 180 days (6 months)
 * PREMIUM  → Never
 * Returns array of deleted sessionIds so frontend can show message
 */
export async function cleanupOldChats(shop) {
  const { limits, plan } = await getShopLimits(shop);

  // Premium = never delete
  if (limits.chatHistoryDays === -1) {
    return { deleted: 0, deletedSessionIds: [], plan };
  }

  // Calculate cutoff date
  const cutoffDate = new Date(
    Date.now() - limits.chatHistoryDays * 24 * 60 * 60 * 1000
  );

  // ✅ First, get the sessions that WILL be deleted (to return their IDs)
  const sessionsToDelete = await prisma.chatSession.findMany({
    where: {
      shop,
      updatedAt: { lt: cutoffDate },
    },
    select: {
      sessionId: true,
      email: true,
      updatedAt: true,
    },
  });

  if (sessionsToDelete.length === 0) {
    return { deleted: 0, deletedSessionIds: [], plan };
  }

  const sessionIdsToDelete = sessionsToDelete.map((s) => s.sessionId);

  // ✅ Delete messages first (foreign key), then sessions
  await prisma.chatMessage.deleteMany({
    where: { sessionId: { in: sessionIdsToDelete } },
  });

  await prisma.chatSession.deleteMany({
    where: { sessionId: { in: sessionIdsToDelete } },
  });

  console.log(
    `🗑️ Auto-deleted ${sessionsToDelete.length} old chat(s) for shop: ${shop} | Plan: ${plan} | Cutoff: ${cutoffDate.toISOString()}`
  );

  return {
    deleted: sessionsToDelete.length,
    deletedSessionIds: sessionIdsToDelete,
    plan,
    cutoffDate,
  };
}

/**
 * ✅ Run cleanup and return which active session was deleted
 * Used by admin panel to show "Chat deleted" message
 */
export async function runCleanupAndGetDeleted(shop, currentSessionId = null) {
  const result = await cleanupOldChats(shop);

  return {
    ...result,
    activeSessionDeleted:
      currentSessionId &&
      result.deletedSessionIds.includes(currentSessionId),
  };
}

/**
 * Check if a specific session has been deleted
 */
export async function isSessionDeleted(sessionId) {
  const session = await prisma.chatSession.findUnique({
    where: { sessionId },
    select: { sessionId: true },
  });
  return !session;
}

/**
 * Get chat history retention info for a shop
 */
export async function getChatHistoryDays(shop) {
  const { limits, plan } = await getShopLimits(shop);

  return {
    days: limits.chatHistoryDays === -1 ? null : limits.chatHistoryDays,
    unlimited: limits.chatHistoryDays === -1,
    label: PLAN_HISTORY_LABELS[plan] || "Unknown",
    plan,
  };
}

/**
 * Check if shop has exceeded their chat limit
 */
export async function hasExceededChatLimit(shop) {
  const { limits } = await getShopLimits(shop);
  if (limits.maxChats === -1) return false;
  const chatCount = await prisma.chatSession.count({ where: { shop } });
  return chatCount > limits.maxChats;
}

/**
 * Get how many chats are over the limit
 */
export async function getOverLimitCount(shop) {
  const { limits } = await getShopLimits(shop);
  if (limits.maxChats === -1) return 0;
  const chatCount = await prisma.chatSession.count({ where: { shop } });
  return Math.max(0, chatCount - limits.maxChats);
}

/**
 * Check if shop can search users
 */
export async function canSearchUsers(shop, requestedLimit = 10) {
  const { limits } = await getShopLimits(shop);
  if (limits.maxSearchUsers === -1) {
    return { allowed: true, limit: requestedLimit };
  }
  const actualLimit = Math.min(requestedLimit, limits.maxSearchUsers);
  return { allowed: true, limit: actualLimit, planLimit: limits.maxSearchUsers };
}

/**
 * Check if shop can manage FAQs
 */
export async function canManageFAQs(shop) {
  const { limits } = await getShopLimits(shop);
  return { allowed: limits.canManageFAQs, requiresUpgrade: !limits.canManageFAQs };
}

/**
 * Check if shop can customize widget
 */
export async function canCustomizeWidget(shop) {
  const { limits } = await getShopLimits(shop);
  return { allowed: limits.canCustomizeWidget, requiresUpgrade: !limits.canCustomizeWidget };
}

/**
 * Check if shop can create custom FAQ pages
 */
export async function canCreateCustomFAQPage(shop) {
  const { limits } = await getShopLimits(shop);
  return { allowed: limits.canCreateCustomFAQPage, requiresUpgrade: !limits.canCreateCustomFAQPage };
}

/**
 * Get usage statistics for a shop
 */
export async function getUsageStats(shop) {
  const { limits, plan } = await getShopLimits(shop);

  const chatCount = await prisma.chatSession
    .count({ where: { shop } })
    .catch(() => 0);

  const isOverLimit = limits.maxChats > 0 && chatCount > limits.maxChats;
  const overLimitBy = isOverLimit ? chatCount - limits.maxChats : 0;

  let faqCount = 0;
  try {
    if (prisma.fAQ) {
      faqCount = await prisma.fAQ.count({ where: { shop } });
    }
  } catch (err) {
    console.log("FAQ table not available");
  }

  return {
    plan,
    chats: {
      current: chatCount,
      max: limits.maxChats === -1 ? "Unlimited" : limits.maxChats,
      percentage: limits.maxChats > 0 ? (chatCount / limits.maxChats) * 100 : 0,
      remaining: limits.maxChats > 0 ? Math.max(0, limits.maxChats - chatCount) : "Unlimited",
      isOverLimit,
      overLimitBy,
    },
    faqs: { current: faqCount, canManage: limits.canManageFAQs },
    features: {
      canCustomizeWidget: limits.canCustomizeWidget,
      canCreateCustomFAQPage: limits.canCreateCustomFAQPage,
    },
    retention: {
      days: limits.chatHistoryDays === -1 ? "Unlimited" : limits.chatHistoryDays,
      label: PLAN_HISTORY_LABELS[plan],
    },
  };
}