// ============================================================
// firebase-messaging-sw.js — v5 (force cache refresh)
// LOCATION: /public/firebase-messaging-sw.js
//
// WHY RAILWAY NOTIFICATION WAS APPEARING:
// When FCM delivers a push but no SW "push" event handler catches
// it (e.g. old SW cached, scope mismatch, or SW not yet activated),
// the browser falls back to showing a generic notification with the
// server's origin URL (railway.app) as the source.
//
// FIXES:
// 1. skipWaiting + clients.claim = new SW activates immediately
// 2. Raw "push" event handler always intercepts before FCM SDK
// 3. onBackgroundMessage as safety net
// 4. SW version comment — changing it forces browser to re-fetch
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

const messaging = firebase.messaging();

const TALKSY_ICON = "https://cdn.shopify.com/app-store/listing_images/177dd497355fe743fa747f74896d9015/icon/CJmW96zmq5IDEAE=.png";

// ✅ CRITICAL: skipWaiting ensures new SW replaces old one immediately
// Without this, old cached SW keeps running and may not have the
// "push" handler → browser shows raw Railway notification
self.addEventListener("install", () => {
  console.log("[SW v5] Installing — skipping wait");
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  console.log("[SW v5] Activated — claiming all clients");
  e.waitUntil(clients.claim());
});

// ── Resolve image for notification ────────────────────────
function resolveImage(rawImage, isImageMsg) {
  if (rawImage && rawImage.startsWith("https://")) return rawImage;
  if (isImageMsg) return TALKSY_ICON;
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

// ── postMessage open app clients (for in-app toast) ────────
function pingClients(title, body, imageUrl, sessionId, shopUrl) {
  return clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((list) => list.forEach((c) =>
      c.postMessage({ type: "TALKSY_PUSH", title, body, imageUrl, sessionId, shopUrl })
    ));
}

// ══════════════════════════════════════════════════════════
//  RAW PUSH EVENT — MUST be first, MUST call event.waitUntil
//  This intercepts the push BEFORE the browser can show its
//  own generic notification (the Railway one you were seeing).
//  As long as this handler calls showNotification(), the
//  browser will NOT show the fallback Railway notification.
// ══════════════════════════════════════════════════════════
self.addEventListener("push", (event) => {
  console.log("[SW v5] push event received");

  let data = {};
  try { data = event.data?.json() || {}; } catch (_) {}

  const n         = data.notification || {};
  const d         = data.data         || {};
  const title     = n.title     || "💬 New Message — Talksy";
  const body      = n.body      || "A customer sent a message";
  const rawImage  = n.image     || d.imageUrl || d.fileUrl || null;
  const sessionId = d.sessionId || null;
  const shopUrl   = d.shopUrl   || "/";

  // ✅ event.waitUntil is REQUIRED — tells browser we're handling
  // this push ourselves so it must NOT show the default notification
  event.waitUntil(
    Promise.all([
      showNotif(title, body, rawImage, sessionId, shopUrl),
      pingClients(title, body, rawImage, sessionId, shopUrl),
    ])
  );
});

// ── FCM background handler — safety net ───────────────────
messaging.onBackgroundMessage((payload) => {
  console.log("[SW v5] onBackgroundMessage:", payload);

  const title     = payload.notification?.title || "💬 New Message — Talksy";
  const body      = payload.notification?.body  || "A customer sent a message";
  const rawImage  = payload.notification?.image || payload.data?.imageUrl || null;
  const sessionId = payload.data?.sessionId || null;
  const shopUrl   = payload.data?.shopUrl   || "/";

  return Promise.all([
    showNotif(title, body, rawImage, sessionId, shopUrl),
    pingClients(title, body, rawImage, sessionId, shopUrl),
  ]);
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