// app/routes/app.chat.messages.jsx
// ✅ Returns 404 + { deleted: true } when session is auto-deleted
// Customer widget polls this — on 404 it shows "chat expired" screen

import { json } from "@remix-run/node";
import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url       = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const shop      = url.searchParams.get("shop"); // optional, for plan info

  if (!sessionId) {
    return json([], { headers: corsHeaders });
  }

  try {
    // ✅ STEP 1: Check if session EXISTS first
    const session = await prisma.chatSession.findUnique({
      where: { sessionId },
      select: { sessionId: true, shop: true },
    });

    // ✅ STEP 2: Session not found = auto-deleted → return 410 Gone with deleted flag
    if (!session) {
      // Try to get plan info for the message (use shop from query or session)
      const shopDomain = shop || null;
      let plan = "FREE";
      let planMessage = "";

      if (shopDomain) {
        try {
          const sub = await prisma.subscription.findUnique({
            where: { shop: shopDomain },
            select: { plan: true },
          });
          plan = sub?.plan || "FREE";
        } catch {}
      }

      const planMessages = {
        FREE:     "Your chat history has been cleared. Free plan keeps chats for 30 days only. Start a new chat or upgrade your plan.",
        STANDARD: "Your chat history has been cleared. Standard plan keeps chats for 6 months. Start a new chat or upgrade to Premium.",
        PREMIUM:  "Your chat session has ended. Please start a new chat.",
      };
      planMessage = planMessages[plan] || planMessages.FREE;

      // Return 410 Gone — widget checks for this
      return json(
        {
          deleted:  true,
          plan,
          message:  planMessage,
          sessionId,
        },
        {
          status:  410, // 410 Gone = permanently deleted
          headers: corsHeaders,
        }
      );
    }

    // ✅ STEP 3: Session exists — return messages normally
    const messages = await prisma.chatMessage.findMany({
      where: { chatSessionId: sessionId },
      orderBy: { createdAt: "asc" },
      select: {
        id:            true,
        message:       true,
        sender:        true,
        fileUrl:       true,
        createdAt:     true,
        chatSessionId: true,
      },
    });

    return json(messages, { headers: corsHeaders });

  } catch (error) {
    console.error("Error fetching messages:", error);
    return json([], { status: 500, headers: corsHeaders });
  }
};