// ============================================================
// firebase-messaging-sw.js — v7 — FORCE CACHE BUST
// LOCATION: /public/firebase-messaging-sw.js
//
// CRITICAL: After uploading this file, you MUST force the
// browser to load the new SW. Old cached SW won't read
// data.imageUrl and will show no image in notification.
//
// HOW TO FORCE UPDATE (do this once after deploy):
// Chrome DevTools → Application → Service Workers
// → Click "Update" → Then refresh the page
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey           : "AIzaSyAkp3v6YWY4HexFQ7Z0BYPGMeG18IXXqWg",
  authDomain       : "shopify-talksy.firebaseapp.com",
  projectId        : "shopify-talksy",
  storageBucket    : "shopify-talksy.firebasestorage.app",
  messagingSenderId: "547076667229",
  appId            : "1:547076667229:web:e65ed249fe33f7724e9ab4",
});

// Required for token generation — but we do NOT use onBackgroundMessage
// (it causes duplicate/different-styled notifications)
const messaging = firebase.messaging();

const TALKSY_ICON = "https://cdn.shopify.com/app-store/listing_images/177dd497355fe743fa747f74896d9015/icon/CJmW96zmq5IDEAE=.png";

// ── Activate immediately — replace old SW without page reload ─
self.addEventListener("install", (e) => {
  console.log("[SW v7] install");
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  console.log("[SW v7] activate — claiming clients");
  e.waitUntil(clients.claim());
});

// ── Image resolver ─────────────────────────────────────────
function resolveImage(rawImage, isImageMsg) {
  // Only HTTPS URLs work — Chrome silently ignores data: URLs
  if (rawImage && rawImage.startsWith("https://")) return rawImage;
  // Image message but no valid URL → use Talksy icon as placeholder
  if (isImageMsg) return TALKSY_ICON;
  return null;
}

// ── Show OS notification ───────────────────────────────────
function showNotif(title, body, rawImage, sessionId, shopUrl) {
  const isImageMsg = !!(rawImage) || body.includes("📷");
  const image = resolveImage(rawImage, isImageMsg);

  console.log("[SW v7] showNotif — image:", image || "none");

  return self.registration.showNotification(title, {
    body,
    icon             : TALKSY_ICON,
    badge            : TALKSY_ICON,
    image            : image || undefined,
    tag              : "talksy-" + (sessionId || Date.now()),
    renotify         : true,
    requireInteraction: true,
    vibrate          : [200, 100, 200],
    data             : { shopUrl, sessionId, rawImage },
    actions          : [
      { action: "open",    title: "💬 Open Chat" },
      { action: "dismiss", title: "Dismiss"      },
    ],
  });
}

// ── postMessage open app windows for in-app toast ──────────
function pingClients(title, body, imageUrl, sessionId, shopUrl) {
  return clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((list) => list.forEach((c) =>
      c.postMessage({ type: "TALKSY_PUSH", title, body, imageUrl, sessionId, shopUrl })
    ));
}

// ══════════════════════════════════════════════════════════
//  RAW PUSH EVENT — only handler, no onBackgroundMessage
//
//  Reads image from ALL possible locations in the payload:
//  - data.imageUrl  ← set by app.push.send.jsx ✅
//  - data.fileUrl   ← fallback
//  - notification.image ← FCM notification image field
// ══════════════════════════════════════════════════════════
self.addEventListener("push", (event) => {
  console.log("[SW v7] push received");

  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (_) {
    console.warn("[SW v7] Failed to parse push data");
  }

  const n = data.notification || {};
  const d = data.data         || {};

  const title     = n.title     || "💬 New Message — Talksy";
  const body      = n.body      || "A customer sent a message";
  const sessionId = d.sessionId || null;
  const shopUrl   = d.shopUrl   || "/";

  // ✅ Read image from data fields (set by push.send.jsx)
  // data.imageUrl is the HTTPS URL from our upload route
  const rawImage = d.imageUrl || d.fileUrl || n.image || null;

  console.log("[SW v7] payload imageUrl:", d.imageUrl, "| fileUrl:", d.fileUrl);

  event.waitUntil(
    Promise.all([
      showNotif(title, body, rawImage, sessionId, shopUrl),
      pingClients(title, body, rawImage, sessionId, shopUrl),
    ])
  );
});

// ── Notification click ─────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const shopUrl = event.notification.data?.shopUrl || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if (c.url.includes(self.location.origin) && "focus" in c) return c.focus();
        }
        if (clients.openWindow) return clients.openWindow(shopUrl);
      })
  );
});