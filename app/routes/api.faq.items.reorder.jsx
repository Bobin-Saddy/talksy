// app/routes/api.faq.items.reorder.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const { faqs } = await request.json();

    // Update positions in a transaction
    await prisma.$transaction(
      faqs.map(({ id, position }) =>
        prisma.faq.update({
          where: { id },
          data: { position }
        })
      )
    );

    return json({ success: true });
  } catch (error) {
    console.error("Error reordering FAQs:", error);
    return json({ success: false, error: error.message });
  }
}