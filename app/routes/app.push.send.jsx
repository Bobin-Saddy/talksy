// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.push.send.jsx
//
//  FIXES:
//  1. Per-session debounce (800ms) — if user sends 3 messages
//     rapidly, only ONE notification fires (with latest message)
//     → eliminates conflicts / race conditions
//  2. "Powered by Talksy" added to every notification body
//  3. sendEachForMulticast for all tokens in one Firebase call
//  4. favicon.ico — no 404 errors
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
    console.log("✅ Firebase Admin initialized");
    return _messaging;
  } catch (err) {
    console.error("❌ Firebase init error:", err.message);
    return null;
  }
}

// ── Per-session debounce map ───────────────────────────────
// Key: "{shop}:{sessionId}" → { timer, latestPayload }
// When multiple messages arrive within 800ms from same session,
// only the LAST one fires — previous timers are cancelled.
const debounceMap = new Map();
const DEBOUNCE_MS = 800;

function debounceNotification(key, payload, sendFn) {
  // Cancel any pending timer for this session
  if (debounceMap.has(key)) {
    clearTimeout(debounceMap.get(key).timer);
  }

  // Set new timer with latest payload
  const timer = setTimeout(async () => {
    debounceMap.delete(key);
    await sendFn(payload);
  }, DEBOUNCE_MS);

  debounceMap.set(key, { timer, payload });
}

// ── Core send function ─────────────────────────────────────
async function sendPushToTokens(messaging, tokens, adminTokens, payload) {
  const {
    shop, title, notifBody, resolvedImageUrl,
    sessionId, shopUrl, notifTag,
  } = payload;

  const multicastMessage = {
    tokens,

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
        icon              : "/favicon.ico",
        tag               : notifTag,
        renotify          : true,
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
        tag  : notifTag,
        ...(resolvedImageUrl ? { imageUrl: resolvedImageUrl } : {}),
      },
    },

    data: {
      shopUrl,
      imageUrl : resolvedImageUrl || "",
      fileUrl  : payload.fileUrl  || "",
      sessionId: sessionId        || "",
      shop,
      tag      : notifTag,
    },
  };

  const batchResponse = await messaging.sendEachForMulticast(multicastMessage);

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

    // Fetch all admin tokens for this shop
    let adminTokens = [];
    try {
      adminTokens = await prisma.fcmToken.findMany({
        where : { shop, type: "admin" },
        select: { id: true, token: true },
      });
    } catch (dbErr) {
      return json(
        { success: false, error: "DB error: " + dbErr.message },
        { status: 500, headers: corsHeaders }
      );
    }

    if (adminTokens.length === 0) {
      console.log(`ℹ️ No admin tokens for ${shop}`);
      return json({ success: true, sent: 0 }, { headers: corsHeaders });
    }

    // Resolve image
    const resolvedImageUrl =
      imageUrl ||
      (fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl) ? fileUrl : null) ||
      (fileUrl && fileUrl.startsWith("data:image") ? fileUrl : null) ||
      null;

    // ✅ "Powered by Talksy" added to every notification
    const rawBody = resolvedImageUrl && (!body || body === "")
      ? "📷 Customer sent an image"
      : (body || "New message");

    const notifBody = `${rawBody}\n⚡ Powered by Talksy`;

    const shopUrl  = url || `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/talksy`;
    const notifTag = `talksy-${sessionId || shop}-${Date.now()}`;
    const tokens   = adminTokens.map(t => t.token);

    const payload = {
      shop, title, notifBody, resolvedImageUrl,
      sessionId, shopUrl, notifTag, fileUrl,
    };

    // ✅ Debounce per session — rapid messages from same chat
    // collapse into a single notification (latest message wins)
    const debounceKey = `${shop}:${sessionId || "global"}`;

    debounceNotification(debounceKey, payload, async (p) => {
      try {
        await sendPushToTokens(messaging, tokens, adminTokens, p);
      } catch (err) {
        console.error("❌ Debounced send error:", err.message);
      }
    });

    // Respond immediately — notification fires after debounce delay
    return json({ success: true, queued: true }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ app.push.send error:", error);
    return json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
};