// ═══════════════════════════════════════════════════════════
//  FILE: public/firebase-messaging-sw.js
//  KEY FIX: On every push received, postMessage ALL open clients
//  so the app page can show an in-app toast — even inside Shopify iframe
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

// ── Raw push event ─────────────────────────────────────────
// This fires for EVERY push — background AND foreground.
// We use this to postMessage all open clients (iframes included).
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch (_) {}

  const notification = data.notification || {};
  const customData   = data.data         || {};

  const title    = notification.title || "💬 New Message";
  const body     = notification.body  || "Customer sent a message";
  const imageUrl = notification.image || customData.imageUrl || customData.fileUrl || null;
  const sessionId = customData.sessionId || null;
  const shopUrl   = customData.shopUrl   || "/";

  // ✅ postMessage to ALL open windows/iframes so they can show in-app toast
  // This works even inside Shopify embedded iframe
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({
          type     : "TALKSY_PUSH",
          title,
          body,
          imageUrl,
          sessionId,
          shopUrl,
        });
      });

      // Also show OS notification (works when tab is hidden or browser minimized)
      return self.registration.showNotification(title, {
        body,
        icon   : "/icons/talksy-192.png",
        badge  : "/icons/talksy-badge.png",
        image  : imageUrl || undefined,
        tag    : "talksy-" + (sessionId || Date.now()),
        data   : { shopUrl, sessionId, imageUrl },
        actions: [
          { action: "open",    title: "💬 Open Chat" },
          { action: "dismiss", title: "Dismiss"      },
        ],
        requireInteraction: true,
        vibrate           : [200, 100, 200],
      });
    })
  );
});

// ── Background message handler (FCM specific) ──────────────
// This fires when Firebase FCM delivers the message in the background.
// We also postMessage here as a safety net.
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] onBackgroundMessage:", payload);

  const title    = payload.notification?.title || "💬 New Message";
  const body     = payload.notification?.body  || "Customer sent a message";
  const imageUrl = payload.notification?.image || payload.data?.imageUrl || null;
  const sessionId = payload.data?.sessionId || null;
  const shopUrl   = payload.data?.shopUrl   || "/";

  // postMessage all clients
  clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    clientList.forEach((client) => {
      client.postMessage({
        type: "TALKSY_PUSH",
        title,
        body,
        imageUrl,
        sessionId,
        shopUrl,
      });
    });
  });

  // Show OS notification
  return self.registration.showNotification(title, {
    body,
    icon   : "/icons/talksy-192.png",
    badge  : "/icons/talksy-badge.png",
    image  : imageUrl || undefined,
    tag    : "talksy-" + (sessionId || Date.now()),
    data   : { shopUrl, sessionId, imageUrl },
    actions: [
      { action: "open",    title: "💬 Open Chat" },
      { action: "dismiss", title: "Dismiss"      },
    ],
    requireInteraction: true,
    vibrate           : [200, 100, 200],
  });
});

// ── Notification click ─────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const shopUrl = event.notification.data?.shopUrl || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(shopUrl);
    })
  );
});