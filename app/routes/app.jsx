// app/routes/app.jsx - UPDATED WITH SUBSCRIPTION
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider, Badge } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";
import { useEffect } from "react";
import { getUsageStats } from "./app/utils/planLimits.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  // Get usage statistics
  const usage = await getUsageStats(shop);
  
  return { 
    apiKey: process.env.SHOPIFY_API_KEY || "",
    usage,
  };
};

export default function App() {
  const { apiKey, usage } = useLoaderData();
  
  // Calculate if user is approaching limit
  const isApproachingLimit = usage.chats.percentage > 80;
  const isAtLimit = usage.chats.percentage >= 100;

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
          <s-link href="/app/admin/search">Search</s-link>
          <s-link href="/app/settings">Settings</s-link>
          <s-link href="/app/faq">FAQs</s-link>
          <s-link href="/app/subscription">
            Subscription
            {isApproachingLimit && !isAtLimit && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="warning">
                  {usage.chats.remaining} left
                </Badge>
              </span>
            )}
            {isAtLimit && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="critical">Limit Reached</Badge>
              </span>
            )}
          </s-link>
        </s-app-nav>
        
        {/* Show banner if approaching or at limit */}
        {(isApproachingLimit || isAtLimit) && (
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