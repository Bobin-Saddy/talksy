// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.push.send.jsx
//
//  CHANGES FROM PREVIOUS VERSION:
//  - Added title + body to data{} block so SW v9's
//    onBackgroundMessage can read them for the in-app toast
//  - Everything else unchanged
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

const TALKSY_ICON = "https://cdn.shopify.com/app-store/listing_images/177dd497355fe743fa747f74896d9015/icon/CJmW96zmq5IDEAE=.png";

function isValidHttpsUrl(url) {
  return !!(url && url.startsWith("https://") && !url.startsWith("data:"));
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
  const { shop, title, notifBody, imageUrl, fileUrl, sessionId, shopUrl, notifTag } = payload;

  const validImage = isValidHttpsUrl(imageUrl) ? imageUrl
    : isValidHttpsUrl(fileUrl) ? fileUrl
    : null;

  const isImageMsg = notifBody.includes("📷");
  const notifImage = validImage || (isImageMsg ? TALKSY_ICON : null);

  console.log(`🖼️ Notification image: ${notifImage || "none"}`);

  const message = {
    tokens,

    // Top-level notification (shown by FCM on Mac when no push handler exists in SW)
    notification: {
      title,
      body: notifBody,
    },

    webpush: {
      headers: { Urgency: "high" },
      notification: {
        title,
        body              : notifBody,
        icon              : TALKSY_ICON,
        badge             : TALKSY_ICON,
        tag               : notifTag,
        renotify          : true,
        requireInteraction: true,
        ...(notifImage ? { image: notifImage } : {}),
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
        sound: "default",
        tag  : notifTag,
        color: "#6366f1",
        ...(notifImage ? { imageUrl: notifImage } : {}),
      },
    },

    data: {
      shopUrl  : shopUrl    || "",
      imageUrl : notifImage || "",
      fileUrl  : fileUrl    || "",
      sessionId: sessionId  || "",
      shop     : shop       || "",
      tag      : notifTag   || "",
      // ✅ ADDED: title + body in data so onBackgroundMessage
      // in SW v9 can read them for the in-app toast postMessage
      title    : title      || "",
      body     : notifBody  || "",
    },
  };

  const batchResponse = await messaging.sendEachForMulticast(message);

  const expiredIds = [];
  batchResponse.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const code = resp.error?.code || "";
      console.error(`❌ Push failed → ...${tokens[idx].slice(-8)}: ${code}`);
      if ([
        "messaging/invalid-registration-token",
        "messaging/registration-token-not-registered",
        "messaging/invalid-argument",
      ].includes(code)) expiredIds.push(adminTokens[idx].id);
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

    const cleanTitle = (title || "New Message")
      .replace(/https?:\/\/[^\s]*/g, "")
      .replace(/\.myshopify\.com/g, "")
      .replace(/railway\.app/g, "")
      .trim();

    const notifTitle = `${cleanTitle} — Talksy`;
    const notifBody  = (body || "New message").replace(/\n/g, " ").trim();
    const shopUrl    = url || `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/talksy`;
    const notifTag   = `talksy-${sessionId || shop}-${Date.now()}`;
    const tokens     = adminTokens.map(t => t.token);

    const payload = {
      shop, title: notifTitle, notifBody,
      imageUrl: imageUrl || "", fileUrl: fileUrl || "",
      sessionId, shopUrl, notifTag,
    };

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