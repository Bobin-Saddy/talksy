// app/routes/webhooks.subscription.jsx
import { json } from "@remix-run/node";
import prisma from "../db.server";
import crypto from "crypto";

// Verify webhook authenticity
function verifyWebhook(body, hmacHeader, secret) {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");
  
  return hash === hmacHeader;
}

export const action = async ({ request }) => {
  try {
    // Get raw body for HMAC verification
    const rawBody = await request.text();
    const hmacHeader = request.headers.get("X-Shopify-Hmac-Sha256");
    const shop = request.headers.get("X-Shopify-Shop-Domain");
    
    // Verify webhook authenticity (important for security!)
    if (process.env.SHOPIFY_API_SECRET && hmacHeader) {
      const isValid = verifyWebhook(rawBody, hmacHeader, process.env.SHOPIFY_API_SECRET);
      if (!isValid) {
        console.error("❌ Invalid webhook signature");
        return json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const webhook = JSON.parse(rawBody);
    
    console.log("📬 Subscription webhook received:", {
      shop,
      topic: request.headers.get("X-Shopify-Topic"),
      webhookId: request.headers.get("X-Shopify-Webhook-Id"),
    });

    if (!shop) {
      return json({ error: "Missing shop header" }, { status: 400 });
    }

    // Determine webhook topic from header
    const topic = request.headers.get("X-Shopify-Topic");
    
    switch (topic) {
      case "APP_SUBSCRIPTIONS_UPDATE":
        await handleSubscriptionUpdate(shop, webhook);
        break;
      
      case "APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT":
        await handleApproachingCap(shop, webhook);
        break;
      
      default:
        console.log("Unhandled webhook topic:", topic);
    }

    return json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("❌ Webhook processing error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

async function handleSubscriptionUpdate(shop, webhook) {
  try {
    console.log("Processing subscription update for:", shop, webhook);

    // Use upsert in case subscription doesn't exist yet
    const subscription = await prisma.subscription.upsert({
      where: { shop },
      update: {
        status: mapShopifyStatus(webhook.app_subscription?.status),
        billingId: webhook.app_subscription?.id || null,
        currentPeriodEnd: webhook.app_subscription?.current_period_end 
          ? new Date(webhook.app_subscription.current_period_end) 
          : undefined,
      },
      create: {
        shop,
        plan: "FREE",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    console.log(`✅ Subscription updated for ${shop}:`, subscription.status);
  } catch (error) {
    console.error("Error updating subscription:", error);
    throw error;
  }
}

async function handleApproachingCap(shop, webhook) {
  console.log(`⚠️ Shop ${shop} is approaching capped amount:`, webhook);
  
  // You could send an email notification here
  // or create a notification in your admin dashboard
}

function mapShopifyStatus(shopifyStatus) {
  const statusMap = {
    ACTIVE: "active",
    PENDING: "pending",
    CANCELLED: "cancelled",
    EXPIRED: "expired",
    FROZEN: "frozen",
    DECLINED: "cancelled",
  };
  
  return statusMap[shopifyStatus] || "active";
}