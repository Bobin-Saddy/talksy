// ============================================================
// firebase-messaging-sw.js
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAkp3v6YWY4HexFQ7Z0BYPGMeG18IXXqWg",
  authDomain: "shopify-talksy.firebaseapp.com",
  projectId: "shopify-talksy",
  storageBucket: "shopify-talksy.firebasestorage.app",
  messagingSenderId: "547076667229",
  appId: "1:547076667229:web:e65ed249fe33f7724e9ab4"
});

const messaging = firebase.messaging();

// Background message handler (jab browser/tab active nahi ho)
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || '💬 New Message';
  const notificationOptions = {
    body: payload.notification?.body || 'Customer sent a message',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'talksy-chat-' + Date.now(),
    data: payload.data || {},
    actions: [
      { action: 'open',    title: '💬 Open Chat' },
      { action: 'close',   title: 'Dismiss'      }
    ],
    requireInteraction: true,
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'close') return;

  const shopUrl = event.notification.data?.shopUrl || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(shopUrl);
    })
  );
});