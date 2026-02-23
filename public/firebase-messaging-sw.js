// ═══════════════════════════════════════════════════════════
//  FILE: public/firebase-messaging-sw.js
//
//  FIXES:
//  1. Always shows OS notification even when app is in foreground
//     (Chrome/Mac suppresses FCM default notification when focused)
//  2. Immediately claims all clients so postMessage works on
//     every page, not just the chat page
//  3. Correctly reads imageUrl from data payload
// ═══════════════════════════════════════════════════════════

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey           : "AIzaSyDOVZ95b_MZ7Ba5TVvpluX2Jz5h-7FXNNA",
  authDomain       : "talksy-b24e4.firebaseapp.com",
  projectId        : "talksy-b24e4",
  storageBucket    : "talksy-b24e4.firebasestorage.app",
  messagingSenderId: "19294207700",
  appId            : "1:19294207700:web:b4cd33123321f8eb784541",
});

const messaging = firebase.messaging();

// ── Activate SW immediately, claim all open tabs/iframes ──
self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ══════════════════════════════════════════════════════════
//  CORE FIX: Handle raw push event BEFORE Firebase does.
//
//  Why: Firebase messaging SDK suppresses showNotification()
//  when the app window is focused (foreground). On Mac, this
//  means no OS notification when admin is on any app page.
//
//  Solution: Intercept the push event ourselves, ALWAYS show
//  the OS notification, then also postMessage all clients
//  so the in-app toast fires too.
// ══════════════════════════════════════════════════════════
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let d = {};
  try { d = event.data.json(); } catch (_) { return; }

  // FCM wraps payload under notification + data keys
  const notif     = d.notification     || {};
  const data      = d.data             || {};
  // Also handle when Firebase puts it under webpush.notification
  const webpushN  = (d.webpush || {}).notification || {};

  const title     = notif.title     || webpushN.title     || data.title     || "💬 New Message";
  const body      = notif.body      || webpushN.body      || data.body      || "Customer sent a message";
  const shopUrl   = data.shopUrl    || webpushN.link      || "/";
  const sessionId = data.sessionId  || "";
  const tag       = data.tag        || notif.tag          || webpushN.tag   || "talksy-push";

  // ✅ Image: check all 3 locations (see app.push.send.jsx comment)
  const rawImage  = data.imageUrl   || notif.image        || webpushN.image || data.fileUrl || null;
  const imageUrl  = (rawImage && rawImage.startsWith("https://")) ? rawImage : null;

  const ICON = "https://cdn.shopify.com/app-store/listing_images/177dd497355fe743fa747f74896d9015/icon/CJmW96zmq5IDEAE=.png";

  const notifOptions = {
    body,
    icon              : ICON,
    badge             : ICON,
    tag,
    renotify          : true,
    requireInteraction: true,
    data              : { shopUrl, sessionId, tag },
    actions: [
      { action: "open",    title: "Open Chat" },
      { action: "dismiss", title: "Dismiss"   },
    ],
    // ✅ Image shown in OS notification
    ...(imageUrl ? { image: imageUrl } : {}),
  };

  event.waitUntil(
    Promise.all([
      // ── 1. ALWAYS show OS notification (even if app is focused) ──
      // This is the key fix — we don't check if clients are focused.
      self.registration.showNotification(title, notifOptions),

      // ── 2. postMessage ALL clients (every open page/iframe) ──
      // This drives the in-app toast in app.jsx on whichever page
      // the admin currently has open.
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type    : "TALKSY_PUSH",
            title,
            body,
            imageUrl: imageUrl || null,
            shopUrl,
            sessionId,
          });
        });
      }),
    ])
  );
});

// ── Notification click ─────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const shopUrl   = event.notification.data?.shopUrl || "/";
  const sessionId = event.notification.data?.sessionId;
  const targetUrl = sessionId ? `${shopUrl}?session=${sessionId}` : shopUrl;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(shopUrl) && "focus" in client) {
          client.focus();
          client.postMessage({ type: "TALKSY_OPEN_SESSION", sessionId });
          return;
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// ── Background message handler (Firebase default) ─────────
// Only fires for messages when NO push event listener above
// catches it — kept as fallback but our push handler above
// takes priority.
messaging.onBackgroundMessage((payload) => {
  // Already handled above — this is a safety net only.
  console.log("[SW] onBackgroundMessage (fallback):", payload);
});