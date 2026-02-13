// app/utils/planLimits.server.js - WITH TIME-BASED CHAT BLUR + SEARCH VISIBILITY
import prisma from "./db.server";

// Plan definitions with chat retention periods
export const PLAN_LIMITS = {
  FREE: {
    maxChats: 2,
    maxSearchUsers: 2,
    chatHistoryDays: 0.00139, // ✅ 2 minutes for testing (2/1440 days)
    // chatHistoryDays: 1, // ✅ Change to 1 for 1 day
    // chatHistoryDays: 30, // ✅ Change to 30 for production
    canManageFAQs: false,
    canCustomizeWidget: false,
    canCreateCustomFAQPage: false,
    maxVisibleSearchLogs: -1, // ✅ FREE: no search blur restriction
  },
  STANDARD: {
    maxChats: 500,
    maxSearchUsers: 500,
    chatHistoryDays: 180, // 6 months
    canManageFAQs: true,
    canCustomizeWidget: true,
    canCreateCustomFAQPage: false,
    maxVisibleSearchLogs: 2, // ✅ STANDARD: only 2 search users visible → upgrade to PREMIUM
  },
  PREMIUM: {
    maxChats: -1, // Unlimited
    maxSearchUsers: -1,
    chatHistoryDays: -1, // Never blur/delete
    canManageFAQs: true,
    canCustomizeWidget: true,
    canCreateCustomFAQPage: true,
    maxVisibleSearchLogs: -1, // ✅ PREMIUM: unlimited, no blur
  },
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
      unlimited: true
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
 * ✅ Check if a chat session should be blurred based on plan retention
 */
export async function shouldBlurChat(shop, chatCreatedAt) {
  const { limits, plan } = await getShopLimits(shop);
  
  // Premium plan - never blur
  if (limits.chatHistoryDays === -1) {
    return { 
      shouldBlur: false, 
      reason: null,
      plan,
      retentionDays: "unlimited"
    };
  }

  const chatDate = new Date(chatCreatedAt);
  const now = new Date();
  const daysSinceCreation = (now - chatDate) / (1000 * 60 * 60 * 24);
  
  const isExpired = daysSinceCreation > limits.chatHistoryDays;
  
  return {
    shouldBlur: isExpired,
    reason: isExpired ? "Chat history expired based on your plan" : null,
    plan,
    retentionDays: limits.chatHistoryDays,
    daysSinceCreation: Math.floor(daysSinceCreation),
    daysUntilBlur: Math.max(0, Math.ceil(limits.chatHistoryDays - daysSinceCreation)),
  };
}

/**
 * ✅ Mark expired chats as blurred
 */
export async function markExpiredChatsAsBlurred(shop) {
  const { limits } = await getShopLimits(shop);
  
  // Premium plan - never blur
  if (limits.chatHistoryDays === -1) {
    return { blurred: 0 };
  }

  const cutoffDate = new Date();
  cutoffDate.setTime(cutoffDate.getTime() - (limits.chatHistoryDays * 24 * 60 * 60 * 1000));

  const result = await prisma.chatSession.updateMany({
    where: {
      shop,
      createdAt: { lt: cutoffDate },
      isBlurred: { not: true },
    },
    data: {
      isBlurred: true,
      blurredAt: new Date(),
    },
  });

  return { blurred: result.count };
}

/**
 * ✅ Auto-delete blurred chats after grace period (optional)
 */
export async function deleteExpiredChats(shop, gracePeriodDays = 7) {
  const { limits } = await getShopLimits(shop);
  
  // Premium plan - never delete
  if (limits.chatHistoryDays === -1) {
    return { deleted: 0 };
  }

  const cutoffDate = new Date();
  const totalDays = limits.chatHistoryDays + gracePeriodDays;
  cutoffDate.setTime(cutoffDate.getTime() - (totalDays * 24 * 60 * 60 * 1000));

  const result = await prisma.chatSession.deleteMany({
    where: {
      shop,
      createdAt: { lt: cutoffDate },
      isBlurred: true,
    },
  });

  return { deleted: result.count };
}

/**
 * Check if shop has exceeded their limit
 */
export async function hasExceededChatLimit(shop) {
  const { limits } = await getShopLimits(shop);
  
  if (limits.maxChats === -1) return false;
  
  const chatCount = await prisma.chatSession.count({
    where: { shop },
  });

  return chatCount > limits.maxChats;
}

/**
 * Get how many chats are over the limit
 */
export async function getOverLimitCount(shop) {
  const { limits } = await getShopLimits(shop);
  
  if (limits.maxChats === -1) return 0;
  
  const chatCount = await prisma.chatSession.count({
    where: { shop },
  });

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
  
  return {
    allowed: true,
    limit: actualLimit,
    planLimit: limits.maxSearchUsers,
  };
}

/**
 * Check if shop can manage FAQs
 */
export async function canManageFAQs(shop) {
  const { limits } = await getShopLimits(shop);
  
  return {
    allowed: limits.canManageFAQs,
    requiresUpgrade: !limits.canManageFAQs,
  };
}

/**
 * Check if shop can customize widget
 */
export async function canCustomizeWidget(shop) {
  const { limits } = await getShopLimits(shop);
  
  return {
    allowed: limits.canCustomizeWidget,
    requiresUpgrade: !limits.canCustomizeWidget,
  };
}

/**
 * Check if shop can create custom FAQ pages
 */
export async function canCreateCustomFAQPage(shop) {
  const { limits } = await getShopLimits(shop);
  
  return {
    allowed: limits.canCreateCustomFAQPage,
    requiresUpgrade: !limits.canCreateCustomFAQPage,
  };
}

/**
 * Get chat history retention period
 */
export async function getChatHistoryDays(shop) {
  const { limits } = await getShopLimits(shop);
  
  return {
    days: limits.chatHistoryDays === -1 ? null : limits.chatHistoryDays,
    unlimited: limits.chatHistoryDays === -1,
  };
}

/**
 * ✅ BACKWARD COMPATIBLE: Clean up old chats (combines blur + delete)
 */
export async function cleanupOldChats(shop) {
  const blurResult = await markExpiredChatsAsBlurred(shop);
  const deleteResult = await deleteExpiredChats(shop, 7);
  
  return {
    blurred: blurResult.blurred,
    deleted: deleteResult.deleted,
    total: blurResult.blurred + deleteResult.deleted
  };
}

/**
 * Get usage statistics for a shop
 */
export async function getUsageStats(shop) {
  const { limits, plan } = await getShopLimits(shop);
  
  const chatCount = await prisma.chatSession.count({
    where: { shop },
  }).catch(err => {
    console.error("Error counting chats:", err);
    return 0;
  });

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
    faqs: {
      current: faqCount,
      canManage: limits.canManageFAQs,
    },
    features: {
      canCustomizeWidget: limits.canCustomizeWidget,
      canCreateCustomFAQPage: limits.canCreateCustomFAQPage,
    },
    retention: {
      days: limits.chatHistoryDays === -1 ? "Unlimited" : limits.chatHistoryDays,
    },
  };
}

