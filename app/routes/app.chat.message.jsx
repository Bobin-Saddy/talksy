// app/routes/app.chat.reply.jsx - FIXED VERSION
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { canCreateChat } from "../planLimits.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = () => json({}, { headers: corsHeaders });

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { sessionId, message, sender, shop, email, fileUrl } = body;

    if (!shop) {
      return json(
        { error: "Shop parameter is required" }, 
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if this is a new session
    const existingSession = await prisma.chatSession.findUnique({
      where: { sessionId },
    });

    // ✅ CHECK PLAN LIMITS ONLY FOR NEW CHATS
    const chatLimit = await canCreateChat(shop);
    const isNewChat = !existingSession;
    const limitReached = isNewChat && !chatLimit.allowed;

    // ✅ ALWAYS CREATE THE SESSION (so admin can see it)
    const chatSession = await prisma.chatSession.upsert({
      where: { sessionId: sessionId },
      update: {
        updatedAt: new Date(),
      },
      create: {
        sessionId: sessionId,
        shop: shop || "unknown-shop",
        email: email || "customer@email.com",
        firstName: "Customer",
      },
    });

    // ✅ ALWAYS SAVE THE USER'S MESSAGE
    const newMessage = await prisma.chatMessage.create({
      data: {
        message: message,
        sender: sender || "user",
        fileUrl: fileUrl || null,
        session: {
          connect: { sessionId: chatSession.sessionId },
        },
      },
    });

    // ✅ IF LIMIT REACHED, SEND AUTO-REPLY FROM BOT
    if (limitReached) {
      const botReply = await prisma.chatMessage.create({
        data: {
          message: `Thank you for contacting us! We've reached our chat capacity on our current plan. Our team will respond to you via email at ${email || 'your registered email'} as soon as possible.`,
          sender: "bot",
          session: {
            connect: { sessionId: chatSession.sessionId },
          },
        },
      });

      console.log(`⚠️ Chat limit reached for ${shop}: ${chatLimit.current}/${chatLimit.max} - Auto-reply sent`);

      return json(
        { 
          success: true,
          newMessage,
          botReply, // ✅ Send bot reply to frontend
          limitReached: true,
          usage: {
            current: chatLimit.current + 1,
            max: chatLimit.max,
            remaining: 0,
          },
        }, 
        { headers: corsHeaders }
      );
    }

    // ✅ NORMAL RESPONSE (LIMIT NOT REACHED)
    return json(
      { 
        success: true, 
        newMessage,
        limitReached: false,
        usage: {
          current: chatLimit.current + (isNewChat ? 1 : 0),
          max: chatLimit.max,
          remaining: chatLimit.remaining - (isNewChat ? 1 : 0),
        },
      }, 
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error("Reply Error:", error);
    return json(
      { error: error.message }, 
      { status: 500, headers: corsHeaders }
    );
  }
};