// app.chat.validate-session.jsx

import { json } from "@remix-run/node";
import prisma from "../db.server";

const headers = { 
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = () => json({}, { headers });

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    const { shop, sessionId, email } = await request.json();

    // ✅ Check if session exists and is valid
    const session = await prisma.chatSession.findFirst({
      where: {
        shop: shop,
        sessionId: sessionId,
        email: email
      }
    });

    if (session) {
      // ✅ Update last active time
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { updatedAt: new Date() }
      });

      return json({ valid: true, session }, { headers });
    }

    return json({ valid: false }, { status: 401, headers });
  } catch (e) { 
    console.error("Session validation error:", e);
    return json({ valid: false, error: e.message }, { status: 500, headers }); 
  }
};