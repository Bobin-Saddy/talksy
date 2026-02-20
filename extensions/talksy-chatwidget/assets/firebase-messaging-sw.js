// ============================================================
// firebase-messaging-sw.js
// LOCATION: /public/firebase-messaging-sw.js
//
// FIX: data:image URLs are silently ignored by Chrome in the
//      notification "image" field. Only https:// URLs work.
//      For widget images (stored as base64), we show the Talksy
//      app icon as a rich visual placeholder instead.
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

// ✅ Talksy app icon — valid HTTPS, always loads
const TALKSY_ICON = "https://cdn.shopify.com/app-store/listing_images/177dd497355fe743fa747f74896d9015/icon/CJmW96zmq5IDEAE=.png";

// Activate SW immediately — no page reload needed
self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

// ── Helper: decide what image to show in notification ─────
// Chrome ONLY renders https:// URLs in the notification image field.
// data:image/... base64 URLs are silently ignored — notification
// shows but with no image, looking broken.
// Solution: if the image is a data: URL or missing, use Talksy icon.
function resolveNotifImage(imageUrl, isImageMessage) {
  if (imageUrl && imageUrl.startsWith("https://")) {
    return imageUrl; // valid HTTPS image — use it
  }
  if (isImageMessage) {
    return TALKSY_ICON; // image message but no valid URL — show Talksy icon
  }
  return null; // text message — no image in notification
}

// ── Helper: build and show OS notification ─────────────────
function showNotification(title, body, imageUrl, sessionId, shopUrl, isImageMessage) {
  const notifImage = resolveNotifImage(imageUrl, isImageMessage);

  return self.registration.showNotification(title, {
    body,
    icon             : TALKSY_ICON,
    badge            : TALKSY_ICON,
    image            : notifImage || undefined, // undefined = omit field entirely
    tag              : "talksy-" + (sessionId || Date.now()),
    renotify         : true,
    requireInteraction: true,
    vibrate          : [200, 100, 200],
    data             : { shopUrl, sessionId, imageUrl },
    actions          : [
      { action: "open",    title: "💬 Open Chat" },
      { action: "dismiss", title: "Dismiss"      },
    ],
  });
}

// ── Helper: postMessage all open app clients ───────────────
// Lets the in-app toast show even when admin is on another page
function notifyClients(title, body, imageUrl, sessionId, shopUrl) {
  return clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((list) => {
      list.forEach((c) =>
        c.postMessage({ type: "TALKSY_PUSH", title, body, imageUrl, sessionId, shopUrl })
      );
    });
}

// ── Raw push event — most reliable, fires for every push ──
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch (_) {}

  const n    = data.notification || {};
  const d    = data.data         || {};

  const title      = n.title  || "💬 New Message — Talksy";
  const body       = n.body   || "A customer sent a message";
  const rawImage   = n.image  || d.imageUrl || d.fileUrl || null;
  const sessionId  = d.sessionId || null;
  const shopUrl    = d.shopUrl   || "/";

  // Detect if this is an image message
  const isImageMessage = !!(rawImage) || body.includes("📷");

  event.waitUntil(
    Promise.all([
      showNotification(title, body, rawImage, sessionId, shopUrl, isImageMessage),
      notifyClients(title, body, rawImage, sessionId, shopUrl),
    ])
  );
});

// ── FCM background message handler ────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] onBackgroundMessage:', payload);

  const title      = payload.notification?.title || "💬 New Message — Talksy";
  const body       = payload.notification?.body  || "A customer sent a message";
  const rawImage   = payload.notification?.image || payload.data?.imageUrl || payload.data?.fileUrl || null;
  const sessionId  = payload.data?.sessionId || null;
  const shopUrl    = payload.data?.shopUrl   || "/";

  const isImageMessage = !!(rawImage) || body.includes("📷");

  return Promise.all([
    showNotification(title, body, rawImage, sessionId, shopUrl, isImageMessage),
    notifyClients(title, body, rawImage, sessionId, shopUrl),
  ]);
});

// ── Notification click handler ─────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const shopUrl = event.notification.data?.shopUrl || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(shopUrl);
      })
  );
});