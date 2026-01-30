// app/routes/app.chat.register.jsx
import { json } from "@remix-run/node";
import prisma from "../db.server";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const loader = () => json({}, { headers });

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const { shop, firstName, lastName, email, sessionId } = await request.json();

    if (!shop || !email || !sessionId) {
      return json(
        { error: "shop, email and sessionId are required" },
        { status: 400, headers }
      );
    }

    const existing = await prisma.chatSession.findFirst({
      where: { shop, email },
    });

    let session;

    if (existing) {
      session = await prisma.chatSession.update({
        where: { id: existing.id },
        data: {
          sessionId,
          firstName: firstName ?? existing.firstName,
          lastName: lastName ?? existing.lastName,
          isResolved: false,
          resolvedAt: null,
          resolvedBy: null,
        },
      });
    } else {
      session = await prisma.chatSession.create({
        data: {
          shop,
          email,
          sessionId,
          firstName: firstName || null,
          lastName: lastName || null,
        },
      });
    }

    return json(
      {
        success: true,
        session: {
          id: session.id,
          firstName: session.firstName,
          email: session.email,
          sessionId: session.sessionId,
        },
      },
      { headers }
    );
  } catch (e) {
    console.error("Register error:", e);
    return json({ error: e.message }, { status: 500, headers });
  }
};
