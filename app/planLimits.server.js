// app/utils/planLimits.server.js - PRODUCTION VERSION
import prisma from "./db.server";

// Plan definitions
export const PLAN_LIMITS = {
  FREE: {
    maxChats           : 100,
    maxSearchUsers     : 2,       // ✅ FREE: sirf 2 unique users visible
    chatHistoryDays    : 30,
    canManageFAQs      : false,
    canCustomizeWidget : false,
    canCreateCustomFAQPage: false,
    maxVisibleSearchLogs: 2,      // ✅ FIX: 2 unique users (pehle -1 tha jo galat tha)
  },
  STANDARD: {
    maxChats           : 500,
    maxSearchUsers     : 500,       // ✅ STANDARD: 3 unique users visible
    chatHistoryDays    : 180,
    canManageFAQs      : true,
    canCustomizeWidget : true,
    canCreateCustomFAQPage: false,
    maxVisibleSearchLogs: 3,      // ✅ 3 unique users
  },
  PREMIUM: {
    maxChats           : -1,
    maxSearchUsers     : -1,
    chatHistoryDays    : -1,
    canManageFAQs      : true,
    canCustomizeWidget : true,
    canCreateCustomFAQPage: true,
    maxVisibleSearchLogs: -1,     // ✅ PREMIUM: unlimited
  },
};

/**
 * Get current subscription and limits for a shop
 */
