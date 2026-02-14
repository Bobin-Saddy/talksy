// app/routes/app.subscription.confirm.jsx - WITH IMMEDIATE UNLOCK SIGNAL
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "react-router";
import { useEffect } from "react";
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
      return json({ 
        error: "no-plan",
        redirect: "/app/subscription?error=no-plan"
      });
    }

    // Get the current subscription from database
    const subscription = await prisma.subscription.findUnique({
      where: { shop },
    });

    if (!subscription || !subscription.billingId) {
      console.error("❌ No pending subscription found");
      return json({ 
        error: "no-subscription",
        redirect: "/app/subscription?error=no-subscription"
      });
    }

    // ✅ IMPORTANT: Query Shopify to check ACTUAL subscription status
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
      return json({ 
        error: "verification-failed",
        redirect: "/app/subscription?error=verification-failed"
      });
    }

    console.log("✅ Subscription status from Shopify:", appSubscription.status);

    // ✅ CRITICAL: Check if user actually approved the billing
    // If status is still PENDING, it means user didn't approve or cancelled
    if (appSubscription.status === "PENDING") {
      console.log("⚠️ Billing not approved yet - user may have cancelled");
      
      // Reset subscription back to previous plan
      const chatCount = await prisma.chatSession.count({
        where: { shop },
      }).catch(() => 0);
      
      const fallbackPlan = chatCount > 2 ? "FREE" : "FREE";
      
      await prisma.subscription.update({
        where: { shop },
        data: {
          plan: fallbackPlan,
          status: "active",
          billingId: null,
        },
      });

      return json({ 
        cancelled: true,
        redirect: "/app/subscription?billing=cancelled"
      });
    }

    // Map Shopify status to our status
    const statusMap = {
      ACTIVE: "active",
      PENDING: "pending",
      CANCELLED: "cancelled",
      EXPIRED: "expired",
      FROZEN: "frozen",
    };

    const status = statusMap[appSubscription.status] || "pending";

    // ✅ Only update to the new plan if status is ACTIVE or acceptable
    if (status === "active" || appSubscription.status === "ACTIVE") {
      await prisma.subscription.update({
        where: { shop },
        data: {
          plan: planKey,
          status: status,
          billingId: appSubscription.id,
          currentPeriodEnd: appSubscription.currentPeriodEnd 
            ? new Date(appSubscription.currentPeriodEnd)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      console.log("✅ Subscription confirmed for " + shop + ": " + planKey + " (" + status + ")");

      // ✅ Return with billing=complete parameter for immediate unlock
      return json({ 
        success: true,
        redirect: "/app/subscription?success=true&billing=complete&plan=" + planKey
      });
    } else {
      // Status is not active - something went wrong
      console.log("⚠️ Subscription not active: " + appSubscription.status);
      
      await prisma.subscription.update({
        where: { shop },
        data: {
          plan: "FREE",
          status: "active",
          billingId: null,
        },
      });

      return json({ 
        error: "billing-not-active",
        redirect: "/app/subscription?error=confirmation-failed"
      });
    }

  } catch (error) {
    console.error("❌ Error confirming subscription:", error);
    return json({ 
      error: "confirmation-failed",
      redirect: "/app/subscription?error=confirmation-failed",
      message: error.message
    });
  }
};

export default function SubscriptionConfirm() {
  const data = useLoaderData();
  const navigate = useNavigate();

  useEffect(() => {
    if (data?.redirect) {
      // Small delay to ensure state is updated
      setTimeout(() => {
        navigate(data.redirect);
      }, 500);
    }
  }, [data, navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '400px', padding: '24px' }}>
        {data?.error || data?.cancelled ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {data?.cancelled ? '⏸️' : '⚠️'}
            </div>
            <h2 style={{ 
              color: data?.cancelled ? '#f59e0b' : '#dc2626', 
              marginBottom: '8px' 
            }}>
              {data?.cancelled ? 'Billing Cancelled' : 'Confirmation Failed'}
            </h2>
            <p style={{ color: '#6b7280' }}>
              {data?.cancelled 
                ? 'Returning you to subscription page...'
                : 'Redirecting you back to subscription page...'}
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ color: '#10b981', marginBottom: '8px' }}>Processing Subscription</h2>
            <p style={{ color: '#6b7280' }}>Please wait while we confirm your subscription...</p>
          </>
        )}
      </div>
    </div>
  );
}