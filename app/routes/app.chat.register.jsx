import { json } from "@remix-run/node";
import prisma from "../db.server";

const headers = { 
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export const loader = () => json({}, { headers });

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    const { shop, firstName, lastName, email, sessionId } = await request.json();

    if (!email) {
      return json({ error: "Email is required" }, { status: 400, headers });
    }

    // ✅ Check user by email
    const existing = await prisma.chatSession.findFirst({
      where: {
        shop: shop,
        email: email
      }
    });

    let session;

    if (existing) {
      // ✅ User already exists → just update sessionId
      session = await prisma.chatSession.update({
        where: { id: existing.id },
        data: {
          sessionId: sessionId,
          firstName: firstName || existing.firstName,
          lastName: lastName || existing.lastName,
        }
      });
    } else {
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

    return json({ success: true, session }, { headers });
  } catch (e) { 
    console.error("Register/Login error:", e);
    return json({ error: e.message }, { status: 500, headers }); 
  }
};