export async function getShopLimits(shop) {
  const subscription = await prisma.subscription.upsert({
    where : { shop },
    update: {},
    create: {
      shop,
      plan  : "FREE",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  const limits = PLAN_LIMITS[subscription.plan] || PLAN_LIMITS.FREE;
  return { subscription, limits, plan: subscription.plan };
}

/**
 * Check if shop can create NEW chat session
 */
export async function canCreateChat(shop) {
  const { limits } = await getShopLimits(shop);

  if (limits.maxChats === -1) {
    return { allowed: true, current: 0, max: -1, remaining: -1, unlimited: true };
  }

  const chatCount = await prisma.chatSession.count({ where: { shop } });
  const allowed   = chatCount < limits.maxChats;

  return {
    allowed,
    current  : chatCount,
    max      : limits.maxChats,
    remaining: Math.max(0, limits.maxChats - chatCount),
    unlimited: false,
  };
}

/**
 * Check if a chat session should be blurred based on plan retention
 */
export async function shouldBlurChat(shop, chatCreatedAt) {
  const { limits, plan } = await getShopLimits(shop);

  if (limits.chatHistoryDays === -1) {
    return { shouldBlur: false, reason: null, plan, retentionDays: "unlimited" };
  }

  const chatDate           = new Date(chatCreatedAt);
  const now                = new Date();
  const daysSinceCreation  = (now - chatDate) / (1000 * 60 * 60 * 24);
  const isExpired          = daysSinceCreation > limits.chatHistoryDays;

  return {
    shouldBlur        : isExpired,
    reason            : isExpired ? "Chat history expired based on your plan" : null,
    plan,
    retentionDays     : limits.chatHistoryDays,
    daysSinceCreation : Math.floor(daysSinceCreation),
    daysUntilBlur     : Math.max(0, Math.ceil(limits.chatHistoryDays - daysSinceCreation)),
  };
}

/**
 * Mark expired chats as blurred
 */
export async function markExpiredChatsAsBlurred(shop) {
  const { limits } = await getShopLimits(shop);
  if (limits.chatHistoryDays === -1) return { blurred: 0 };

  const cutoffDate = new Date();
  cutoffDate.setTime(cutoffDate.getTime() - (limits.chatHistoryDays * 24 * 60 * 60 * 1000));

  const result = await prisma.chatSession.updateMany({
    where: { shop, createdAt: { lt: cutoffDate }, isBlurred: { not: true } },
    data : { isBlurred: true, blurredAt: new Date() },
  });

  return { blurred: result.count };
}

/**
 * Auto-delete blurred chats after grace period
 */
export async function deleteExpiredChats(shop, gracePeriodDays = 7) {
  const { limits } = await getShopLimits(shop);
  if (limits.chatHistoryDays === -1) return { deleted: 0 };

  const cutoffDate = new Date();
  const totalDays  = limits.chatHistoryDays + gracePeriodDays;
  cutoffDate.setTime(cutoffDate.getTime() - (totalDays * 24 * 60 * 60 * 1000));

  const result = await prisma.chatSession.deleteMany({
    where: { shop, createdAt: { lt: cutoffDate }, isBlurred: true },
  });

  return { deleted: result.count };
}

export async function hasExceededChatLimit(shop) {
  const { limits } = await getShopLimits(shop);
  if (limits.maxChats === -1) return false;
  const chatCount = await prisma.chatSession.count({ where: { shop } });
  return chatCount > limits.maxChats;
}

export async function getOverLimitCount(shop) {
  const { limits } = await getShopLimits(shop);
  if (limits.maxChats === -1) return 0;
  const chatCount = await prisma.chatSession.count({ where: { shop } });
  return Math.max(0, chatCount - limits.maxChats);
}

export async function canSearchUsers(shop, requestedLimit = 10) {
  const { limits } = await getShopLimits(shop);
  if (limits.maxSearchUsers === -1) return { allowed: true, limit: requestedLimit };
  const actualLimit = Math.min(requestedLimit, limits.maxSearchUsers);
  return { allowed: true, limit: actualLimit, planLimit: limits.maxSearchUsers };
}

export async function canManageFAQs(shop) {
  const { limits } = await getShopLimits(shop);
  return { allowed: limits.canManageFAQs, requiresUpgrade: !limits.canManageFAQs };
}

export async function canCustomizeWidget(shop) {
  const { limits } = await getShopLimits(shop);
  return { allowed: limits.canCustomizeWidget, requiresUpgrade: !limits.canCustomizeWidget };
}

export async function canCreateCustomFAQPage(shop) {
  const { limits } = await getShopLimits(shop);
  return { allowed: limits.canCreateCustomFAQPage, requiresUpgrade: !limits.canCreateCustomFAQPage };
}

export async function getChatHistoryDays(shop) {
  const { limits } = await getShopLimits(shop);
  return { days: limits.chatHistoryDays === -1 ? null : limits.chatHistoryDays, unlimited: limits.chatHistoryDays === -1 };
}

export async function cleanupOldChats(shop) {
  const blurResult   = await markExpiredChatsAsBlurred(shop);
  const deleteResult = await deleteExpiredChats(shop, 7);
  return { blurred: blurResult.blurred, deleted: deleteResult.deleted, total: blurResult.blurred + deleteResult.deleted };
}

export async function getUsageStats(shop) {
  const { limits, plan } = await getShopLimits(shop);

  const chatCount = await prisma.chatSession.count({ where: { shop } }).catch(() => 0);

  const isOverLimit = limits.maxChats > 0 && chatCount > limits.maxChats;
  const overLimitBy = isOverLimit ? chatCount - limits.maxChats : 0;

  let faqCount = 0;
  try {
    if (prisma.fAQ) faqCount = await prisma.fAQ.count({ where: { shop } });
  } catch (_) {}

  return {
    plan,
    chats: {
      current    : chatCount,
      max        : limits.maxChats === -1 ? "Unlimited" : limits.maxChats,
      percentage : limits.maxChats > 0 ? (chatCount / limits.maxChats) * 100 : 0,
      remaining  : limits.maxChats > 0 ? Math.max(0, limits.maxChats - chatCount) : "Unlimited",
      isOverLimit,
      overLimitBy,
    },
    faqs: { current: faqCount, canManage: limits.canManageFAQs },
    features: {
      canCustomizeWidget    : limits.canCustomizeWidget,
      canCreateCustomFAQPage: limits.canCreateCustomFAQPage,
    },
    retention: { days: limits.chatHistoryDays === -1 ? "Unlimited" : limits.chatHistoryDays },
  };
}

/* ================================================================
   ✅ SEARCH LOG VISIBILITY — UNIQUE USER BASED
   ================================================================
   FREE     → 2 unique users visible, baaki blur
   STANDARD → 3 unique users visible, baaki blur
   PREMIUM  → unlimited, no blur
   ================================================================ */

/**
 * Get search visibility limit for a shop based on plan
 */
export async function getSearchVisibilityLimit(shop) {
  const { limits, plan } = await getShopLimits(shop);
  const visibleCount = limits.maxVisibleSearchLogs ?? 2;

  return {
    visibleCount,
    plan,
    isUnlimited    : visibleCount === -1,
    requiresUpgrade: plan === "STANDARD",
    upgradeTo      : plan === "FREE" ? "STANDARD" : plan === "STANDARD" ? "PREMIUM" : null,
  };
}

/**
 * ✅ Apply blur based on UNIQUE USERS — not total log count
 *
 * Logic:
 * - Logs ko chronologically process karo (oldest first = priority)
 * - Pehle N unique users ki SAARI logs visible rahein
 * - N+1 user se aage ke SAARE logs blur ho jaayein
 * - Original display order (desc) maintain hoga
 *
 * User identify karne ka order:
 * 1. email (agar anonymous nahi)
 * 2. sessionId
 * 3. log.id (anonymous, no session — treat as separate)
 *
 * Example FREE (limit=2):
 *   user_A → ✅ visible (1st unique)
 *   user_A → ✅ visible (same user)
 *   user_B → ✅ visible (2nd unique)
 *   user_C → 🔒 blur   (3rd unique — limit cross)
 *   user_C → 🔒 blur   (already blurred)
 *   user_B → ✅ visible (already counted)
 */
export function applySearchBlur(searchLogs, visibleUniqueUsersLimit) {
  // -1 = unlimited (PREMIUM) — sab visible
  if (visibleUniqueUsersLimit === -1) {
    return searchLogs.map(log => ({ ...log, isBlurred: false }));
  }

  // User key banao — email > sessionId > id (anonymous)
  function getUserKey(log) {
    if (log.userEmail && log.userEmail !== "anonymous") return `email:${log.userEmail}`;
    if (log.sessionId) return `session:${log.sessionId}`;
    return `anon:${log.id}`;
  }

  // Chronologically sort karo (oldest first) — priority ke liye
  const chronological = [...searchLogs].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );

  const visibleUsers = new Set();
  const blurredUsers = new Set();
  const blurredIds   = new Set();

  for (const log of chronological) {
    const key = getUserKey(log);

    if (blurredUsers.has(key)) {
      // Already blurred user → yeh log bhi blur
      blurredIds.add(log.id);
    } else if (visibleUsers.has(key)) {
      // Already visible user → visible rehega
    } else {
      // Naya user
      if (visibleUsers.size >= visibleUniqueUsersLimit) {
        // Limit cross → blur
        blurredUsers.add(key);
        blurredIds.add(log.id);
      } else {
        // Limit nahi cross → visible
        visibleUsers.add(key);
      }
    }
  }

  // Original order maintain karo (UI ke liye desc order)
  return searchLogs.map(log => ({
    ...log,
    isBlurred: blurredIds.has(log.id),
  }));
}