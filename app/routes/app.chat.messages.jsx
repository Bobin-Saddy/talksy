import { json } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const headers = { "Access-Control-Allow-Origin": "*" };
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) return json([], { headers });

  const messages = await prisma.chatMessage.findMany({
    where: { chatSessionId: sessionId }, 
    orderBy: { createdAt: "asc" }, // Always ascending so the newest is at the bottom
  });

  return json(messages, { headers });
};