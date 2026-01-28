// app/routes/api.faq.categories.reorder.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const { categories } = await request.json();

    // Update positions in a transaction
    await prisma.$transaction(
      categories.map(({ id, position }) =>
        prisma.faqCategory.update({
          where: { id },
          data: { position }
        })
      )
    );

    return json({ success: true });
  } catch (error) {
    console.error("Error reordering categories:", error);
    return json({ success: false, error: error.message });
  }
}