// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.push.send.jsx
//  PATH: app/routes/app.push.send.jsx
//  FIX:  require() → createRequire (Remix ESM compatible)
//
//  app.chat.message.jsx → POST /app/push/send → this file
//  Fetches admin FCM tokens from DB → sends push via Firebase
// ═══════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import { createRequire } from "module";
import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export const loader = () => json({}, { headers: corsHeaders });

// ── createRequire: correct way to load CJS packages in Remix ESM ──
const require = createRequire(import.meta.url);

let _messaging = null;

function getMessaging() {
  if (_messaging) return _messaging;
  try {
    const admin = require("firebase-admin");
    if (admin.apps.length > 0) {
      _messaging = admin.messaging();
      return _messaging;
    }
    const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!svcJson) {
      console.error("❌ FIREBASE_SERVICE_ACCOUNT_JSON is not set in Railway");
      return null;
    }
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(svcJson)) });
    _messaging = admin.messaging();
    console.log("✅ Firebase Admin initialized — project: shopify-talksy");
    return _messaging;
  } catch (err) {
    console.error("❌ Firebase init error:", err.message);
    return null;
  }
}

// ── MAIN ACTION ────────────────────────────────────────────
export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // ✅ Accept imageUrl and fileUrl so image messages show image in notification
    const { shop, title, body, url, imageUrl, fileUrl, sessionId } = await request.json();

    if (!shop || !title) {
      return json(
        { success: false, error: "shop and title are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const messaging = getMessaging();
    if (!messaging) {
      return json(
        { success: false, error: "Firebase not initialized — check FIREBASE_SERVICE_ACCOUNT_JSON" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Fetch all admin FCM tokens for this shop from DB
    let adminTokens = [];
    try {
      adminTokens = await prisma.fcmToken.findMany({
        where : { shop, type: "admin" },
        select: { id: true, token: true },
      });
    } catch (dbErr) {
      console.error("❌ Failed to fetch tokens from DB:", dbErr.message);
      return json(
        { success: false, error: "DB query failed: " + dbErr.message },
        { status: 500, headers: corsHeaders }
      );
    }

    if (adminTokens.length === 0) {
      console.log(`ℹ️ No admin FCM tokens found for ${shop} — admin has not opened the panel`);
      return json(
        { success: true, sent: 0, message: "No admin tokens registered" },
        { headers: corsHeaders }
      );
    }

    console.log(`📤 Sending push to ${adminTokens.length} admin token(s) — ${shop}`);

    // ✅ Resolve the image URL — prefer explicit imageUrl, fall back to fileUrl if it's an image
    const resolvedImageUrl =
      imageUrl ||
      (fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl) ? fileUrl : null) ||
      (fileUrl && fileUrl.startsWith("data:image") ? fileUrl : null) ||
      null;

    // ✅ If this is an image message, update the body text
    const isImageMessage = !!(resolvedImageUrl);
    const notifBody = isImageMessage && (!body || body === "")
      ? "📷 Customer sent an image"
      : (body || "");

    let sent   = 0;
    let failed = 0;
    const expiredTokenIds = [];

    for (const { id: tokenId, token } of adminTokens) {
      try {
        await messaging.send({
          token,

          // ✅ Top-level notification — used by Android & some browsers
          notification: {
            title,
            body : notifBody,
            // ✅ image field — shows large image in Android / Chrome notifications
            ...(resolvedImageUrl ? { imageUrl: resolvedImageUrl } : {}),
          },

          webpush: {
            headers: { Urgency: "high" },
            notification: {
              title,
              body  : notifBody,
              icon  : "/icons/talksy-192.png",
              badge : "/icons/talksy-badge.png",
              // ✅ image — shows large preview image inside the web push notification
              ...(resolvedImageUrl ? { image: resolvedImageUrl } : {}),
              tag               : `talksy-${shop}`,
              requireInteraction: true,
              actions: [
                { action: "open",    title: "💬 Open Chat" },
                { action: "dismiss", title: "Dismiss"      },
              ],
            },
            fcmOptions: {
              link: url ||
                `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/talksy`,
            },
          },

          android: {
            priority    : "high",
            notification: {
              sound      : "default",
              // ✅ Android large image
              ...(resolvedImageUrl ? { imageUrl: resolvedImageUrl } : {}),
            },
          },

          // ✅ Custom data fields — read by the service worker & foreground handler
          data: {
            shopUrl   : url || `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/talksy`,
            imageUrl  : resolvedImageUrl || "",
            fileUrl   : fileUrl         || "",
            sessionId : sessionId       || "",
            shop,
          },
        });

        sent++;
        console.log(`✅ Push sent → ...${token.slice(-8)}`);
      } catch (err) {
        failed++;
        console.error(`❌ Push failed → ...${token.slice(-8)}:`, err.code);
        if ([
          "messaging/invalid-registration-token",
          "messaging/registration-token-not-registered",
          "messaging/invalid-argument",
        ].includes(err.code)) {
          expiredTokenIds.push({ tokenId, token });
        }
      }
    }

    // Remove expired tokens from DB
    for (const { tokenId, token } of expiredTokenIds) {
      try {
        await prisma.fcmToken.delete({ where: { id: tokenId } });
        console.log(`🗑️ Expired token removed: ...${token.slice(-8)}`);
      } catch (_) {}
    }

    console.log(`📊 Result — ${shop}: ${sent} sent, ${failed} failed`);
    return json({ success: true, sent, failed }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ app.push.send error:", error);
    return json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
};