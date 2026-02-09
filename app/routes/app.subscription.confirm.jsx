// app/routes/app.subscription.confirm.jsx - FIXED REDIRECT
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  try {
    const { session, admin } = await authenticate.admin(request);
    const shop = session.shop;
    
    // Get the plan from URL params
    const url = new URL(request.url);
    const planKey = url.searchParams.get("plan");
    const charge_id = url.searchParams.get("charge_id");

    console.log("📋 Billing confirmation received:", { shop, planKey, charge_id });

    if (!planKey) {
      console.error("❌ No plan specified in confirmation");
      return redirect("/app/subscription?error=no-plan");
    }

    // Get the current subscription from database
    const subscription = await prisma.subscription.findUnique({
      where: { shop },
    });

    if (!subscription || !subscription.billingId) {
      console.error("❌ No pending subscription found");
      return redirect("/app/subscription?error=no-subscription");
    }

    // Query Shopify to get the subscription status
    const response = await admin.graphql(
      `#graphql
      query GetAppSubscription($id: ID!) {
        node(id: $id) {
          ... on AppSubscription {
            id
            name
            status
            currentPeriodEnd
            trialDays
            test
          }
        }
      }`,
      {
        variables: {
          id: subscription.billingId,
        },
      }
    );

    const result = await response.json();
    const appSubscription = result.data?.node;

    if (!appSubscription) {
      console.error("❌ Could not retrieve subscription from Shopify");
      return redirect("/app/subscription?error=verification-failed");
    }

    console.log("✅ Subscription verified:", appSubscription);

    // Map Shopify status to our status
    const statusMap = {
      ACTIVE: "active",
      PENDING: "pending",
      CANCELLED: "cancelled",
      EXPIRED: "expired",
      FROZEN: "frozen",
    };

    const status = statusMap[appSubscription.status] || "pending";

    // Update subscription in database
    await prisma.subscription.update({
      where: { shop },
      data: {
        plan: planKey,
        status: status,
        billingId: appSubscription.id,
        currentPeriodEnd: appSubscription.currentPeriodEnd 
          ? new Date(appSubscription.currentPeriodEnd)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
        trialDays: appSubscription.trialDays || 0,
      },
    });

    console.log(`✅ Subscription confirmed for ${shop}: ${planKey} (${status})`);

    // ✅ FIXED: Redirect back to the embedded app with proper host parameter
    const host = url.searchParams.get("host");
    const embedded = url.searchParams.get("embedded");
    
    if (host) {
      // Redirect with host parameter to maintain embedded context
      return redirect(`/app/subscription?success=true&plan=${planKey}&host=${host}&embedded=${embedded || '1'}`);
    } else {
      // Fallback if no host parameter
      return redirect(`/app/subscription?success=true&plan=${planKey}`);
    }

  } catch (error) {
    console.error("❌ Error confirming subscription:", error);
    
    // Try to get host parameter even on error
    const url = new URL(request.url);
    const host = url.searchParams.get("host");
    
    if (host) {
      return redirect(`/app/subscription?error=confirmation-failed&host=${host}&embedded=1`);
    } else {
      return redirect("/app/subscription?error=confirmation-failed");
    }
  }
};

export default function SubscriptionConfirm() {
  // This component won't render since we always redirect
  return null;
}