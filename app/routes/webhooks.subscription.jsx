// app/routes/webhooks.subscription.jsx
import { json } from "@remix-run/node";
import prisma from "../db.server";

export const action = async ({ request }) => {
  try {
    const webhook = await request.json();
    const shop = request.headers.get("X-Shopify-Shop-Domain");
    
    console.log("📬 Subscription webhook received:", {
      shop,
      type: webhook.type || "unknown",
      status: webhook.status,
    });

    if (!shop) {
      return json({ error: "Missing shop header" }, { status: 400 });
    }

    // Handle different webhook types
    switch (webhook.type) {
      case "app_subscriptions/update":
        await handleSubscriptionUpdate(shop, webhook);
        break;
      
      case "app_subscriptions/cancel":
        await handleSubscriptionCancel(shop, webhook);
        break;
      
      default:
        console.log("Unknown webhook type:", webhook.type);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

async function handleSubscriptionUpdate(shop, webhook) {
  const subscription = await prisma.subscription.findUnique({
    where: { shop },
  });

  if (!subscription) {
    console.log("No subscription found for shop:", shop);
    return;
  }

  // Update subscription status
  const status = webhook.status === "ACTIVE" ? "active" : 
                 webhook.status === "TRIAL" ? "trialing" : 
                 webhook.status === "CANCELLED" ? "cancelled" : "expired";

  await prisma.subscription.update({
    where: { shop },
    data: {
      status,
      currentPeriodEnd: webhook.current_period_end 
        ? new Date(webhook.current_period_end) 
        : subscription.currentPeriodEnd,
    },
  });

  console.log(`✅ Subscription updated for ${shop}: ${status}`);
}

async function handleSubscriptionCancel(shop, webhook) {
  await prisma.subscription.update({
    where: { shop },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
    },
  });

  console.log(`❌ Subscription cancelled for ${shop}`);
}