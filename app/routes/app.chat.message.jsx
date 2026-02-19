// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.chat.message.jsx
//  PATH: Remix app → app/routes/app.chat.message.jsx
//  CHANGES:
//    - sendPushToAdmin() passes imageUrl + fileUrl for image notifications
//    - All text converted to English
//  FIX: data:image URLs blocked before sending to FCM (invalid-payload error)
// ═══════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import prisma from "../db.server";
import { canCreateChat } from "../planLimits.server";

// ✅ Railway backend URL (for push notifications)
const BACKEND_URL = "https://talksy-production-5d43.up.railway.app";

const corsHeaders = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = () => json({}, { headers: corsHeaders });

// ── Helper — Send push notification to admin via Railway backend ──
async function sendPushToAdmin(shop, { title, body, url, imageUrl, fileUrl, sessionId }) {
  try {
    const response = await fetch(`${BACKEND_URL}/app/push/send`, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({
        shop,
        title,
        body,
        url,
        // ✅ Pass image fields so the notification can show the image
        imageUrl  : imageUrl   || "",
        fileUrl   : fileUrl    || "",
        sessionId : sessionId  || "",
      }),
    });

    if (!response.ok) {
      console.warn("⚠️ Push notification failed:", response.status);
    } else {
      console.log("🔔 Push sent to admin for shop:", shop);
    }
  } catch (err) {
    // Push failure must NOT block message delivery
    console.error("❌ Push notification error (non-blocking):", err.message);
  }
}

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { sessionId, message, fileUrl, shop, email } = body;

    // Always default sender to "user" if not provided or invalid
    const sender = (body.sender === "admin" || body.sender === "bot")
      ? body.sender
      : "user";

    // fname — used for push notification title
    const fname = body.fname || body.firstName || null;

    console.log("📨 Message received:", {
      sessionId,
      sender,
      shop,
      messageLength: message?.length,
      hasFile      : !!(fileUrl),
    });

    // Validate required parameters
    if (!shop) {
      return json(
        { error: "Shop parameter is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!sessionId) {
      return json(
        { error: "Session ID is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if session already exists
    const existingSession = await prisma.chatSession.findUnique({
      where : { sessionId },
      select: {
        id        : true,
        sessionId : true,
        shop      : true,
        email     : true,
        isResolved: true,
        _count    : { select: { messages: true } },
      },
    });

    const isNewChat = !existingSession;

    // Check plan limits only for new chats from users
    let chatLimit    = { allowed: true, current: 0, max: 0, remaining: 0 };
    let limitReached = false;

    if (isNewChat && sender === "user") {
      chatLimit    = await canCreateChat(shop);
      limitReached = !chatLimit.allowed;

      console.log(`📊 Plan check for ${shop}:`, {
        isNewChat,
        current : chatLimit.current,
        max     : chatLimit.max,
        allowed : chatLimit.allowed,
        limitReached,
      });
    }

    // Use transaction to ensure updatedAt is always updated
    const result = await prisma.$transaction(async (tx) => {
      const chatSession = await tx.chatSession.upsert({
        where : { sessionId },
        update: {
          updatedAt: new Date(),
          ...(email ? { email } : {}),
        },
        create: {
          sessionId,
          shop,
          email    : email || "customer@email.com",
          firstName: email ? email.split("@")[0] : "Customer",
          isResolved: false,
          updatedAt : new Date(),
        },
      });

      const newMessage = await tx.chatMessage.create({
        data: {
          message: message || "",
          sender,
          fileUrl: fileUrl || null,
          session: { connect: { sessionId: chatSession.sessionId } },
        },
      });

      console.log(
        `✅ Message saved: ID=${newMessage.id}, Sender=${sender}, Session=${sessionId}`
      );

      return { chatSession, newMessage };
    });

    // ── Push notification — notify admin on user messages ──────
    if (sender === "user") {
      const shopDomain  = shop.replace(".myshopify.com", "");
      const displayName = fname || (email ? email.split("@")[0] : "Customer");

      // ✅ Detect image vs file vs text
      const isImage = !!(
        fileUrl && (
          /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl) ||
          fileUrl.startsWith("data:image")
        )
      );
      const isFile  = !!(fileUrl && !isImage);

      // Build the notification title and body
      const notifTitle = `💬 New message from ${displayName}`;
      let   notifBody;

      if (isImage) {
        notifBody = "📷 Customer sent an image";
      } else if (isFile) {
        notifBody = "📎 Customer sent a file";
      } else if (message && message.trim()) {
        notifBody = message.length > 100
          ? message.substring(0, 100) + "…"
          : message;
      } else {
        // Nothing to notify about (empty message, no file)
        notifBody = null;
      }

      // Only send push if there is something to show
      if (notifBody) {
        // ✅ FIX: Never pass data: URLs to FCM — causes messaging/invalid-payload error.
        // Widget images are base64 data:image/... strings which FCM rejects completely.
        // Only forward HTTPS URLs. For data: images pass "" so push.send.jsx
        // uses the Talksy icon as a visual placeholder in the notification.
        const pushImageUrl = (isImage && fileUrl && fileUrl.startsWith("https://")) ? fileUrl : "";
        const pushFileUrl  = (isFile  && fileUrl && fileUrl.startsWith("https://")) ? fileUrl : "";

        // Non-blocking — fire and forget so response stays fast
        sendPushToAdmin(shop, {
          title    : notifTitle,
          body     : notifBody,
          url      : `https://admin.shopify.com/store/${shopDomain}/apps/talksy`,
          imageUrl : pushImageUrl,
          fileUrl  : pushFileUrl,
          sessionId,
        });
      }
    }

    // ── If limit reached on new chat — send auto-reply from bot ──
    if (limitReached) {
      const botReply = await prisma.chatMessage.create({
        data: {
          message: `Thank you for reaching out! We have reached our chat capacity on our current plan. Our team will get back to you via email at ${
            email || "your registered email"
          } as soon as possible. We appreciate your patience!`,
          sender : "bot",
          session: { connect: { sessionId: result.chatSession.sessionId } },
        },
      });

      await prisma.chatSession.update({
        where: { sessionId },
        data : { updatedAt: new Date() },
      });

      console.log(
        `⚠️ LIMIT REACHED for ${shop}: ${chatLimit.current + 1}/${chatLimit.max} — auto-reply sent`
      );

      return json(
        {
          success   : true,
          newMessage: result.newMessage,
          botReply,
          limitReached: true,
          usage: {
            current  : chatLimit.current + 1,
            max      : chatLimit.max,
            remaining: 0,
          },
        },
        { headers: corsHeaders }
      );
    }

    // ── Normal response ────────────────────────────────────────
    return json(
      {
        success     : true,
        newMessage  : result.newMessage,
        limitReached: false,
        usage: {
          current  : chatLimit.current + (isNewChat ? 1 : 0),
          max      : chatLimit.max || 0,
          remaining: isNewChat
            ? chatLimit.remaining - 1
            : chatLimit.remaining,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("❌ Message Error:", error);
    return json(
      {
        error  : error.message,
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500, headers: corsHeaders }
    );
  }
};