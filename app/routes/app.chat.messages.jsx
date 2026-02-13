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

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return json([], { headers: corsHeaders });
  }

  try {
    // ✅ FIRST: Check if session exists
    const session = await prisma.chatSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      // 🔥 Important: Return 404 if deleted
      return new Response("Session not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    // ✅ THEN: Fetch messages
    const messages = await prisma.chatMessage.findMany({
      where: { chatSessionId: sessionId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        message: true,
        sender: true,
        fileUrl: true,
        createdAt: true,
        chatSessionId: true,
      },
    });

    return json(messages, { headers: corsHeaders });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return json([], { headers: corsHeaders });
  }
};
