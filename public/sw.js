// ═══════════════════════════════════════════════════════════
//  FILE: sw.js   ← .JS FILE (Service Worker — plain JS)
//  PATH: Remix app → public/sw.js
//        (public folder ke root mein rakho)
//  URL:  https://yourapp.myshopify.com/sw.js
//
//  NOTE: Yeh file browser mein run hoti hai, Node.js mein nahi
//        Isliye require() ya import use nahi hota
// ═══════════════════════════════════════════════════════════

const SW_VERSION = "talksy-sw-v1";

// ════════════════════════════════════════════════════════════
//  INSTALL — Service Worker install hone pe
// ════════════════════════════════════════════════════════════
self.addEventListener("install", (event) => {
  console.log(`[Talksy SW ${SW_VERSION}] Installing...`);
  // Purane SW ka wait mat karo, turant active ho jao
  self.skipWaiting();
});

// ════════════════════════════════════════════════════════════
//  ACTIVATE — Service Worker active hone pe
// ════════════════════════════════════════════════════════════
self.addEventListener("activate", (event) => {
  console.log(`[Talksy SW ${SW_VERSION}] Activated`);
  // Saare existing clients ko is SW ke under le aao
  event.waitUntil(self.clients.claim());
});

// ════════════════════════════════════════════════════════════
//  PUSH — Server se notification aane pe
//  Railway backend webpush.sendNotification() call karta hai
//  Admin ke browser mein yeh event fire hota hai
// ════════════════════════════════════════════════════════════
self.addEventListener("push", (event) => {
  console.log("[Talksy SW] Push event received");

  if (!event.data) {
    console.log("[Talksy SW] Push event has no data, skipping");
    return;
  }

  // Payload parse karo
  let data;
  try {
    data = event.data.json();
  } catch (parseError) {
    // JSON nahi hai to plain text se fallback
    data = {
      title: "💬 New Message",
      body:  event.data.text() || "A customer sent you a message",
      url:   self.location.origin,
    };
  }

  const notificationTitle   = data.title || "💬 Talksy — New Message";
  const notificationOptions = {
    body:               data.body    || "A customer is waiting for your reply",
    tag:                data.tag     || "talksy-chat-notification",
    requireInteraction: data.requireInteraction !== false, // default: true (auto-dismiss nahi)
    vibrate:            [200, 100, 200, 100, 200],          // mobile vibration
    data: {
      url: data.url || self.location.origin,
    },
    actions: [
      {
        action: "open_chat",
        title:  "💬 Reply karo",
      },
      {
        action: "dismiss",
        title:  "Dismiss",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});

// ════════════════════════════════════════════════════════════
//  NOTIFICATIONCLICK — Admin notification pe click kare
// ════════════════════════════════════════════════════════════
self.addEventListener("notificationclick", (event) => {
  console.log("[Talksy SW] Notification clicked, action:", event.action);

  // Notification band karo
  event.notification.close();

  // "Dismiss" action — kuch mat karo
  if (event.action === "dismiss") {
    return;
  }

  // Open chat URL (Shopify admin panel)
  const targetUrl = event.notification.data?.url || self.location.origin;

  event.waitUntil(
    clients
      .matchAll({
        type:                "window",
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Dekho koi Shopify admin tab pehle se khuli hui hai?
        for (const client of windowClients) {
          if (
            (client.url.includes("shopify.com") ||
              client.url.includes("myshopify.com")) &&
            "focus" in client
          ) {
            client.focus();
            return;
          }
        }
        // Koi tab nahi mili — naya tab kholo
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ════════════════════════════════════════════════════════════
//  PUSHSUBSCRIPTIONCHANGE
//  Browser subscription expire ho jaye ya change ho jaye
//  Admin ko dobara "Notif ON" click karna hoga
// ════════════════════════════════════════════════════════════
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[Talksy SW] Push subscription changed — admin needs to re-subscribe");
  // Automatic re-subscribe nahi karte (security reason)
  // Admin ko UI se dobara enable karna hoga
});