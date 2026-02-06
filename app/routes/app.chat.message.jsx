// app/routes/app.chat.reply.jsx - WITH PLAN LIMITS
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { canCreateChat } from "./app.planLimits";

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

    // ✅ CHECK PLAN LIMITS BEFORE CREATING NEW CHAT
    const chatLimit = await canCreateChat(shop);
    
    // Check if this is a new session
    const existingSession = await prisma.chatSession.findUnique({
      where: { sessionId },
    });

    // If it's a new session and limit is reached, deny creation
    if (!existingSession && !chatLimit.allowed) {
      console.log(`🚫 Chat limit reached for ${shop}: ${chatLimit.current}/${chatLimit.max}`);
      
      return json(
        { 
          error: "PLAN_LIMIT_REACHED",
          message: `You've reached your plan limit of ${chatLimit.max} chats. Please upgrade your plan to continue.`,
          current: chatLimit.current,
          max: chatLimit.max,
          upgradeUrl: "/app/subscription",
        }, 
        { status: 403, headers: corsHeaders }
      );
    }

    // Create or update chat session
    const chatSession = await prisma.chatSession.upsert({
      where: { sessionId: sessionId },
      update: {
        updatedAt: new Date(), // 🔥 Updates timestamp for active sessions
      },
      create: {
        sessionId: sessionId,
        shop: shop || "unknown-shop",
        email: email || "customer@email.com",
        firstName: "Customer",
      },
    });

    // Create the message
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

    // Return success with usage info
    return json(
      { 
        success: true, 
        newMessage,
        usage: chatLimit.allowed ? {
          current: chatLimit.current + (existingSession ? 0 : 1),
          max: chatLimit.max,
          remaining: chatLimit.remaining - (existingSession ? 0 : 1),
        } : null,
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