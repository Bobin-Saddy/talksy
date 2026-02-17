// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.push.send.jsx
//  PATH: app/routes/app.push.send.jsx
//  FIX:  require() → createRequire (Remix ESM compatible)
//
//  app.chat.message.jsx → POST /app/push/send → yeh file
//  DB se admin FCM tokens dhundti hai → Firebase se push bhejti hai
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

// ── createRequire: Remix ESM mein CJS package load karne ka sahi tarika ──
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
      console.error("❌ FIREBASE_SERVICE_ACCOUNT_JSON Railway mein set nahi hai");
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
    const { shop, title, body, url } = await request.json();

    if (!shop || !title) {
      return json(
        { success: false, error: "shop aur title required hain" },
        { status: 400, headers: corsHeaders }
      );
    }

    const messaging = getMessaging();
    if (!messaging) {
      return json(
        { success: false, error: "Firebase initialize nahi hua — FIREBASE_SERVICE_ACCOUNT_JSON check karo" },
        { status: 500, headers: corsHeaders }
      );
    }

    // DB se is shop ke saare admin FCM tokens lo
    let adminTokens = [];
    try {
      adminTokens = await prisma.fcmToken.findMany({
        where : { shop, type: "admin" },
        select: { id: true, token: true },
      });
    } catch (dbErr) {
      console.error("❌ DB se tokens fetch failed:", dbErr.message);
      return json(
        { success: false, error: "DB query failed: " + dbErr.message },
        { status: 500, headers: corsHeaders }
      );
    }

    if (adminTokens.length === 0) {
      console.log(`ℹ️ ${shop} ke liye koi admin FCM token nahi — admin ne panel open nahi kiya`);
      return json(
        { success: true, sent: 0, message: "Koi admin token registered nahi" },
        { headers: corsHeaders }
      );
    }

    console.log(`📤 ${adminTokens.length} admin token(s) ko push bhej raha hoon — ${shop}`);

    let sent   = 0;
    let failed = 0;
    const expiredTokenIds = [];

    for (const { id: tokenId, token } of adminTokens) {
      try {
        await messaging.send({
          token,
          notification: { title, body },
          webpush: {
            headers: { Urgency: "high" },
            notification: {
              title,
              body,
              icon              : "/favicon.ico",
              badge             : "/favicon.ico",
              tag               : `talksy-${shop}`,
              requireInteraction: true,
              actions: [
                { action: "open",    title: "💬 Chat Kholo" },
                { action: "dismiss", title: "Dismiss"       },
              ],
            },
            fcmOptions: {
              link: url || `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/talksy`,
            },
          },
          android: {
            priority    : "high",
            notification: { sound: "default" },
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

    // Expired tokens DB se hatao
    for (const { tokenId, token } of expiredTokenIds) {
      try {
        await prisma.fcmToken.delete({ where: { id: tokenId } });
        console.log(`🗑️ Expired token remove: ...${token.slice(-8)}`);
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