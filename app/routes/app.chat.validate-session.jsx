// app/routes/app.chat.validate-session.jsx
import { json } from "@remix-run/node";
import prisma from "../db.server";

const headers = { 
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = () => json({}, { headers });

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const { shop, sessionId, email } = await request.json();
    
    console.log("Validating session:", { shop, sessionId, email });

    if (!shop || !sessionId || !email) {
      console.log("Missing required parameters");
      return json({ valid: false, error: "Missing parameters" }, { status: 400, headers });
    }

    // ✅ FIXED: Query by sessionId and email (not shop)
    const session = await prisma.chatSession.findFirst({
      where: {
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

      console.log("✅ Session valid:", session.id);
      return json({ 
        valid: true, 
        session: {
          id: session.id,
          firstName: session.firstName,
          email: session.email
        }
      }, { headers });
    }

    console.log("❌ Session not found");
    return json({ valid: false }, { status: 401, headers });

  } catch (e) { 
    console.error("Session validation error:", e);
    return json({ valid: false, error: e.message }, { status: 500, headers }); 
  }
};