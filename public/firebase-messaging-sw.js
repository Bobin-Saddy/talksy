// ============================================================
// firebase-messaging-sw.js — v9 — MAC FIX (NO push handler)
// LOCATION: /public/firebase-messaging-sw.js
//
// MAC FIX EXPLANATION:
// Chrome on Mac blocks showNotification() from SWs that were
// registered inside a Shopify <iframe> context.
//
// SOLUTION: Remove the push event listener entirely.
// When there is NO push handler, Chrome intercepts the FCM
// push at the BROWSER level and displays the OS notification
// directly from the webpush.notification block in the payload.
// This path is NOT subject to the iframe restriction.
//
// The onBackgroundMessage handler from Firebase SDK is used
// ONLY to postMessage open clients (in-app toast). It does
// NOT call showNotification() — Firebase does that itself.
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

// ── Activate immediately ───────────────────────────────────
self.addEventListener("install",  (e) => { console.log("[SW v9] install");  e.waitUntil(self.skipWaiting()); });
self.addEventListener("activate", (e) => { console.log("[SW v9] activate"); e.waitUntil(clients.claim()); });

// ══════════════════════════════════════════════════════════
//  ⚠️  NO "push" EVENT LISTENER HERE — THIS IS INTENTIONAL
//
//  Having a push listener overrides Chrome's built-in FCM
//  notification display. Without it, Chrome shows the OS
//  notification automatically from the webpush.notification
//  payload at the BROWSER level (not SW/iframe level).
//
//  This is the only way to make Mac+Shopify iframe work.
// ══════════════════════════════════════════════════════════

// ── Background message: postMessage for in-app toast ──────
// Fires when FCM delivers a message. Firebase auto-shows the
// OS notification. We use this callback ONLY to send the
// in-app toast to any open windows.
messaging.onBackgroundMessage((payload) => {
  console.log("[SW v9] onBackgroundMessage:", payload?.notification?.title);

  const n         = payload.notification || {};
  const d         = payload.data         || {};
  const title     = n.title    || "💬 New Message — Talksy";
  const body      = n.body     || "A customer sent a message";
  const imageUrl  = d.imageUrl || d.fileUrl || null;
  const sessionId = d.sessionId || null;
  const shopUrl   = d.shopUrl  || "/";

  // postMessage all open windows → triggers in-app toast in app.jsx
  return clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((list) => {
      console.log(`[SW v9] pinging ${list.length} client(s)`);
      list.forEach((c) =>
        c.postMessage({ type: "TALKSY_PUSH", title, body, imageUrl, sessionId, shopUrl })
      );
    });
});

// ── Notification click ─────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const shopUrl   = event.notification.data?.shopUrl   || "/";
  const sessionId = event.notification.data?.sessionId || null;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if (c.url.includes(self.location.origin) && "focus" in c) {
            c.focus();
            if (sessionId) c.postMessage({ type: "TALKSY_OPEN_SESSION", sessionId });
            return;
          }
        }
        if (clients.openWindow) return clients.openWindow(shopUrl);
      })
  );
});