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
    
    const session = await prisma.chatSession.upsert({
      where: { sessionId: sessionId },
      update: { 
        email, 
        firstName: firstName || null, 
        lastName: lastName || null 
      },
      create: { 
        shop, 
        firstName: firstName || null, 
        lastName: lastName || null,
        email, 
        sessionId 
      },
    });
    
    return json({ success: true, session }, { headers });
  } catch (e) { 
    return json({ error: e.message }, { status: 500, headers }); 
  }
};