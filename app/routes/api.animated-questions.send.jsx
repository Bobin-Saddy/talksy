// ═══════════════════════════════════════════════════════════════
//  File: app/routes/api.animated-questions.send.jsx
//
//  POST /api/animated-questions/send
//
//  Yeh route:
//    1. User ka message save karta hai (sender: "user")
//    2. Agar question ka defaultAnswer set hai → bot reply save karta hai (sender: "bot")
//    3. Agar defaultAnswer nahi hai → admin ko notification jaati hai
//
//  Liquid widget is route ko call karta hai jab koi
//  animated question bubble pe click karta hai.
// ═══════════════════════════════════════════════════════════════

import { data }  from "react-router";
import prisma    from "../db.server.js";

const CORS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function action({ request }) {
  // ── OPTIONS preflight ──
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405, headers: CORS });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return data({ error: "Invalid JSON" }, { status: 400, headers: CORS });
  }

  const {
    sessionId,
    shop,
    message,
    email,
    fname        = "",
    questionId   = null,
    autoReply    = null,   // admin ne backend mein set kiya hua answer
  } = body;

  if (!sessionId || !shop || !message) {
    return data(
      { error: "sessionId, shop, and message are required" },
      { status: 400, headers: CORS }
    );
  }

  try {
    // ── Step 1: Session verify / upsert ──
    let session = await prisma.chatSession.findUnique({ where: { sessionId } });

    if (!session) {
      // Nayi session banao agar exist nahi karti
      session = await prisma.chatSession.create({
        data: {
          sessionId,
          shop,
          email    : email || "unknown@unknown.com",
          firstName: fname || "Customer",
          lastName : "",
          isResolved: false,
        },
      });
    }

    // ── Step 2: User message save karo ──
    await prisma.chatMessage.create({
      data: {
        sessionId,
        shop,
        message  : message.trim(),
        fileUrl  : null,
        sender   : "user",
        createdAt: new Date(),
      },
    });

    // ── Step 3: Session updatedAt refresh ──
    await prisma.chatSession.update({
      where: { sessionId },
      data : { updatedAt: new Date() },
    });

    // ── Step 4: Analytics — questionId click count ──
    if (questionId) {
      try {
        await prisma.animatedQuestion.update({
          where: { id: questionId },
          data : { clickCount: { increment: 1 } },
        });
      } catch (_) { /* non-critical */ }
    }

    // ── Step 5: Auto-reply logic ──
    //
    //   Case A: admin ne defaultAnswer set kiya hai
    //           → bot ke naam se reply save karo (800ms delay feel ke liye)
    //
    //   Case B: defaultAnswer nahi hai
    //           → koi bot reply nahi, admin ko message jaata hai (existing push system)
    //           → user ko "We'll get back to you" type default reply

    const trimmedAutoReply = autoReply?.trim();

    if (trimmedAutoReply && trimmedAutoReply.length > 0) {
      // ── Case A: Admin ka set kiya hua answer ──
      // Small delay so it feels like a real response
      await new Promise((r) => setTimeout(r, 800));

      await prisma.chatMessage.create({
        data: {
          sessionId,
          shop,
          message  : trimmedAutoReply,
          fileUrl  : null,
          sender   : "bot",
          createdAt: new Date(),
        },
      });

      console.log(`[AQ] Auto-replied to session ${sessionId}: "${trimmedAutoReply.substring(0, 50)}..."`);

    } else {
      // ── Case B: Koi defaultAnswer nahi — default fallback message ──
      // Isse user blank nahi dekhega, aur admin ko real message bhi jaayega
      await new Promise((r) => setTimeout(r, 600));

      await prisma.chatMessage.create({
        data: {
          sessionId,
          shop,
          message  : "Thanks for reaching out! Our team will get back to you shortly. 👋",
          fileUrl  : null,
          sender   : "bot",
          createdAt: new Date(),
        },
      });

      console.log(`[AQ] No defaultAnswer set for question "${message.substring(0, 40)}" — sent fallback reply`);
    }

    return data({ success: true }, { headers: CORS });

  } catch (err) {
    console.error("[AQ send] Error:", err.message);
    return data(
      { error: "Internal server error", detail: err.message },
      { status: 500, headers: CORS }
    );
  }
}

// GET not supported on this route
export async function loader() {
  return data({ error: "Use POST" }, { status: 405, headers: CORS });
}