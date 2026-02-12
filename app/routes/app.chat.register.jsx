// app/routes/app.chat.register.jsx
import { json } from "@remix-run/node";
import prisma from "../db.server";

const headers = { 
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export const loader = () => json({}, { headers });

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const { shop, firstName, lastName, email, sessionId } = await request.json();
    
    console.log("📝 Registration request:", { shop, firstName, email, sessionId });

    if (!email || !sessionId || !shop) {
      return json({ error: "Email, sessionId, and shop are required" }, { status: 400, headers });
    }

    // ✅ Check if session already exists by sessionId first (most reliable)
    const existingBySessionId = await prisma.chatSession.findUnique({
      where: { sessionId }
    });

    // ✅ Check if user already exists by email + shop
    const existingByEmail = !existingBySessionId 
      ? await prisma.chatSession.findFirst({
          where: { email, shop }
        })
      : null;

    let session;
    let isNew = false;

    if (existingBySessionId) {
      console.log("✅ Session exists by sessionId, updating:", existingBySessionId.id);
      
      // Update existing session
      session = await prisma.chatSession.update({
        where: { id: existingBySessionId.id },
        data: {
          shop,
          firstName: firstName || existingBySessionId.firstName,
          lastName: lastName || existingBySessionId.lastName,
          email,
          updatedAt: new Date()
        }
      });

    } else if (existingByEmail) {
      console.log("✅ User exists by email, updating sessionId:", existingByEmail.id);
      
      // User already exists → update sessionId
      session = await prisma.chatSession.update({
        where: { id: existingByEmail.id },
        data: {
          sessionId,
          shop,
          firstName: firstName || existingByEmail.firstName,
          lastName: lastName || existingByEmail.lastName,
          updatedAt: new Date()
        }
      });

    } else {
      console.log("🆕 Creating new session for:", email);
      isNew = true;
      
      // Brand new user → create session
      session = await prisma.chatSession.create({
        data: {
          shop,
          firstName: firstName || null,
          lastName: lastName || null,
          email,
          sessionId,
          isResolved: false,
        }
      });
    }

    console.log(`✅ Session saved: id=${session.id}, isNew=${isNew}, sessionId=${session.sessionId}`);

    return json({ 
      success: true,
      isNew,
      session: {
        id: session.id,
        firstName: session.firstName,
        lastName: session.lastName,
        email: session.email,
        sessionId: session.sessionId,
        shop: session.shop,
      }
    }, { headers });

  } catch (e) { 
    console.error("❌ Register/Login error:", e);
    return json({ error: e.message }, { status: 500, headers }); 
  }
};