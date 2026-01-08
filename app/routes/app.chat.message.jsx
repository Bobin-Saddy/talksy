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

const chatSession = await prisma.chatSession.upsert({
  where: { sessionId: sessionId },
  update: {
    updatedAt: new Date(), // 🔥 bump chat to top
  },
  create: {
    sessionId: sessionId,
    shop: shop || "unknown-shop",
    email: email || "customer@email.com",
    firstName: "Customer"
  }
});

    const newMessage = await prisma.chatMessage.create({
      data: {
        message: message,
        sender: sender || "user",
        fileUrl: fileUrl || null, // Updated to save fileUrl
        session: {
          connect: { sessionId: chatSession.sessionId }
        }
      },
    });

    return json({ success: true, newMessage }, { headers: corsHeaders });
  } catch (error) {                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     
    console.error("Reply Error:", error);
    return json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
};