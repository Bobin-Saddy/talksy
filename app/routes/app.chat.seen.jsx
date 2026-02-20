// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.chat.seen.jsx
//  PURPOSE: Mark all user messages in a session as seen
//           Called when admin opens/views a chat session
//  URL: POST /app/chat/seen
// ═══════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = () => json({}, { headers: corsHeaders });

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { sessionId, shop } = await request.json();

    if (!sessionId) {
      return json({ success: false, error: "sessionId required" }, { status: 400, headers: corsHeaders });
    }

    // Mark all unseen user messages in this session as seen
    const updated = await prisma.chatMessage.updateMany({
      where: {
        session    : { sessionId },
        sender     : "user",
        seenByAdmin: false,
      },
      data: { seenByAdmin: true },
    });

    console.log(`👁️ Marked ${updated.count} messages as seen — session: ${sessionId}`);
    return json({ success: true, markedSeen: updated.count }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ Mark seen error:", error);
    return json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
};