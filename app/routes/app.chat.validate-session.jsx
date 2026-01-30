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

    if (!shop || !sessionId || !email) {
      return json(
        { valid: false, error: "Missing parameters" },
        { status: 400, headers }
      );
    }

    const session = await prisma.chatSession.findFirst({
      where: {
        shop,
        email,
        sessionId,
      },
    });

    if (!session) {
      return json({ valid: false }, { status: 401, headers });
    }

    return json(
      {
        valid: true,
        session: {
          id: session.id,
          firstName: session.firstName,
          email: session.email,
          isResolved: session.isResolved,
        },
      },
      { headers }
    );
  } catch (e) {
    console.error("Validation error:", e);
    return json(
      { valid: false, error: e.message },
      { status: 500, headers }
    );
  }
};
