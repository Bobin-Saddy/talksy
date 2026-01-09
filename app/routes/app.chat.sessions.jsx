// import { json } from "@remix-run/node";
// import prisma from "../db.server";
// import { authenticate } from "../shopify.server";

// export const loader = async ({ request }) => {
//   const { session } = await authenticate.admin(request);
//   const shop = session.shop;

//   if (!shop) return json({ error: "Unauthorized" }, { status: 401 });

//   const sessions = await prisma.chatSession.findMany({
//     where: { shop: shop },
//     include: {
//       messages: {
//         orderBy: { createdAt: "desc" },
//         take: 1,
//       },
//     },
//     orderBy: { createdAt: "desc" },
//   });

//   return json(sessions);
// };