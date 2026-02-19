// ═══════════════════════════════════════════════════════════
//  FILE: public/firebase-messaging-sw.js
//
//  DEFINITIVE FIX:
//  1. Raw "push" event fires for EVERY push — no matter what page is open
//  2. ALWAYS show OS notification (works even when browser is minimized)
//  3. ALSO postMessage open clients for in-app toast
//  4. skipWaiting + clients.claim = SW activates immediately on first load
// ═══════════════════════════════════════════════════════════

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey           : "AIzaSyAkp3v6YWY4HexFQ7Z0BYPGMeG18IXXqWg",
  authDomain       : "shopify-talksy.firebaseapp.com",
  projectId        : "shopify-talksy",
  storageBucket    : "shopify-talksy.firebasestorage.app",
  messagingSenderId: "547076667229",
  appId            : "1:547076667229:web:e65ed249fe33f7724e9ab4",
});

const messaging = firebase.messaging();

// ── SW lifecycle: activate immediately without page reload ─
self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));

// ── Helpers ────────────────────────────────────────────────
function showOsNotification(title, body, imageUrl, sessionId, shopUrl) {
  return self.registration.showNotification(title, {
    body,
    icon            : "/icons/talksy-192.png",
    badge           : "/icons/talksy-badge.png",
    image           : imageUrl || undefined,
    tag             : "talksy-" + (sessionId || Date.now()),
    renotify        : true,
    requireInteraction: true,
    vibrate         : [200, 100, 200],
    data            : { shopUrl, sessionId, imageUrl },
    actions         : [
      { action: "open",    title: "💬 Open Chat" },
      { action: "dismiss", title: "Dismiss"      },
    ],
  });
}

function notifyClients(title, body, imageUrl, sessionId, shopUrl) {
  return clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((list) => {
      list.forEach((client) =>
        client.postMessage({ type: "TALKSY_PUSH", title, body, imageUrl, sessionId, shopUrl })
      );
    });
}

// ══════════════════════════════════════════════════════════
//  RAW PUSH — most reliable, fires for every push
//  Works even when admin has NO page open at all
// ══════════════════════════════════════════════════════════
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch (_) {}

  const n         = data.notification || {};
  const d         = data.data         || {};
  const title     = n.title  || "💬 New Message — Talksy";
  const body      = n.body   || "A customer sent a message";
  const imageUrl  = n.image  || d.imageUrl || d.fileUrl || null;
  const sessionId = d.sessionId || null;
  const shopUrl   = d.shopUrl   || "/";

  event.waitUntil(
    Promise.all([
      showOsNotification(title, body, imageUrl, sessionId, shopUrl),
      notifyClients(title, body, imageUrl, sessionId, shopUrl),
    ])
  );
});

// ══════════════════════════════════════════════════════════
//  FCM BACKGROUND MESSAGE — safety net for FCM delivery
// ══════════════════════════════════════════════════════════
messaging.onBackgroundMessage((payload) => {
  const title     = payload.notification?.title || "💬 New Message — Talksy";
  const body      = payload.notification?.body  || "A customer sent a message";
  const imageUrl  = payload.notification?.image || payload.data?.imageUrl || null;
  const sessionId = payload.data?.sessionId || null;
  const shopUrl   = payload.data?.shopUrl   || "/";

  return Promise.all([
    showOsNotification(title, body, imageUrl, sessionId, shopUrl),
    notifyClients(title, body, imageUrl, sessionId, shopUrl),
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
        for (const client of list) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(shopUrl);
      })
  );
});