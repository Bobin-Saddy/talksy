// app/routes/cron.cleanup.jsx
// This route should be called periodically (e.g., daily) via a cron job
// You can use services like Render Cron Jobs, or set up a scheduled task

import { json } from "@remix-run/node";
import prisma from "../db.server";
import { cleanupOldChats } from "../planLimits.server";

export const loader = async ({ request }) => {
  // Verify this is being called by your cron service
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET || "your-secret-key";
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("🧹 Starting chat cleanup job...");
    
    // Get all active shops
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: {
          in: ["active", "trialing"],
        },
      },
    });

    let totalDeleted = 0;
    const results = [];

    // Cleanup old chats for each shop based on their plan
    for (const sub of subscriptions) {
      try {
        const result = await cleanupOldChats(sub.shop);
        totalDeleted += result.deleted;
        
        results.push({
          shop: sub.shop,
          plan: sub.plan,
          deleted: result.deleted,
        });

        console.log(`✅ Cleaned up ${result.deleted} old chats for ${sub.shop} (${sub.plan})`);
      } catch (error) {
        console.error(`Error cleaning up chats for ${sub.shop}:`, error);
        results.push({
          shop: sub.shop,
          error: error.message,
        });
      }
    }

    console.log(`🧹 Cleanup complete. Total chats deleted: ${totalDeleted}`);

    return json({
      success: true,
      totalDeleted,
      shopsProcessed: subscriptions.length,
      results,
    });
  } catch (error) {
    console.error("Cleanup job error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

// Schedule this route to run daily:
// 1. Using Render Cron Jobs:
//    - Add to render.yaml:
//      - type: cron
//        name: chat-cleanup
//        schedule: "0 2 * * *"  # Daily at 2 AM
//        command: curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.com/cron/cleanup
//
// 2. Using GitHub Actions:
//    - Create .github/workflows/cleanup.yml
//
// 3. Using external cron services:
//    - EasyCron, cron-job.org, etc.