// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.push.send.jsx
//
//  FIXES:
//  1. Removed \n from body — invalid FCM payload character
//  2. data: URLs rejected as image — only HTTPS URLs allowed by FCM
//  3. Icon = Talksy app icon from Shopify CDN
//  4. "Powered by Talksy" moved to title instead of body
//  5. Per-session debounce to prevent rapid-fire conflicts
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
    if (admin.apps.length > 0) { _messaging = admin.messaging(); return _messaging; }
    const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!svcJson) { console.error("❌ FIREBASE_SERVICE_ACCOUNT_JSON not set"); return null; }
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(svcJson)) });
    _messaging = admin.messaging();
    return _messaging;
  } catch (err) {
    console.error("❌ Firebase init error:", err.message);
    return null;
  }
}

// ✅ Talksy app icon — shown in every notification
const TALKSY_ICON = "https://cdn.shopify.com/app-store/listing_images/177dd497355fe743fa747f74896d9015/icon/CJmW96zmq5IDEAE=.png";

// ✅ Only allow HTTPS image URLs — FCM rejects data: URLs and http:
function isValidHttpsImageUrl(url) {
  if (!url) return false;
  if (url.startsWith("data:")) return false;  // data URLs not supported by FCM
  if (!url.startsWith("https://")) return false;
  return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url) || url.includes("cdn") || url.includes("storage");
}

// ── Per-session debounce ───────────────────────────────────
const debounceMap = new Map();
const DEBOUNCE_MS = 800;

function debounceNotification(key, payload, sendFn) {
  if (debounceMap.has(key)) clearTimeout(debounceMap.get(key).timer);
  const timer = setTimeout(async () => {
    debounceMap.delete(key);
    await sendFn(payload);
  }, DEBOUNCE_MS);
  debounceMap.set(key, { timer, payload });
}

// ── Core send ─────────────────────────────────────────────
async function sendPushToTokens(messaging, tokens, adminTokens, payload) {
  const { shop, title, notifBody, imageUrl, sessionId, shopUrl, notifTag, fileUrl } = payload;

  // ✅ Only use image if it's a valid HTTPS URL — skip data: URLs entirely
  const validImage = isValidHttpsImageUrl(imageUrl) ? imageUrl : null;

  // Build base message — no \n, no data: URLs
  const message = {
    tokens,

    notification: {
      title,
      body : notifBody,
    },

    webpush: {
      headers: { Urgency: "high" },
      notification: {
        title,
        body              : notifBody,
        icon              : TALKSY_ICON,   // ✅ Talksy app icon
        badge             : TALKSY_ICON,
        tag               : notifTag,
        renotify          : true,
        requireInteraction: true,
        // ✅ Only attach image if HTTPS URL — omit entirely for data: URLs
        ...(validImage ? { image: validImage } : {}),
        actions: [
          { action: "open",    title: "Open Chat" },
          { action: "dismiss", title: "Dismiss"   },
        ],
      },
      fcmOptions: { link: shopUrl },
    },

    android: {
      priority    : "high",
      notification: {
        sound       : "default",
        tag         : notifTag,
        icon        : "notification_icon",
        color       : "#6366f1",
        // ✅ Only HTTPS image for Android too
        ...(validImage ? { imageUrl: validImage } : {}),
      },
    },

    // ✅ data fields — all must be strings, no null values
    data: {
      shopUrl  : shopUrl        || "",
      imageUrl : validImage     || "",
      fileUrl  : fileUrl        || "",
      sessionId: sessionId      || "",
      shop     : shop           || "",
      tag      : notifTag       || "",
    },
  };

  const batchResponse = await messaging.sendEachForMulticast(message);

  // Clean up expired tokens
  const expiredIds = [];
  batchResponse.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const code = resp.error?.code || "";
      console.error(`❌ Push failed → ...${tokens[idx].slice(-8)}: ${code}`);
      if ([
        "messaging/invalid-registration-token",
        "messaging/registration-token-not-registered",
        "messaging/invalid-argument",
      ].includes(code)) {
        expiredIds.push(adminTokens[idx].id);
      }
    }
  });

  if (expiredIds.length > 0) {
    await prisma.fcmToken.deleteMany({ where: { id: { in: expiredIds } } });
    console.log(`🗑️ Removed ${expiredIds.length} expired token(s)`);
  }

  console.log(`📊 Push — ${shop}: ${batchResponse.successCount} sent, ${batchResponse.failureCount} failed`);
}

// ── Action ─────────────────────────────────────────────────
export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { shop, title, body, url, imageUrl, fileUrl, sessionId } = await request.json();

    if (!shop || !title) {
      return json({ success: false, error: "shop and title required" }, { status: 400, headers: corsHeaders });
    }

    const messaging = getMessaging();
    if (!messaging) {
      return json({ success: false, error: "Firebase not initialized" }, { status: 500, headers: corsHeaders });
    }

    let adminTokens = [];
    try {
      adminTokens = await prisma.fcmToken.findMany({
        where : { shop, type: "admin" },
        select: { id: true, token: true },
      });
    } catch (dbErr) {
      return json({ success: false, error: "DB error: " + dbErr.message }, { status: 500, headers: corsHeaders });
    }

    if (adminTokens.length === 0) {
      console.log(`ℹ️ No admin tokens for ${shop}`);
      return json({ success: true, sent: 0 }, { headers: corsHeaders });
    }

    // Resolve image — only HTTPS URLs pass through
    const resolvedImage =
      (imageUrl && isValidHttpsImageUrl(imageUrl)) ? imageUrl :
      (fileUrl  && isValidHttpsImageUrl(fileUrl))  ? fileUrl  :
      null;

    const isImageMsg = !!(resolvedImage);

    // ✅ "Powered by Talksy" in title, clean body (no \n)
    const notifTitle = `${title} — Talksy`;
    const notifBody  = isImageMsg && (!body || body === "")
      ? "📷 Customer sent an image"
      : (body || "New message");

    const shopUrl  = url || `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/talksy`;
    const notifTag = `talksy-${sessionId || shop}-${Date.now()}`;
    const tokens   = adminTokens.map(t => t.token);

    const payload = {
      shop,
      title    : notifTitle,
      notifBody,
      imageUrl : resolvedImage,
      fileUrl  : fileUrl || "",
      sessionId,
      shopUrl,
      notifTag,
    };

    // Debounce per session to prevent conflict on rapid messages
    const debounceKey = `${shop}:${sessionId || "global"}`;
    debounceNotification(debounceKey, payload, async (p) => {
      try {
        await sendPushToTokens(messaging, tokens, adminTokens, p);
      } catch (err) {
        console.error("❌ Send error:", err.message);
      }
    });

    return json({ success: true, queued: true }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ app.push.send error:", error);
    return json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
};