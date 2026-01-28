// app/routes/api.faq.items.jsx
import { json } from "@remix-run/node";
import prisma from "../db.server";

export async function loader({ request }) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const categoryId = url.searchParams.get("categoryId");

  if (!shop) {
    return json({ error: "Shop parameter required" }, { status: 400 });
  }

  try {
    const query = { where: { shop } };
    
    if (categoryId) {
      query.where.categoryId = categoryId;
    }

    const faqs = await prisma.faq.findMany({
      ...query,
      include: {
        category: true
      },
      orderBy: { position: "asc" }
    });

    return json({ faqs });
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    return json({ error: "Failed to fetch FAQs" }, { status: 500 });
  }
}

export async function action({ request }) {
  const formData = await request.formData();
  const action = formData.get("action");
  const shop = formData.get("shop");

  if (!shop) {
    return json({ error: "Shop parameter required" }, { status: 400 });
  }

  try {
    switch (action) {
      case "create": {
        const categoryId = formData.get("categoryId");
        const question = formData.get("question");
        const answer = formData.get("answer");
        const position = parseInt(formData.get("position") || "0");

        const faq = await prisma.faq.create({
          data: {
            shop,
            categoryId,
            question,
            answer,
            position
          },
          include: {
            category: true
          }
        });

        return json({ success: true, faq });
      }

      case "update": {
        const id = formData.get("id");
        const question = formData.get("question");
        const answer = formData.get("answer");
        const position = parseInt(formData.get("position") || "0");
        const isActive = formData.get("isActive") === "true";

        const faq = await prisma.faq.update({
          where: { id },
          data: { question, answer, position, isActive },
          include: {
            category: true
          }
        });

        return json({ success: true, faq });
      }

      case "delete": {
        const id = formData.get("id");

        await prisma.faq.delete({
          where: { id }
        });

        return json({ success: true });
      }

      case "reorder": {
        const updates = JSON.parse(formData.get("updates"));

        await Promise.all(
          updates.map((update) =>
            prisma.faq.update({
              where: { id: update.id },
              data: { position: update.position }
            })
          )
        );

        return json({ success: true });
      }

      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in FAQ action:", error);
    return json({ error: "Operation failed" }, { status: 500 });
  }
}