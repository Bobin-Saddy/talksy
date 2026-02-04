import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  await prisma.adminStatus.upsert({
    where: { shop },
    update: { 
      lastHeartbeat: new Date(),
      isOnline: true 
    },
    create: { 
      shop, 
      lastHeartbeat: new Date(),
      isOnline: true 
    },
  });

  return new Response("OK", { status: 200 });
};