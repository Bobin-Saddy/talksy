// ============================================================
// firebase-messaging-sw.js — v8 — MAC IFRAME FIX
// LOCATION: /public/firebase-messaging-sw.js
//
// ROOT CAUSE OF MAC BUG:
// Shopify embeds the admin app in an <iframe>. On Mac+Chrome,
// SW registered inside an iframe context has its
// showNotification() calls silently dropped by the OS — the
// SW executes fine but no OS notification appears.
//
// THE FIX:
// Do NOT call showNotification() in the push event handler.
// Instead, let FCM show the OS notification automatically
// from the webpush.notification block in the FCM payload
// (already set correctly in app.push.send.jsx). That path
// goes through Chrome's browser-level notification system,
// NOT through our iframe-registered SW context, so it works.
//
// We ONLY use the push event to postMessage open windows
// for the in-app toast. That's it.
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey           : "AIzaSyDOVZ95b_MZ7Ba5TVvpluX2Jz5h-7FXNNA",
  authDomain       : "talksy-b24e4.firebaseapp.com",
  projectId        : "talksy-b24e4",
  storageBucket    : "talksy-b24e4.firebasestorage.app",
  messagingSenderId: "19294207700",
  appId            : "1:19294207700:web:b4cd33123321f8eb784541",
});

const messaging = firebase.messaging();

// ── Activate immediately — replace old SW without page reload ─
self.addEventListener("install", (e) => {
  console.log("[SW v8] install");
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  console.log("[SW v8] activate — claiming clients");
  e.waitUntil(clients.claim());
});

// ── postMessage all open windows for in-app toast ──────────
function pingClients(title, body, imageUrl, sessionId, shopUrl) {
  return clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((list) => {
      console.log(`[SW v8] pinging ${list.length} client(s) for in-app toast`);
      list.forEach((c) =>
        c.postMessage({
          type    : "TALKSY_PUSH",
          title,
          body,
          imageUrl: imageUrl || null,
          sessionId,
          shopUrl,
        })
      );
    });
}

// ══════════════════════════════════════════════════════════
//  PUSH EVENT — ONLY postMessages clients for in-app toast.
//
//  ❌ DO NOT call showNotification() here.
//
//  REASON: On Mac+Chrome, Shopify loads your admin app
//  inside an <iframe>. Service Workers registered in an
//  iframe origin can EXECUTE but their showNotification()
//  calls are silently blocked by macOS/Chrome at the OS
//  level — you see the SW log but no notification appears.
//
//  FCM's webpush.notification payload (set in push.send.jsx)
//  is handled by Chrome's OWN notification system BEFORE
//  the SW push event fires. That path is NOT affected by
//  the iframe restriction and shows the OS notification
//  correctly on Mac.
//
//  If you add showNotification() back:
//  ✅ Mac: still broken (iframe block)
//  ❌ Android/Windows: DUPLICATE notifications
// ══════════════════════════════════════════════════════════
self.addEventListener("push", (event) => {
  console.log("[SW v8] push received");

  let data = {};
  try { data = event.data?.json() || {}; } catch (_) {}

  const n         = data.notification || {};
  const d         = data.data         || {};
  const title     = n.title           || "💬 New Message — Talksy";
  const body      = n.body            || "A customer sent a message";
  const sessionId = d.sessionId       || null;
  const shopUrl   = d.shopUrl         || "/";
  const imageUrl  = d.imageUrl        || d.fileUrl || n.image || null;

  // ONLY postMessage for the in-app toast overlay.
  // FCM automatically shows the OS notification from the
  // webpush.notification block — we don't need to do it.
  event.waitUntil(pingClients(title, body, imageUrl, sessionId, shopUrl));
});

// ══════════════════════════════════════════════════════════
//  BACKGROUND MESSAGE — fires when app is fully closed.
//  Firebase auto-shows OS notification from payload here.
//  We just log — do NOT call showNotification().
// ══════════════════════════════════════════════════════════
messaging.onBackgroundMessage((payload) => {
  console.log("[SW v8] onBackgroundMessage:", payload?.notification?.title);
  // Firebase handles OS notification display automatically.
});

// ── Notification click ─────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const shopUrl   = event.notification.data?.shopUrl || "/";
  const sessionId = event.notification.data?.sessionId;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if (c.url.includes(self.location.origin) && "focus" in c) {
            c.focus();
            if (sessionId) {
              c.postMessage({ type: "TALKSY_OPEN_SESSION", sessionId });
            }
            return;
          }
        }
        if (clients.openWindow) return clients.openWindow(shopUrl);
      })
  );
});