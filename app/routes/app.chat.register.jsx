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
    
    console.log("Registration request:", { shop, firstName, email, sessionId });

    if (!email || !sessionId) {
      return json({ error: "Email and sessionId are required" }, { status: 400, headers });
    }

    // ✅ Check if user already exists (by email only, not shop)
    const existing = await prisma.chatSession.findFirst({
      where: {
        email: email
      }
    });

    let session;

    if (existing) {
      console.log("✅ User exists, updating sessionId:", existing.id);
      
      // ✅ User already exists → update sessionId and shop
      session = await prisma.chatSession.update({
        where: { id: existing.id },
        data: {
          sessionId: sessionId,
          shop: shop,
          firstName: firstName || existing.firstName,
          lastName: lastName || existing.lastName,
          updatedAt: new Date()
        }
      });
    } else {
      console.log("🆕 Creating new user");
      
      // 🆕 New user
      session = await prisma.chatSession.create({
        data: {
          shop,
          firstName: firstName || null,
          lastName: lastName || null,
          email,
          sessionId
        }
      });
    }

    console.log("✅ Session saved:", session.id);

    return json({ 
      success: true, 
      session: {
        id: session.id,
        firstName: session.firstName,
        email: session.email,
        sessionId: session.sessionId
      }
    }, { headers });

  } catch (e) { 
    console.error("Register/Login error:", e);
    return json({ error: e.message }, { status: 500, headers }); 
  }
};