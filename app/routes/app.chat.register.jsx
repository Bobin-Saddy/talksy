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
    
    console.log("📝 Registration request:", { shop, firstName, lastName, email, sessionId });

    // ✅ Validate required fields
    if (!email || !sessionId || !shop) {
      console.log("❌ Missing required fields:", { 
        hasEmail: !!email, 
        hasSessionId: !!sessionId, 
        hasShop: !!shop 
      });
      return json({ 
        success: false,
        error: "Email, sessionId, and shop are required" 
      }, { status: 400, headers });
    }

    // ✅ STEP 1: Check if session already exists by sessionId
    let existingBySessionId = await prisma.chatSession.findFirst({
      where: { 
        sessionId: sessionId,
        shop: shop
      }
    });

    // ✅ STEP 2: Check if user already exists by email + shop
    let existingByEmail = null;
    if (!existingBySessionId) {
      existingByEmail = await prisma.chatSession.findFirst({
        where: { 
          email: email,
          shop: shop
        }
      });
    }

    let session;
    let isNew = false;

    // ✅ SCENARIO 1: Session exists by sessionId - UPDATE IT
    if (existingBySessionId) {
      console.log("✅ Session exists by sessionId, updating:", existingBySessionId.id);
      
      session = await prisma.chatSession.update({
        where: { id: existingBySessionId.id },
        data: {
          firstName: firstName || existingBySessionId.firstName,
          lastName: lastName || existingBySessionId.lastName,
          email: email,
          updatedAt: new Date()
        }
      });

      console.log("✅ Session updated:", {
        id: session.id,
        email: session.email,
        firstName: session.firstName,
        lastName: session.lastName
      });

    } 
    // ✅ SCENARIO 2: User exists by email - UPDATE sessionId + info
    else if (existingByEmail) {
      console.log("✅ User exists by email, updating sessionId:", existingByEmail.id);
      
      session = await prisma.chatSession.update({
        where: { id: existingByEmail.id },
        data: {
          sessionId: sessionId,
          firstName: firstName || existingByEmail.firstName,
          lastName: lastName || existingByEmail.lastName,
          updatedAt: new Date()
        }
      });

      console.log("✅ Existing user updated with new sessionId:", {
        id: session.id,
        email: session.email,
        oldSessionId: existingByEmail.sessionId,
        newSessionId: sessionId
      });

    } 
    // ✅ SCENARIO 3: Brand new user - CREATE SESSION
    else {
      console.log("🆕 Creating new session for:", email);
      isNew = true;
      
      try {
        session = await prisma.chatSession.create({
          data: {
            shop: shop,
            firstName: firstName || null,
            lastName: lastName || null,
            email: email,
            sessionId: sessionId,
            isResolved: false,
          }
        });

        console.log("✅ NEW SESSION CREATED:", {
          id: session.id,
          email: session.email,
          firstName: session.firstName,
          lastName: session.lastName,
          sessionId: session.sessionId,
          shop: session.shop,
          createdAt: session.createdAt
        });

      } catch (createError) {
        console.error("❌ Error creating session:", createError);
        
        // Handle race condition - session might have been created by validate-session
        if (createError.code === 'P2002') {
          console.log("⚠️ Duplicate detected (race condition), refetching...");
          
          // Try to fetch the session that was just created
          session = await prisma.chatSession.findFirst({
            where: {
              sessionId: sessionId,
              shop: shop
            }
          });

          if (!session) {
            // If still not found, try by email
            session = await prisma.chatSession.findFirst({
              where: {
                email: email,
                shop: shop
              }
            });

            if (session) {
              // Update with the new sessionId
              session = await prisma.chatSession.update({
                where: { id: session.id },
                data: { sessionId: sessionId }
              });
            }
          }

          if (!session) {
            // If we still don't have a session, throw the original error
            throw createError;
          }
        } else {
          throw createError;
        }
      }
    }

    console.log(`✅ Registration complete: id=${session.id}, isNew=${isNew}, email=${session.email}`);

    return json({ 
      success: true,
      isNew: isNew,
      session: {
        id: session.id,
        firstName: session.firstName,
        lastName: session.lastName,
        email: session.email,
        sessionId: session.sessionId,
        shop: session.shop,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      }
    }, { headers });

  } catch (e) { 
    console.error("❌ Register/Login error:", e);
    return json({ 
      success: false,
      error: e.message 
    }, { status: 500, headers }); 
  }
};