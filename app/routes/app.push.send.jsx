// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.push.send.jsx
//
//  FIXES:
//  1. tag now includes sessionId + timestamp → each message shows
//     as separate notification (not replacing previous one)
//  2. Use sendEachForMulticast() to send to all tokens in ONE
//     Firebase call instead of a loop — faster + atomic
//  3. favicon.ico instead of missing icon files
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
      console.error("❌ FIREBASE_SERVICE_ACCOUNT_JSON not set");
      return null;
    }
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(svcJson)) });
    _messaging = admin.messaging();
    console.log("✅ Firebase Admin initialized");
    return _messaging;
  } catch (err) {
    console.error("❌ Firebase init error:", err.message);
    return null;
  }
}

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
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
        { success: false, error: "Firebase not initialized" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Fetch all admin FCM tokens for this shop
    let adminTokens = [];
    try {
      adminTokens = await prisma.fcmToken.findMany({
        where : { shop, type: "admin" },
        select: { id: true, token: true },
      });
    } catch (dbErr) {
      return json(
        { success: false, error: "DB query failed: " + dbErr.message },
        { status: 500, headers: corsHeaders }
      );
    }

    if (adminTokens.length === 0) {
      console.log(`ℹ️ No admin FCM tokens found for ${shop}`);
      return json(
        { success: true, sent: 0, message: "No admin tokens registered" },
        { headers: corsHeaders }
      );
    }

    // Resolve image URL
    const resolvedImageUrl =
      imageUrl ||
      (fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl) ? fileUrl : null) ||
      (fileUrl && fileUrl.startsWith("data:image") ? fileUrl : null) ||
      null;

    const notifBody = resolvedImageUrl && (!body || body === "")
      ? "📷 Customer sent an image"
      : (body || "");

    // ✅ FIX: Unique tag per message so multiple messages each show
    // as separate notifications instead of replacing each other.
    // Format: talksy-{sessionId}-{timestamp}
    const notifTag = `talksy-${sessionId || shop}-${Date.now()}`;

    const shopUrl = url ||
      `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/talksy`;

    const tokens = adminTokens.map(t => t.token);

    // ✅ FIX: sendEachForMulticast sends to ALL tokens in one Firebase call
    // Previously the loop sent one-by-one which was slower and harder to handle errors
    const multicastMessage = {
      tokens, // ← all tokens at once (max 500 per Firebase limits)

      notification: {
        title,
        body: notifBody,
        ...(resolvedImageUrl ? { imageUrl: resolvedImageUrl } : {}),
      },

      webpush: {
        headers: { Urgency: "high" },
        notification: {
          title,
          body              : notifBody,
          icon              : "/favicon.ico",  // ✅ exists — no more 404
          tag               : notifTag,        // ✅ unique per message
          renotify          : true,            // ✅ always show even same tag
          requireInteraction: true,
          ...(resolvedImageUrl ? { image: resolvedImageUrl } : {}),
          actions: [
            { action: "open",    title: "💬 Open Chat" },
            { action: "dismiss", title: "Dismiss"      },
          ],
        },
        fcmOptions: { link: shopUrl },
      },

      android: {
        priority    : "high",
        notification: {
          sound: "default",
          tag  : notifTag,  // ✅ unique per message on Android too
          ...(resolvedImageUrl ? { imageUrl: resolvedImageUrl } : {}),
        },
      },

      data: {
        shopUrl,
        imageUrl : resolvedImageUrl || "",
        fileUrl  : fileUrl          || "",
        sessionId: sessionId        || "",
        shop,
        tag      : notifTag,
      },
    };

    const batchResponse = await messaging.sendEachForMulticast(multicastMessage);

    let sent   = batchResponse.successCount;
    let failed = batchResponse.failureCount;

    // Clean up expired/invalid tokens
    const expiredTokenIds = [];
    batchResponse.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code || "";
        console.error(`❌ Push failed → ...${tokens[idx].slice(-8)}: ${code}`);
        if ([
          "messaging/invalid-registration-token",
          "messaging/registration-token-not-registered",
          "messaging/invalid-argument",
        ].includes(code)) {
          expiredTokenIds.push(adminTokens[idx].id);
        }
      }
    });

    if (expiredTokenIds.length > 0) {
      await prisma.fcmToken.deleteMany({ where: { id: { in: expiredTokenIds } } });
      console.log(`🗑️ Removed ${expiredTokenIds.length} expired token(s)`);
    }

    console.log(`📊 Push result — ${shop}: ${sent} sent, ${failed} failed`);
    return json({ success: true, sent, failed }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ app.push.send error:", error);
    return json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
};