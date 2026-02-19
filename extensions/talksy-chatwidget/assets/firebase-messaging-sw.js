// ============================================================
// firebase-messaging-sw.js
// LOCATION: Place in /public folder of your Remix app
//           (serves at: https://your-domain.com/firebase-messaging-sw.js)
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

// ── Background message handler (when browser tab is not active) ──
messaging.onBackgroundMessage(function (payload) {
  console.log('[SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || '💬 New Message';

  // ✅ Extract image from multiple possible locations in the payload
  const imageUrl =
    payload.notification?.image ||   // FCM notification image field
    payload.data?.imageUrl       ||  // custom data field
    payload.data?.fileUrl        ||  // file attachment
    null;

  const isImageMessage = !!(imageUrl);
  const bodyText = isImageMessage
    ? (payload.notification?.body || '📷 Customer sent an image')
    : (payload.notification?.body || 'Customer sent a message');

  const notificationOptions = {
    body : bodyText,
    icon : '/icons/talksy-192.png',   // ← your Talksy app icon
    badge: '/icons/talksy-badge.png', // ← monochrome badge icon (72x72)
    // ✅ IMAGE — shows large image inside the notification (Chrome/Android)
    image: imageUrl || undefined,
    tag  : 'talksy-chat-' + (payload.data?.sessionId || Date.now()),
    data : {
      ...( payload.data || {} ),
      shopUrl : payload.data?.shopUrl || '/',
      imageUrl: imageUrl,
    },
    actions: [
      { action: 'open',    title: '💬 Open Chat' },
      { action: 'dismiss', title: 'Dismiss'      },
    ],
    requireInteraction: true,
    vibrate           : [200, 100, 200],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ── Notification click handler ──
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  // Dismiss action — just close
  if (event.action === 'dismiss') return;

  const shopUrl = event.notification.data?.shopUrl || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        // Focus existing open tab if found
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) return clients.openWindow(shopUrl);
      })
  );
});