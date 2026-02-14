// app/routes/app.chat.poll.jsx
// ✅ LIGHTWEIGHT POLLING ENDPOINT - Returns only session data as JSON
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { canCreateChat, shouldBlurChat } from "../planLimits.server";

export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;
    
    if (!shop) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("📊 Polling sessions for shop:", shop);

    // ✅ Fetch all sessions for this shop
    const sessions = await prisma.chatSession.findMany({
      where: { shop: shop },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: { createdAt: "asc" }
    });

    // ✅ Calculate chat limits
    const chatLimit = await canCreateChat(shop);

    // ✅ Add limit and blur info to each session
    const sessionsWithLimitInfo = await Promise.all(
      sessions.map(async (session, index) => {
        const isOverLimit = chatLimit.max > 0 && index >= chatLimit.max;
        const blurInfo = await shouldBlurChat(shop, session.createdAt);
        
        return {
          ...session,
          chatIndex: index + 1,
          isOverLimit: isOverLimit,
          shouldBlur: blurInfo.shouldBlur,
          blurReason: blurInfo.reason,
          retentionDays: blurInfo.retentionDays,
          currentPlan: blurInfo.plan,
        };
      })
    );

    // ✅ Sort by most recent first
    sessionsWithLimitInfo.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    console.log(`✅ Returning ${sessionsWithLimitInfo.length} sessions for ${shop}`);

    // ✅ Return ONLY JSON data (no HTML)
    return json({ 
      sessions: sessionsWithLimitInfo,
      planLimit: {
        current: sessions.length,
        max: chatLimit.max,
        remaining: chatLimit.remaining,
        isNearLimit: chatLimit.remaining <= 5 && chatLimit.remaining > 0,
        isAtLimit: !chatLimit.allowed,
        isOverLimit: chatLimit.max > 0 && sessions.length > chatLimit.max,
        overLimitBy: chatLimit.max > 0 ? Math.max(0, sessions.length - chatLimit.max) : 0,
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });

  } catch (error) {
    console.error("❌ Polling error:", error);
    return json(
      { error: error.message }, 
      { status: 500 }
    );
  }
};