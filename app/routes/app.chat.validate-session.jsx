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

    if (!shop || !sessionId || !email) {
      console.log("❌ Missing required parameters:", { 
        hasShop: !!shop, 
        hasSessionId: !!sessionId, 
        hasEmail: !!email 
      });
      return json({ valid: false, error: "Missing parameters" }, { status: 400, headers });
    }

    // ✅ STEP 1: Try to find existing session by sessionId
    let session = await prisma.chatSession.findFirst({
      where: {
        sessionId: sessionId,
        shop: shop
      }
    });

    // ✅ STEP 2: If not found by sessionId, try to find by email + shop
    if (!session) {
      console.log("🔍 Session not found by sessionId, searching by email...");
      session = await prisma.chatSession.findFirst({
        where: {
          email: email,
          shop: shop
        }
      });

      // If found by email, update the sessionId (returning user with new session)
      if (session) {
        console.log("🔄 Found user by email, updating sessionId");
        session = await prisma.chatSession.update({
          where: { id: session.id },
          data: { 
            sessionId: sessionId,
            updatedAt: new Date()
          }
        });
      }
    }

    // ✅ STEP 3: If STILL not found, CREATE NEW SESSION (auto-registration)
    if (!session) {
      console.log("🆕 No existing session found - creating new session");
      console.log("📝 Creating with:", { shop, email, sessionId });

      try {
        session = await prisma.chatSession.create({
          data: {
            shop: shop,
            email: email,
            sessionId: sessionId,
            firstName: null,
            lastName: null,
            isResolved: false,
          }
        });

        console.log("✅ NEW SESSION CREATED:", {
          id: session.id,
          email: session.email,
          sessionId: session.sessionId,
          shop: session.shop,
          createdAt: session.createdAt
        });

        return json({ 
          valid: true,
          isNew: true, // ✅ Flag that this is a new session
          session: {
            id: session.id,
            firstName: session.firstName,
            lastName: session.lastName,
            email: session.email,
            sessionId: session.sessionId,
            shop: session.shop
          }
        }, { headers });

      } catch (createError) {
        console.error("❌ Error creating session:", createError);
        
        // Handle race condition - session might have been created by another request
        if (createError.code === 'P2002') {
          console.log("⚠️ Duplicate detected, refetching...");
          session = await prisma.chatSession.findFirst({
            where: {
              sessionId: sessionId,
              shop: shop
            }
          });
          
          if (!session) {
            throw createError; // If still not found, throw original error
          }
        } else {
          throw createError;
        }
      }
    }

    // ✅ STEP 4: Session exists - update last activity and return
    if (session) {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { updatedAt: new Date() }
      });

      console.log("✅ Session validated:", {
        id: session.id,
        email: session.email,
        sessionId: session.sessionId
      });

      return json({ 
        valid: true,
        isNew: false,
        session: {
          id: session.id,
          firstName: session.firstName,
          lastName: session.lastName,
          email: session.email,
          sessionId: session.sessionId,
          shop: session.shop
        }
      }, { headers });
    }

    // ✅ Should never reach here, but just in case
    console.log("❌ Unexpected: Session still not found after all attempts");
    return json({ valid: false, error: "Session validation failed" }, { status: 500, headers });

  } catch (e) { 
    console.error("❌ Session validation error:", e);
    return json({ valid: false, error: e.message }, { status: 500, headers }); 
  }
};