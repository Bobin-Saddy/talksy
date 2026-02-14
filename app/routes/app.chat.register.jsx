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
    
    console.log("🔍 Validating session:", { shop, sessionId, email });

    if (!sessionId || !shop) {
      console.log("❌ Missing sessionId or shop");
      return json({ valid: false, error: "Missing sessionId or shop" }, { status: 400, headers });
    }

    // ✅ Try to find session by sessionId first
    let session = await prisma.chatSession.findUnique({
      where: { sessionId }
    });

    // ✅ If not found by sessionId, try by email + shop
    if (!session && email) {
      session = await prisma.chatSession.findFirst({
        where: { 
          email, 
          shop 
        }
      });
      
      // If found by email, update the sessionId
      if (session) {
        console.log("🔄 Found existing user by email, updating sessionId");
        session = await prisma.chatSession.update({
          where: { id: session.id },
          data: { 
            sessionId,
            updatedAt: new Date()
          }
        });
      }
    }

    // ✅ If session STILL doesn't exist, CREATE IT (auto-registration)
    if (!session && email) {
      console.log("🆕 No session found, creating new session for:", email);
      
      try {
        session = await prisma.chatSession.create({
          data: {
            shop,
            email,
            sessionId,
            firstName: null,
            lastName: null,
            isResolved: false,
          }
        });
        
        console.log("✅ NEW SESSION CREATED:", {
          id: session.id,
          email: session.email,
          sessionId: session.sessionId,
          shop: session.shop
        });
        
        return json({ 
          valid: true, 
          session: {
            id: session.id,
            email: session.email,
            sessionId: session.sessionId,
            shop: session.shop,
          },
          isNew: true
        }, { headers });
        
      } catch (createError) {
        // Handle unique constraint violation
        if (createError.code === 'P2002') {
          console.log("⚠️ Duplicate session detected, fetching existing...");
          session = await prisma.chatSession.findUnique({
            where: { sessionId }
          });
        } else {
          throw createError;
        }
      }
    }

    // ✅ If session exists, validate it
    if (session) {
      console.log("✅ Session validated:", session.id);
      
      // Update last activity
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { updatedAt: new Date() }
      });
      
      return json({ 
        valid: true,
        session: {
          id: session.id,
          email: session.email,
          sessionId: session.sessionId,
          shop: session.shop,
        }
      }, { headers });
    }

    // ✅ No session and no email provided
    console.log("❌ Session not found and no email provided");
    return json({ valid: false, error: "Session not found" }, { status: 401, headers });

  } catch (error) {
    console.error("❌ Validate session error:", error);
    return json({ valid: false, error: error.message }, { status: 500, headers });
  }
};