// app/routes/app.jsx - COMPLETE FIXED VERSION
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider, Badge } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";
import { useEffect } from "react";
import { getUsageStats } from "../planLimits.server";
import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  // Get usage statistics with error handling
  let usage = null;
  try {
    usage = await getUsageStats(shop);
  } catch (error) {
    console.error("Error getting usage stats:", error);
    // Provide default usage if stats fail
    usage = {
      plan: "FREE",
      status: "active",
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
  
  return json({ 
    apiKey: process.env.SHOPIFY_API_KEY || "",
    usage,
  });
};

export default function App() {
  const { apiKey, usage } = useLoaderData();
  
  // Calculate if user is approaching limit
  const isApproachingLimit = usage && typeof usage.chats.percentage === 'number' && usage.chats.percentage > 80;
  const isAtLimit = usage && typeof usage.chats.percentage === 'number' && usage.chats.percentage >= 100;

  // ✅ Check both plan AND status for access control
  const hasActiveSubscription = usage && (usage.status === "active" || usage.status === "trialing");
  const isPaidPlan = usage && hasActiveSubscription && (usage.plan === "STANDARD" || usage.plan === "PREMIUM");
  const canManageFAQs = usage && hasActiveSubscription && usage.faqs.canManage;
  const canCustomizeWidget = usage && hasActiveSubscription && usage.features.canCustomizeWidget;

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
          {/* Always show Chats */}
          <s-link href="/app/chat/admin">Chats</s-link>
          
          {/* Only show Search for paid plans with active subscription */}
          {isPaidPlan && (
            <s-link href="/app/admin/search">Search</s-link>
          )}
          
          {/* Only show Settings for paid plans with active subscription */}
          {canCustomizeWidget && (
            <s-link href="/app/settings">Settings</s-link>
          )}
          
          {/* Only show FAQs for paid plans with active subscription */}
          {canManageFAQs && (
            <s-link href="/app/faq">FAQs</s-link>
          )}
          
          {/* Always show Subscription */}
          <s-link href="/app/subscription">
            Subscription
            {/* Badge for approaching limit */}
            {usage && isApproachingLimit && !isAtLimit && usage.chats.remaining !== "Unlimited" && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="warning">
                  {usage.chats.remaining} left
                </Badge>
              </span>
            )}
            {/* Badge for limit reached */}
            {usage && isAtLimit && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="critical">Limit Reached</Badge>
              </span>
            )}
            {/* Badge for pending subscription */}
            {usage && usage.status === "pending" && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="attention">Pending</Badge>
              </span>
            )}
          </s-link>
        </s-app-nav>
        
        {/* Banner for pending subscriptions */}
        {usage && usage.status === "pending" && (
          <div style={{ 
            padding: "12px 20px", 
            backgroundColor: "#FFF4E5",
            borderBottom: "1px solid #ddd",
            textAlign: "center"
          }}>
            <span style={{ fontWeight: 600 }}>
              ⏳ Your {usage.plan} subscription is pending approval.
            </span>
            {" "}
            <a href="/app/subscription" style={{ color: "#005BD3", textDecoration: "underline" }}>
              Complete payment to activate
            </a>
          </div>
        )}
        
        {/* Banner for inactive subscriptions */}
        {usage && usage.plan !== "FREE" && !hasActiveSubscription && usage.status !== "pending" && (
          <div style={{ 
            padding: "12px 20px", 
            backgroundColor: "#FED3D1",
            borderBottom: "1px solid #ddd",
            textAlign: "center"
          }}>
            <span style={{ fontWeight: 600 }}>
              ❌ Your subscription is {usage.status}.
            </span>
            {" "}
            <a href="/app/subscription" style={{ color: "#005BD3", textDecoration: "underline" }}>
              Reactivate your plan
            </a>
          </div>
        )}
        
        {/* Banner for approaching or at limit */}
        {usage && hasActiveSubscription && (isApproachingLimit || isAtLimit) && (
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