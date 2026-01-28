import { json } from "@remix-run/node";
import prisma from "../db.server";

/**
 * CORS helper
 */
function cors(data, status = 200, request) {
  const origin = request?.headers.get("Origin") || "*";

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * Preflight request handler
 */
export function options({ request }) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * GET: Fetch FAQ Categories
 */
export async function loader({ request }) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return cors({ error: "Shop parameter required" }, 400, request);
  }

  try {
    const categories = await prisma.faqCategory.findMany({
      where: { shop },
      include: {
        faqs: {
          where: { isActive: true },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { position: "asc" },
    });

    return cors({ categories }, 200, request);
  } catch (error) {
    console.error("Error fetching FAQ categories:", error);
    return cors({ error: "Failed to fetch categories" }, 500, request);
  }
}

/**
 * POST: Admin actions (create, update, delete, reorder)
 */
export async function action({ request }) {
  try {
    const formData = await request.formData();
    const actionType = formData.get("action");
    const shop = formData.get("shop");

    if (!shop) {
      return cors({ error: "Shop parameter required" }, 400, request);
    }

    switch (actionType) {
      case "create": {
        const title = formData.get("title");
        const position = parseInt(formData.get("position") || "0");

        const category = await prisma.faqCategory.create({
          data: { shop, title, position },
        });

        return cors({ success: true, category }, 200, request);
      }

      case "update": {
        const id = formData.get("id");
        const title = formData.get("title");
        const position = parseInt(formData.get("position") || "0");
        const isActive = formData.get("isActive") === "true";

        const category = await prisma.faqCategory.update({
          where: { id },
          data: { title, position, isActive },
        });

        return cors({ success: true, category }, 200, request);
      }

      case "delete": {
        const id = formData.get("id");

        await prisma.faqCategory.delete({
          where: { id },
        });

        return cors({ success: true }, 200, request);
      }

      case "reorder": {
        const updates = JSON.parse(formData.get("updates"));

        await Promise.all(
          updates.map((update) =>
            prisma.faqCategory.update({
              where: { id: update.id },
              data: { position: update.position },
            })
          )
        );

        return cors({ success: true }, 200, request);
      }

      default:
        return cors({ error: "Invalid action" }, 400, request);
    }
  } catch (error) {
    console.error("FAQ category action error:", error);
    return cors({ error: "Operation failed" }, 500, request);
  }
}
