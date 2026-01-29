// app/routes/api.faq.categories.reorder.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const { categories } = await request.json();

    if (!categories || !Array.isArray(categories)) {
      return json({ 
        success: false, 
        error: "Invalid categories data" 
      }, { status: 400 });
    }

    // Validate that all categories belong to this shop
    const categoryIds = categories.map(c => c.id);
    const existingCategories = await prisma.faqCategory.findMany({
      where: {
        id: { in: categoryIds },
        shop
      },
      select: { id: true }
    });

    if (existingCategories.length !== categoryIds.length) {
      return json({ 
        success: false, 
        error: "Some categories do not belong to this shop" 
      }, { status: 403 });
    }

    // Update positions in a transaction
    await prisma.$transaction(
      categories.map(({ id, position }) =>
        prisma.faqCategory.update({
          where: { id },
          data: { position }
        })
      )
    );

    // Fetch and return updated categories
    const updatedCategories = await prisma.faqCategory.findMany({
      where: { shop },
      include: {
        faqs: {
          orderBy: { position: "asc" }
        }
      },
      orderBy: { position: "asc" }
    });

    return json({ 
      success: true, 
      categories: updatedCategories 
    });

  } catch (error) {
    console.error("Error reordering categories:", error);
    return json({ 
      success: false, 
      error: error.message || "Failed to reorder categories" 
    }, { status: 500 });
  }
}