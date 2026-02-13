// app/routes/app.jsx - FIXED TO HIDE FEATURES UNTIL BILLING APPROVED
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider, Badge } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";
import { useEffect } from "react";
import { getUsageStats } from "../planLimits.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  // ✅ Get subscription status to check if billing is approved
  const subscription = await prisma.subscription.findUnique({
    where: { shop },
  });
  
  // Get usage statistics with error handling
  let usage = null;
  try {
    usage = await getUsageStats(shop);
  } catch (error) {
    console.error("Error getting usage stats:", error);
    // Provide default usage if stats fail
    usage = {
      plan: "FREE",
      chats: {
        current: 0,
        max: 100,
        percentage: 0,
        remaining: 100,
      },
      faqs: {
        current: 0,
        canManage: false,
      },
      features: {
        canCustomizeWidget: false,
        canCreateCustomFAQPage: false,
      },
      retention: {
        days: 30,
      },
    };
  }
  
  return { 
    apiKey: process.env.SHOPIFY_API_KEY || "",
    usage,
    subscriptionStatus: subscription?.status || "active", // ✅ Pass subscription status
  };
};

export default function App() {
  const { apiKey, usage, subscriptionStatus } = useLoaderData();
  
  // Calculate if user is approaching limit (only if usage is available)
  const isApproachingLimit = usage && typeof usage.chats.percentage === 'number' && usage.chats.percentage > 80;
  const isAtLimit = usage && typeof usage.chats.percentage === 'number' && usage.chats.percentage >= 100;

  // ✅ CRITICAL: Only show paid features if billing is approved (status = "active" or "trialing")
  // Do NOT show if status is "pending_approval" (waiting for billing approval)
  const isBillingApproved = subscriptionStatus === "active" || subscriptionStatus === "trialing";
  
  // Check plan level - but also verify billing is approved
  const isPaidPlan = usage && (usage.plan === "STANDARD" || usage.plan === "PREMIUM") && isBillingApproved;
  const canManageFAQs = usage && usage.faqs.canManage && isBillingApproved;
  const canCustomizeWidget = usage && usage.features.canCustomizeWidget && isBillingApproved;

  // Heartbeat Logic 🚀
  useEffect(() => {
    const updateHeartbeat = async () => {
      try {
        await fetch("/app/update-status", { method: "POST" });
        console.log("Admin Heartbeat updated");
      } catch (err) {
        console.error("Heartbeat error:", err);
      }
    };
    
    updateHeartbeat(); // Immediate call when app loads
    const interval = setInterval(updateHeartbeat, 30000); // Every 30s
    
    return () => clearInterval(interval);
  }, []);

  return (
    <ShopifyAppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>
        <s-app-nav>
          <s-link href="/app/chat/admin">Chats</s-link>
          
          {/* ✅ Only show Search if billing is approved AND plan is paid */}
          {isPaidPlan && (
            <s-link href="/app/admin/search">Search</s-link>
          )}
          
          {/* ✅ Only show Settings if billing is approved AND plan allows customization */}
          {canCustomizeWidget && (
            <s-link href="/app/settings">Settings</s-link>
          )}
          
          {/* ✅ Only show FAQs if billing is approved AND plan allows FAQ management */}
          {canManageFAQs && (
            <s-link href="/app/faq">FAQs</s-link>
          )}
          
          <s-link href="/app/subscription">
            Subscription
            {usage && isApproachingLimit && !isAtLimit && usage.chats.remaining !== "Unlimited" && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="warning">
                  {usage.chats.remaining} left
                </Badge>
              </span>
            )}
            {usage && isAtLimit && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="critical">Limit Reached</Badge>
              </span>
            )}
            {/* ✅ Show "Pending" badge if waiting for billing approval */}
            {subscriptionStatus === "pending_approval" && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="info">Pending</Badge>
              </span>
            )}
          </s-link>
        </s-app-nav>
        
        {/* ✅ Show banner if billing is pending approval */}
        {subscriptionStatus === "pending_approval" && (
          <div style={{ 
            padding: "12px 20px", 
            backgroundColor: "#E3F2FD",
            borderBottom: "1px solid #90CAF9",
            textAlign: "center"
          }}>
            <span style={{ fontWeight: 600 }}>
              ⏳ Your subscription upgrade is pending billing approval.
            </span>
            {" "}
            <a href="/app/subscription" style={{ color: "#005BD3", textDecoration: "underline" }}>
              Complete billing approval
            </a>
          </div>
        )}
        
        {/* Show banner if approaching or at limit */}
        {usage && (isApproachingLimit || isAtLimit) && isBillingApproved && (
          <div style={{ 
            padding: "12px 20px", 
            backgroundColor: isAtLimit ? "#FED3D1" : "#FFF4E5",
            borderBottom: "1px solid #ddd",
            textAlign: "center"
          }}>
            <span style={{ fontWeight: 600 }}>
              {isAtLimit 
                ? `⚠️ You've reached your ${usage.plan} plan limit (${usage.chats.current}/${usage.chats.max} chats).` 
                : `⚡ You're using ${Math.round(usage.chats.percentage)}% of your ${usage.plan} plan.`}
            </span>
            {" "}
            <a href="/app/subscription" style={{ color: "#005BD3", textDecoration: "underline" }}>
              {isAtLimit ? "Upgrade now to continue" : "Upgrade your plan"}
            </a>
          </div>
        )}
        
        <Outlet />
      </PolarisAppProvider>
    </ShopifyAppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};