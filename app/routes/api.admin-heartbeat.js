import { json } from "@remix-run/node";
import prisma   from "../db.server";        // ← adjust path if needed

export const action = async ({ request }) => {
  /* only POST allowed */
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const shop = body.shop;

  if (!shop) {
    return json({ error: "shop is required" }, { status: 400 });
  }

  /* if admin explicitly passes isOnline use it, otherwise default true */
  const online =
    typeof body.isOnline === "boolean" ? body.isOnline : true;

  await prisma.adminStatus.upsert({
    where: { shop },
    update: {
      isOnline      : online,
      lastHeartbeat : new Date(),
    },
    create: {
      shop          : shop,
      isOnline      : online,
      lastHeartbeat : new Date(),
    },
  });

  return json({ ok: true });
};