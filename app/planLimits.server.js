// app/utils/planLimits.server.js - COMPLETE WITH ACCESS CONTROL
import prisma from "../db.server";

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
    maxChats: -1,
    maxSearchUsers: -1,
    chatHistoryDays: -1,
    canManageFAQs: true,
    canCustomizeWidget: true,
    canCreateCustomFAQPage: true,
  },
};

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
    status: subscription.status,
  };
}

/**
 * ✅ Check if user has access to a feature based on plan AND subscription status
 */
export async function checkFeatureAccess(shop, feature) {
  const { subscription, limits } = await getShopLimits(shop);
  
  const hasActiveSubscription = subscription.status === "active" || subscription.status === "trialing";
  
  if (subscription.plan !== "FREE" && !hasActiveSubscription) {
    return { 
      hasAccess: false, 
      reason: "subscription_inactive",
      status: subscription.status,
      redirectTo: `/app/subscription?error=subscription-inactive&status=${subscription.status}`
    };
  }

  switch (feature) {
    case "search":
      if (subscription.plan === "FREE") {
        return { 
          hasAccess: false, 
          reason: "upgrade_required",
          redirectTo: "/app/subscription?error=upgrade-required&feature=search"
        };
      }
      return { hasAccess: true };

    case "settings":
      if (!limits.canCustomizeWidget) {
        return { 
          hasAccess: false, 
          reason: "upgrade_required",
          redirectTo: "/app/subscription?error=upgrade-required&feature=settings"
        };
      }
      return { hasAccess: true };

    case "faqs":
      if (!limits.canManageFAQs) {
        return { 
          hasAccess: false, 
          reason: "upgrade_required",
          redirectTo: "/app/subscription?error=upgrade-required&feature=faqs"
        };
      }
      return { hasAccess: true };

    default:
      return { hasAccess: true };
  }
}

export async function canCreateChat(shop) {
  const { limits } = await getShopLimits(shop);
  
  if (limits.maxChats === -1) return { allowed: true };

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

export async function canManageFAQs(shop) {
  const { limits } = await getShopLimits(shop);
  
  return {
    allowed: limits.canManageFAQs,
    requiresUpgrade: !limits.canManageFAQs,
  };
}

export async function canCustomizeWidget(shop) {
  const { limits } = await getShopLimits(shop);
  
  return {
    allowed: limits.canCustomizeWidget,
    requiresUpgrade: !limits.canCustomizeWidget,
  };
}

export async function canCreateCustomFAQPage(shop) {
  const { limits } = await getShopLimits(shop);
  
  return {
    allowed: limits.canCreateCustomFAQPage,
    requiresUpgrade: !limits.canCreateCustomFAQPage,
  };
}

export async function getChatHistoryDays(shop) {
  const { limits } = await getShopLimits(shop);
  
  return {
    days: limits.chatHistoryDays === -1 ? null : limits.chatHistoryDays,
    unlimited: limits.chatHistoryDays === -1,
  };
}

export async function cleanupOldChats(shop) {
  const { days, unlimited } = await getChatHistoryDays(shop);
  
  if (unlimited || !days) return { deleted: 0 };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

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

export async function getUsageStats(shop) {
  const { limits, plan, status } = await getShopLimits(shop);
  
  const chatCount = await prisma.chatSession.count({
    where: { shop },
  }).catch(err => {
    console.error("Error counting chats:", err);
    return 0;
  });

  let faqCount = 0;
  try {
    if (prisma.fAQ) {
      faqCount = await prisma.fAQ.count({
        where: { shop },
      });
    }
  } catch (err) {
    console.log("FAQ table not available (this is normal if not created yet)");
  }

  return {
    plan,
    status,
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