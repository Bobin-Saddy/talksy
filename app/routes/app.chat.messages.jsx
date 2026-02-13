import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ✅ Add authentication to prevent HTML redirects
  try {
    const { session } = await authenticate.admin(request);
    if (!session?.shop) {
      return json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }
  } catch (error) {
    console.error("Auth error in messages route:", error);
    return json({ error: "Authentication failed" }, { status: 401, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return json([], { headers: corsHeaders });
  }

  try {
    // ✅ Fetch messages with proper ordering
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
      }
    });

    return json(messages, { headers: corsHeaders });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return json([], { headers: corsHeaders });
  }
};