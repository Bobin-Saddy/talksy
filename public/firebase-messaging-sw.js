// ============================================================
// firebase-messaging-sw.js — v6
// LOCATION: /public/firebase-messaging-sw.js
//
// FIX: "Different notification structure" was caused by BOTH
// raw "push" event AND onBackgroundMessage firing together,
// showing two notifications with different styles.
//
// SOLUTION: Remove onBackgroundMessage entirely.
// Raw "push" event alone handles everything — it fires first,
// calls event.waitUntil(showNotification()), and the browser
// never gets a chance to show its own fallback notification.
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

// ✅ Initialize Firebase messaging (required for token generation)
// but we do NOT call onBackgroundMessage — raw push event handles all delivery
const messaging = firebase.messaging();

const TALKSY_ICON = "https://cdn.shopify.com/app-store/listing_images/177dd497355fe743fa747f74896d9015/icon/CJmW96zmq5IDEAE=.png";

// ── Activate new SW immediately ────────────────────────────
self.addEventListener("install", () => {
  console.log("[SW v6] install");
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  console.log("[SW v6] activate");
  e.waitUntil(clients.claim());
});

// ── Image URL resolver ─────────────────────────────────────
// FCM only renders https:// URLs in notification image field.
// data: URLs are silently ignored by Chrome.
function resolveImage(rawImage, isImageMsg) {
  if (rawImage && rawImage.startsWith("https://")) return rawImage;
  if (isImageMsg) return TALKSY_ICON; // placeholder for data: URL images
  return null;
}

// ── Show OS notification ───────────────────────────────────
function showNotif(title, body, rawImage, sessionId, shopUrl) {
  const isImageMsg = !!(rawImage) || body.includes("📷");
  const image      = resolveImage(rawImage, isImageMsg);

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

// ── postMessage open clients for in-app toast ──────────────
function pingClients(title, body, imageUrl, sessionId, shopUrl) {
  return clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((list) => list.forEach((c) =>
      c.postMessage({ type: "TALKSY_PUSH", title, body, imageUrl, sessionId, shopUrl })
    ));
}

// ══════════════════════════════════════════════════════════
//  RAW PUSH EVENT — this is the ONLY notification handler
//  onBackgroundMessage is intentionally removed because:
//  1. Both firing together = duplicate / mismatched notifications
//  2. Raw push event fires first and handles everything
//  3. event.waitUntil() tells browser "I handled this,
//     don't show your own fallback notification"
// ══════════════════════════════════════════════════════════
self.addEventListener("push", (event) => {
  console.log("[SW v6] push received");

  let data = {};
  try { data = event.data?.json() || {}; } catch (_) {}

  const n         = data.notification || {};
  const d         = data.data         || {};
  const title     = n.title     || "💬 New Message — Talksy";
  const body      = n.body      || "A customer sent a message";
  const rawImage  = n.image     || d.imageUrl || d.fileUrl || null;
  const sessionId = d.sessionId || null;
  const shopUrl   = d.shopUrl   || "/";

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