/* ================================================================
   ✅ SEARCH LOG VISIBILITY — STANDARD → PREMIUM UPGRADE
   ================================================================
   Logic:
   - FREE plan     → -1, no restriction, all searches visible
   - STANDARD plan →  2, only 2 search users visible,
                       3rd user onwards blurred → upgrade to PREMIUM
   - PREMIUM plan  → -1, unlimited, all visible
   ================================================================ */

/**
 * ✅ Get search visibility limit for a shop based on plan
 *
 * FREE     → -1  (all visible, no blur)
 * STANDARD →  2  (only 2 visible, 3rd+ blurred → Premium upsell)
 * PREMIUM  → -1  (all visible, no blur)
 */
export async function getSearchVisibilityLimit(shop) {
  const { limits, plan } = await getShopLimits(shop);

  const visibleCount = limits.maxVisibleSearchLogs ?? -1;

  return {
    visibleCount,
    shouldBlurAfter: visibleCount,
    plan,
    // Only Standard plan triggers upgrade prompt (to Premium)
    requiresUpgrade: plan === "STANDARD" && visibleCount !== -1,
    upgradeTo: plan === "STANDARD" ? "PREMIUM" : null,
  };
}

/**
 * ✅ Apply blur status to a list of search logs
 *
 * - visibilityLimit = -1  → all logs visible (FREE & PREMIUM)
 * - visibilityLimit =  2  → first 2 visible, index 2+ get isBlurred: true (STANDARD)
 *
 * @param {Array}  searchLogs       - Array of log objects from DB
 * @param {number} visibilityLimit  - Max visible count; -1 = unlimited
 * @returns {Array} logs with isBlurred field added
 */
export function applySearchBlur(searchLogs, visibilityLimit) {
  // Unlimited (FREE & PREMIUM) — all visible, no blur
  if (visibilityLimit === -1) {
    return searchLogs.map(log => ({ ...log, isBlurred: false }));
  }

  // STANDARD plan — first 2 visible, rest blurred → Premium upgrade
  return searchLogs.map((log, index) => ({
    ...log,
    isBlurred: index >= visibilityLimit,
  }));
}