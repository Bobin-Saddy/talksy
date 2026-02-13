// app/routes/app.chat.message.jsx
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { canCreateChat } from "../planLimits.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const loader = () => json({}, { headers: corsHeaders });

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { sessionId, message, fileUrl, shop, email } = body;
    
    // ✅ FIX: Always default sender to "user" if not provided or invalid
    const sender = (body.sender === "admin" || body.sender === "bot") 
      ? body.sender 
      : "user";

    console.log("📨 Message received:", { 
      sessionId, 
      sender,           // ✅ Now always defined
      shop, 
      messageLength: message?.length 
    });

    // ✅ Validate required parameters
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

    // ✅ Check if session already exists
    const existingSession = await prisma.chatSession.findUnique({
      where: { sessionId },
      select: {
        id: true,
        sessionId: true,
        shop: true,
        email: true,
        isResolved: true,
        _count: {
          select: { messages: true }
        }
      }
    });

    const isNewChat = !existingSession;

    // ✅ CHECK PLAN LIMITS ONLY FOR NEW CHATS FROM USERS
    let chatLimit = { allowed: true, current: 0, max: 0, remaining: 0 };
    let limitReached = false;

    if (isNewChat && sender === "user") {
      chatLimit = await canCreateChat(shop);
      limitReached = !chatLimit.allowed;
      
      console.log(`📊 Plan check for ${shop}:`, {
        isNewChat,
        current: chatLimit.current,
        max: chatLimit.max,
        allowed: chatLimit.allowed,
        limitReached
      });
    }

    // ✅ ALWAYS CREATE/UPDATE THE SESSION (so admin can see it)
    // Use updatedAt: new Date() to ensure polling detects the change
    const chatSession = await prisma.chatSession.upsert({
      where: { sessionId },
      update: {
        updatedAt: new Date(),
        // ✅ Update email if provided and session exists without email
        ...(email ? { email } : {}),
      },
      create: {
        sessionId,
        shop,
        email: email || "customer@email.com",
        firstName: email ? email.split('@')[0] : "Customer",
        isResolved: false,
      },
    });

    // ✅ ALWAYS SAVE THE MESSAGE
    const newMessage = await prisma.chatMessage.create({
      data: {
        message: message || "",
        sender,           // ✅ Always "user", "admin", or "bot" - never undefined
        fileUrl: fileUrl || null,
        session: {
          connect: { sessionId: chatSession.sessionId },
        },
      },
    });

    console.log(`✅ Message saved: ID=${newMessage.id}, Sender=${sender}, Session=${sessionId}`);

    // ✅ IF LIMIT REACHED ON NEW CHAT, SEND AUTO-REPLY FROM BOT
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

      console.log(`⚠️ LIMIT REACHED for ${shop}: ${chatLimit.current + 1}/${chatLimit.max} - Auto-reply sent`);

      return json(
        { 
          success: true,
          newMessage,
          botReply,
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

    // ✅ NORMAL RESPONSE
    return json(
      { 
        success: true, 
        newMessage,
        limitReached: false,
        usage: {
          current: chatLimit.current + (isNewChat ? 1 : 0),
          max: chatLimit.max || 0,
          remaining: isNewChat ? (chatLimit.remaining - 1) : chatLimit.remaining,
        },
      }, 
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error("❌ Message Error:", error);
    return json(
      { 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500, headers: corsHeaders }
    );
  }
};