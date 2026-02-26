// ═══════════════════════════════════════════════════════════════
//  File: app/routes/api.animated-questions.send.jsx
//
//  POST /api/animated-questions/send
//
//  Yeh route:
//    1. User ka message save karta hai (sender: "user")
//    2. Agar question ka defaultAnswer set hai → bot reply save karta hai
//    3. Agar defaultAnswer nahi hai → fallback "Thanks for reaching out" reply
//
//  ✅ FIX: loader added for OPTIONS preflight
// ═══════════════════════════════════════════════════════════════

import { data } from "react-router";
import prisma   from "../db.server.js";

const CORS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ✅ loader REQUIRED — OPTIONS preflight React Router yahan route karta hai
export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  return data({ ok: true }, { headers: CORS });
}

export async function action({ request }) {
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
    autoReply    = null,
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
      session = await prisma.chatSession.create({
        data: {
          sessionId,
          shop,
          email     : email || "unknown@unknown.com",
          firstName : fname || "Customer",
          lastName  : "",
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

    // ── Step 4: Analytics click count ──
    if (questionId) {
      try {
        await prisma.animatedQuestion.update({
          where: { id: questionId },
          data : { clickCount: { increment: 1 } },
        });
      } catch (_) { /* non-critical */ }
    }

    // ── Step 5: Auto-reply ──
    const trimmedAutoReply = autoReply?.trim();
    const replyText = (trimmedAutoReply && trimmedAutoReply.length > 0)
      ? trimmedAutoReply
      : "Thanks for reaching out! Our team will get back to you shortly. 👋";

    await new Promise((r) => setTimeout(r, 800));

    await prisma.chatMessage.create({
      data: {
        sessionId,
        shop,
        message  : replyText,
        fileUrl  : null,
        sender   : "bot",
        createdAt: new Date(),
      },
    });

    console.log(`[AQ send] session=${sessionId} reply="${replyText.substring(0, 50)}"`);

    return data({ success: true }, { headers: CORS });

  } catch (err) {
    console.error("[AQ send] Error:", err.message);
    return data(
      { error: "Internal server error", detail: err.message },
      { status: 500, headers: CORS }
    );
  }
}