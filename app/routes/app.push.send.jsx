// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.push.send.jsx
//  PATH: Remix app → app/routes/app.push.send.jsx
//
//  YEH FILE KYA KARTI HAI:
//  - app.chat.message.jsx se push notification request aati hai
//  - Admin ke registered FCM tokens dhundti hai DB se
//  - Firebase Admin SDK se push notification bhejti hai
//
//  SETUP:
//  1. npm install firebase-admin
//  2. Railway → Variables mein add karo:
//     FIREBASE_SERVICE_ACCOUNT_JSON = <service account JSON>
// ═══════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import prisma from "../db.server";

// ── CORS headers (same as your other routes) ──────────────
const corsHeaders = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = () => json({}, { headers: corsHeaders });

// ══════════════════════════════════════════════════════════
//  FIREBASE ADMIN — LAZY INITIALIZE
//  (Remix mein top-level require nahi hota, isliye lazy load)
// ══════════════════════════════════════════════════════════
let _adminApp  = null;
let _messaging = null;

function getFirebaseMessaging() {
  // Already initialized check
  if (_messaging) return _messaging;

  try {
    // Dynamic require — Remix SSR ke saath compatible
    const admin = require("firebase-admin");

    if (admin.apps.length > 0) {
      _adminApp  = admin.apps[0];
      _messaging = admin.messaging();
      return _messaging;
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) {
      console.error("❌ FIREBASE_SERVICE_ACCOUNT_JSON env var Railway mein set nahi hai!");
      return null;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    _adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    _messaging = admin.messaging();
    console.log("✅ Firebase Admin initialized — project: shopify-talksy");
    return _messaging;

  } catch (err) {
    console.error("❌ Firebase Admin init failed:", err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════
//  ADMIN FCM TOKENS — DB SE LENA
//  Prisma mein FcmToken model hona chahiye (neeche schema hai)
// ══════════════════════════════════════════════════════════
async function getAdminTokensForShop(shop) {
  try {
    const tokens = await prisma.fcmToken.findMany({
      where: { shop, type: "admin" },
      select: { token: true, id: true },
    });
    return tokens;
  } catch (err) {
    // Agar FcmToken model abhi nahi banaya toh in-memory fallback
    console.warn("⚠️ FcmToken DB query failed, using in-memory store:", err.message);
    return getInMemoryAdminTokens(shop);
  }
}

// In-memory fallback (sirf tab tak jab DB model nahi bana)
const inMemoryAdminTokens = new Map(); // shop → Set<token>

function getInMemoryAdminTokens(shop) {
  const tokens = inMemoryAdminTokens.get(shop);
  if (!tokens || tokens.size === 0) return [];
  return Array.from(tokens).map((token, i) => ({ token, id: `mem_${i}` }));
}

async function removeExpiredToken(tokenId, token) {
  try {
    // DB se hatao
    await prisma.fcmToken.delete({ where: { id: tokenId } });
    console.log(`🗑️ Expired token DB se remove kiya: ...${token.slice(-8)}`);
  } catch (_) {
    // In-memory se hatao
    for (const [shop, tokens] of inMemoryAdminTokens) {
      tokens.delete(token);
    }
    console.log(`🗑️ Expired token memory se remove kiya: ...${token.slice(-8)}`);
  }
}

// ══════════════════════════════════════════════════════════
//  MAIN ACTION — POST /app/push/send
// ══════════════════════════════════════════════════════════
export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shop, title, body, url } = await request.json();

    if (!shop || !title) {
      return json(
        { success: false, error: "shop aur title required hain" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Firebase messaging instance lo
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      return json(
        { success: false, error: "Firebase initialize nahi hua — env var check karo" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Admin tokens lo
    const adminTokens = await getAdminTokensForShop(shop);

    if (adminTokens.length === 0) {
      console.log(`ℹ️ ${shop} ke liye koi admin FCM token nahi mila`);
      return json(
        { success: true, sent: 0, message: "Koi admin token registered nahi hai" },
        { headers: corsHeaders }
      );
    }

    console.log(`📤 ${adminTokens.length} admin token(s) ko push bhej raha hoon — shop: ${shop}`);

    let sent    = 0;
    let failed  = 0;
    const expiredTokenIds = [];

    // Har admin token ko push bhejo
    for (const { token, id: tokenId } of adminTokens) {
      try {
        await messaging.send({
          token,

          // ── Notification payload ──────────────────────
          notification: { title, body },

          // ── Web Push (browser notifications) ──────────
          webpush: {
            headers: { Urgency: "high" },
            notification: {
              title,
              body,
              icon             : "/favicon.ico",
              badge            : "/favicon.ico",
              tag              : `talksy-${shop}-${Date.now()}`,
              requireInteraction: true,
              actions          : [
                { action: "open",    title: "💬 Chat Kholo" },
                { action: "dismiss", title: "Dismiss"       },
              ],
            },
            fcmOptions: {
              link: url || `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/talksy`,
            },
          },

          // ── Android (agar kabhi mobile app bane) ──────
          android: {
            priority    : "high",
            notification: { sound: "default" },
          },
        });

        sent++;
        console.log(`✅ Push sent → ...${token.slice(-8)}`);

      } catch (err) {
        failed++;
        console.error(`❌ Push failed → ...${token.slice(-8)}:`, err.code, err.message);

        // Invalid/expired tokens mark karo
        const expiredCodes = [
          "messaging/invalid-registration-token",
          "messaging/registration-token-not-registered",
          "messaging/invalid-argument",
        ];

        if (expiredCodes.includes(err.code)) {
          expiredTokenIds.push({ tokenId, token });
        }
      }
    }

    // Expired tokens clean up karo
    for (const { tokenId, token } of expiredTokenIds) {
      await removeExpiredToken(tokenId, token);
    }

    console.log(`📊 Push result for ${shop}: ${sent} sent, ${failed} failed`);

    return json(
      { success: true, sent, failed },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error("❌ Push send error:", error);
    return json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
};