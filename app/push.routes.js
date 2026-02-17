// ═══════════════════════════════════════════════════════════
//  FILE: push.routes.js   ← .JS FILE (Plain Node.js)
//  PATH: Railway backend server folder mein rakho
//        Example: talksy-backend/push.routes.js
//
//  SETUP:
//    1. npm install web-push
//    2. .env mein add karo:
//         VAPID_PUBLIC_KEY=tumhari_public_key
//         VAPID_PRIVATE_KEY=tumhari_private_key
//         VAPID_EMAIL=mailto:your@email.com
//
//  server.js mein use karo:
//    const pushRoutes = require('./push.routes');
//    app.use(pushRoutes);
// ═══════════════════════════════════════════════════════════

const express = require("express");
const webpush = require("web-push");
const router  = express.Router();

// ── Tumhara existing Prisma client import karo ──
// Apna actual path check karo (db.js ya prisma.js etc.)
const prisma  = require("./db"); 

// ════════════════════════════════════════════════════════════
//  VAPID SETUP
// ════════════════════════════════════════════════════════════
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.error("❌ VAPID keys missing! .env mein add karo.");
  console.error("   npx web-push generate-vapid-keys se naye keys banao.");
} else {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL   || "mailto:support@talksy.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log("✅ Web Push (VAPID) configured.");
}

// ════════════════════════════════════════════════════════════
//  GET /app/vapid-public-key
//  Admin panel aur widget dono se call hota hai
//  Response: { publicKey: "..." }
// ════════════════════════════════════════════════════════════
router.get("/app/vapid-public-key", (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: "VAPID not configured on server" });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// ════════════════════════════════════════════════════════════
//  POST /app/admin/push-subscribe
//  Admin ka browser push subscription register karta hai
//
//  Body: {
//    shop: "example.myshopify.com",
//    subscription: {
//      endpoint: "https://fcm.googleapis.com/...",
//      keys: { p256dh: "...", auth: "..." }
//    }
//  }
// ════════════════════════════════════════════════════════════
router.post("/app/admin/push-subscribe", async (req, res) => {
  const { shop, subscription } = req.body;

  if (!shop) {
    return res.status(400).json({ error: "shop is required" });
  }
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: "Valid subscription object required" });
  }

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        shop,
        p256dh:    subscription.keys.p256dh,
        auth:      subscription.keys.auth,
        updatedAt: new Date(),
      },
      create: {
        shop,
        endpoint: subscription.endpoint,
        p256dh:   subscription.keys.p256dh,
        auth:     subscription.keys.auth,
      },
    });

    console.log(`✅ Push subscribed — shop: ${shop}`);
    res.json({ success: true, message: "Push subscription registered" });

  } catch (err) {
    console.error("Push subscribe DB error:", err);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

// ════════════════════════════════════════════════════════════
//  POST /app/admin/push-unsubscribe
//  Admin ka browser push subscription remove karta hai
//
//  Body: { shop: "...", endpoint: "https://fcm.googleapis.com/..." }
// ════════════════════════════════════════════════════════════
router.post("/app/admin/push-unsubscribe", async (req, res) => {
  const { shop, endpoint } = req.body;

  if (!shop || !endpoint) {
    return res.status(400).json({ error: "shop and endpoint required" });
  }

  try {
    await prisma.pushSubscription.deleteMany({
      where: { shop, endpoint },
    });

    console.log(`🔕 Push unsubscribed — shop: ${shop}`);
    res.json({ success: true });

  } catch (err) {
    console.error("Push unsubscribe DB error:", err);
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

// ════════════════════════════════════════════════════════════
//  POST /app/push/send
//  Remix (app.chat.message.jsx) se call hota hai
//  Jab user message bhejta hai, yeh route admin ko notify karta hai
//
//  Body: {
//    shop: "example.myshopify.com",
//    title: "💬 Ali ne message kiya",
//    body:  "Hello, mujhe help chahiye",
//    url:   "https://admin.shopify.com/..."
//  }
// ════════════════════════════════════════════════════════════
router.post("/app/push/send", async (req, res) => {
  const { shop, title, body, url } = req.body;

  if (!shop) {
    return res.status(400).json({ error: "shop is required" });
  }

  // Immediately respond — notification background mein bhejte hain
  res.json({ success: true, message: "Push sending in background" });

  // Background mein push bhejo (response block nahi karega)
  sendPushToAdmin(shop, { title, body, url }).catch((err) => {
    console.error("Background push error:", err.message);
  });
});

// ════════════════════════════════════════════════════════════
//  INTERNAL HELPER: sendPushToAdmin()
//  Yeh function directly bhi import karke use kar sakte ho:
//    const { sendPushToAdmin } = require('./push.routes');
// ════════════════════════════════════════════════════════════
async function sendPushToAdmin(shop, { title, body, url }) {
  // DB se is shop ke saare active subscriptions lo
  const subs = await prisma.pushSubscription.findMany({
    where: { shop },
  });

  if (!subs.length) {
    console.log(`ℹ️ No push subscriptions for shop: ${shop}`);
    return { sent: 0, removed: 0 };
  }

  const payload = JSON.stringify({
    title:              title || "💬 New Customer Message",
    body:               body  || "A customer is waiting for reply",
    url:                url   || "https://admin.shopify.com",
    tag:                `talksy-${shop.replace(".myshopify.com", "")}-${Date.now()}`,
    requireInteraction: true,
  });

  const expiredEndpoints = [];
  let sentCount = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth:   sub.auth,
            },
          },
          payload
        );
        sentCount++;
        console.log(`🔔 Push sent — ${sub.endpoint.substring(0, 60)}...`);

      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expire ho gayi — hata do
          expiredEndpoints.push(sub.endpoint);
          console.log(`🧹 Expired subscription: ${sub.endpoint.substring(0, 60)}...`);
        } else {
          console.error(`❌ Push send failed (${err.statusCode}): ${err.message}`);
        }
      }
    })
  );

  // Expired subscriptions DB se remove karo
  if (expiredEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: expiredEndpoints } },
    });
    console.log(`🧹 Removed ${expiredEndpoints.length} expired subscriptions for ${shop}`);
  }

  console.log(`📊 Push result for ${shop}: sent=${sentCount}, removed=${expiredEndpoints.length}`);
  return { sent: sentCount, removed: expiredEndpoints.length };
}

module.exports = router;
module.exports.sendPushToAdmin = sendPushToAdmin;