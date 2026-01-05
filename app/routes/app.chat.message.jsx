import { json } from "@remix-run/node";
import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = () => json({}, { headers: corsHeaders });

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await request.json();
    const { sessionId, message, sender, shop, email, fileUrl } = body;

    // 1. Ensure the session exists
    const chatSession = await prisma.chatSession.upsert({
      where: { sessionId: sessionId },
      update: { email: email || "customer@email.com" }, // Update email if it changed
      create: {
        sessionId: sessionId,
        shop: shop || "unknown-shop",
        email: email || "customer@email.com",
        firstName: "Customer"
      }
    });

    // 2. Create the message
    const newMessage = await prisma.chatMessage.create({
      data: {
        message: message,
        sender: sender || "admin", // Default to admin for this specific route
        fileUrl: fileUrl || null,
        chatSessionId: chatSession.sessionId // Direct connection is safer
      },
    });

    return json({ success: true, newMessage }, { headers: corsHeaders });
  } catch (error) {                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     
    console.error("Reply Error:", error);
    return json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
};