// app/utils/planLimits.server.js - FIXED VERSION
import prisma from "./db.server";

// Plan definitions (must match subscription page)
export const PLAN_LIMITS = {
  FREE: {
    maxChats: 100,
    maxSearchUsers: 100,
    chatHistoryDays: 30,
    canManageFAQs: false,
    canCustomizeWidget: false,
    canCreateCustomFAQPage: false,
  },
  STANDARD: {
    maxChats: 500,
    maxSearchUsers: 500,
    chatHistoryDays: 90,
    canManageFAQs: true,
    canCustomizeWidget: true,
    canCreateCustomFAQPage: false,
  },
  PREMIUM: {
    maxChats: -1, // Unlimited
    maxSearchUsers: -1,
    chatHistoryDays: -1,
    canManageFAQs: true,
    canCustomizeWidget: true,
    canCreateCustomFAQPage: true,
  },
};

/**
 * Get current subscription and limits for a shop
 */
export async function getShopLimits(shop) {
  let subscription = await prisma.subscription.findUnique({
    where: { shop },
  });

  // If no subscription exists, create a free one
  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        shop,
        plan: "FREE",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
  }

  const limits = PLAN_LIMITS[subscription.plan] || PLAN_LIMITS.FREE;

  return {
    subscription,
    limits,
    plan: subscription.plan,
  };
}

/**
 * Check if shop can create new chat session
 */
export async function canCreateChat(shop) {
  const { limits } = await getShopLimits(shop);
  
  if (limits.maxChats === -1) return { allowed: true }; // Unlimited

  const chatCount = await prisma.chatSession.count({
    where: { shop },
  });

  const allowed = chatCount < limits.maxChats;
  
  return {
    allowed,
    current: chatCount,
    max: limits.maxChats,
    remaining: limits.maxChats - chatCount,
  };
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
 * Clean up old chat sessions based on plan limits
 */
export async function cleanupOldChats(shop) {
  const { days, unlimited } = await getChatHistoryDays(shop);
  
  if (unlimited || !days) return { deleted: 0 };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.setDate() - days);

  const result = await prisma.chatSession.deleteMany({
    where: {
      shop,
      updatedAt: {
        lt: cutoffDate,
      },
    },
  });

  return { deleted: result.count };
}

/**
 * Get usage statistics for a shop - FIXED WITH ERROR HANDLING
 */
export async function getUsageStats(shop) {
  const { limits, plan } = await getShopLimits(shop);
  
  // Get chat count safely
  const chatCount = await prisma.chatSession.count({
    where: { shop },
  }).catch(err => {
    console.error("Error counting chats:", err);
    return 0;
  });

  // Try to get FAQ count, but handle if table doesn't exist
  let faqCount = 0;
  try {
    // Check if FAQ model exists in prisma schema
    if (prisma.fAQ) {
      faqCount = await prisma.fAQ.count({
        where: { shop },
      });
    }
  } catch (err) {
    // FAQ table doesn't exist yet - that's okay
    console.log("FAQ table not available (this is normal if not created yet)");
  }

  return {
    plan,
    chats: {
      current: chatCount,
      max: limits.maxChats === -1 ? "Unlimited" : limits.maxChats,
      percentage: limits.maxChats > 0 ? (chatCount / limits.maxChats) * 100 : 0,
      remaining: limits.maxChats > 0 ? Math.max(0, limits.maxChats - chatCount) : "Unlimited",
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