// app/routes/app.jsx - WITH BLUR OVERLAY FOR LOCKED FEATURES
import { Outlet, useLoaderData, useRouteError, useLocation, useNavigate, useRevalidator } from "react-router";
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
    subscriptionStatus: subscription?.status || "active",
  };
};

// ✅ FIXED: More transparent blur overlay with glass effect
function LockedPageOverlay({ requiredPlan, currentPlan, isPendingApproval, onNavigate }) {
  return (
    <div style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(255, 255, 255, 0.4)", // ✅ More transparent (0.4 instead of 0.85)
      backdropFilter: "blur(12px)", // ✅ Glass effect
      WebkitBackdropFilter: "blur(12px)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        // background: "rgba(255, 255, 255, 0.95)", // ✅ Semi-transparent card
        borderRadius: "16px",
        padding: "48px 40px",
        maxWidth: "520px",
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)", // ✅ Stronger shadow for depth
        border: "1px solid rgba(255, 255, 255, 0.3)",
      }}>
        <div style={{ fontSize: "72px", marginBottom: "20px", lineHeight: 1 }}>🔒</div>
        <h2 style={{ 
          fontSize: "26px", 
          fontWeight: "700", 
          marginBottom: "12px",
          color: "#202223",
          lineHeight: "1.3"
        }}>
          {isPendingApproval ? "Billing Approval Required" : `Activate Your ${requiredPlan} Plan`}
        </h2>
        <p style={{ 
          fontSize: "16px", 
          color: "#6d7175", 
          marginBottom: "28px",
          lineHeight: "1.6"
        }}>
          {isPendingApproval ? (
            <>
              Your subscription upgrade is pending billing approval. 
              Complete the billing process to access this feature.
            </>
          ) : (
            <>
              This feature is available on the <strong>{requiredPlan}</strong> plan or higher.
              {currentPlan === "FREE" && " Upgrade now to unlock this feature."}
            </>
          )}
        </p>
        <button
          onClick={() => onNavigate("/app/subscription")}
          style={{
            display: "inline-block",
            padding: "14px 32px",
            backgroundColor: "#005BD3",
            color: "white",
            textDecoration: "none",
            borderRadius: "8px",
            fontWeight: "600",
            fontSize: "16px",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 8px rgba(0, 91, 211, 0.3)",
            border: "none",
            cursor: "pointer"
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "#004FC4";
            e.target.style.transform = "translateY(-1px)";
            e.target.style.boxShadow = "0 4px 12px rgba(0, 91, 211, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "#005BD3";
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 2px 8px rgba(0, 91, 211, 0.3)";
          }}
        >
          {isPendingApproval ? "Complete Billing Approval" : "View Plans"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { apiKey, usage, subscriptionStatus } = useLoaderData();
  const location = useLocation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  
  // Calculate if user is approaching limit
  const isApproachingLimit = usage && typeof usage.chats.percentage === 'number' && usage.chats.percentage > 80;
  const isAtLimit = usage && typeof usage.chats.percentage === 'number' && usage.chats.percentage >= 100;

  // ✅ Check if billing is approved
  const isBillingApproved = subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const isPendingApproval = subscriptionStatus === "pending_approval";
  
  // ✅ Premium plan gets all access
  const isPremiumPlan = usage && usage.plan === "PREMIUM" && isBillingApproved;
  const isStandardPlan = usage && usage.plan === "STANDARD" && isBillingApproved;
  const isPaidPlan = isPremiumPlan || isStandardPlan;
  
  // Premium = all features, Standard = limited features, Free = no features
  const canManageFAQs = isPremiumPlan || isStandardPlan;
  const canCustomizeWidget = isPremiumPlan || isStandardPlan;
  
  // ✅ Log current state for debugging
  console.log("🔍 Current App State:", {
    plan: usage?.plan,
    status: subscriptionStatus,
    isBillingApproved,
    isPremiumPlan,
    isStandardPlan,
    isPaidPlan,
    canManageFAQs,
    canCustomizeWidget
  });
  
  // ✅ Determine if current page should be locked
  const currentPath = location.pathname;
  let isPageLocked = false;
  let requiredPlan = "";
  
  // Check if on Search page (requires STANDARD or PREMIUM + billing approved)
  if (currentPath.includes("/admin/search")) {
    isPageLocked = !isPaidPlan;
    requiredPlan = "Standard";
  }
  
  // Check if on Settings page (requires STANDARD or PREMIUM + billing approved)
  if (currentPath.includes("/settings")) {
    isPageLocked = !canCustomizeWidget;
    requiredPlan = "Standard";
  }
  
  // Check if on FAQ page (requires STANDARD or PREMIUM + billing approved)
  if (currentPath.includes("/faq")) {
    isPageLocked = !canManageFAQs;
    requiredPlan = "Standard";
  }

  // ✅ Check if we're loading after billing approval
  const params = new URLSearchParams(location.search);
  const isBillingComplete = params.get('billing') === 'complete';
  const isSuccess = params.get('success') === 'true';
  // ✅ Show loader when billing complete parameter is present (until page reloads)
  const showUnlockLoader = isBillingComplete || isSuccess;

  // ✅ Auto-refresh data when coming back from subscription page
  useEffect(() => {
    const hasSuccess = params.get('success') === 'true';
    const hasBillingComplete = params.get('billing') === 'complete';
    
    if (hasSuccess || hasBillingComplete) {
      console.log("========================================");
      console.log("✅ BILLING APPROVED DETECTED!");
      console.log("Current Plan:", usage?.plan);
      console.log("Subscription Status:", subscriptionStatus);
      console.log("Is Premium Plan:", isPremiumPlan);
      console.log("Is Standard Plan:", isStandardPlan);
      console.log("Is Paid Plan:", isPaidPlan);
      console.log("Can Manage FAQs:", canManageFAQs);
      console.log("Can Customize Widget:", canCustomizeWidget);
      console.log("========================================");
      
      // ✅ Show loader for 1.5 seconds then reload
      console.log("🔄 Showing loader, will reload in 1.5 seconds...");
      setTimeout(() => {
        console.log("🚀 Reloading page to unlock features...");
        const cleanUrl = window.location.pathname;
        window.location.href = cleanUrl;
      }, 1500); // 1.5 second delay to show loader
    }
  }, [location.search, revalidator, usage, subscriptionStatus, isPremiumPlan, isStandardPlan, isPaidPlan, canManageFAQs, canCustomizeWidget]);

  // ✅ Periodic revalidation when pending approval
  useEffect(() => {
    if (isPendingApproval) {
      console.log("⏳ Pending approval - will check every 5 seconds");
      const interval = setInterval(() => {
        console.log("🔄 Checking for billing approval...");
        revalidator.revalidate();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [isPendingApproval, revalidator]);

  // Heartbeat Logic
  useEffect(() => {
    const updateHeartbeat = async () => {
      try {
        await fetch("/app/update-status", { method: "POST" });
        console.log("Admin Heartbeat updated");
      } catch (err) {
        console.error("Heartbeat error:", err);
      }
    };
    
    updateHeartbeat();
    const interval = setInterval(updateHeartbeat, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <ShopifyAppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>
        {/* ✅ Add key to force re-render when plan changes */}
        <s-app-nav key={`${usage?.plan}-${subscriptionStatus}-${isBillingApproved}`}>
          <s-link href="/app/chat/admin">Chats</s-link>
          
          {/* ✅ Show navigation with lock icon ONLY if not paid plan */}
          <s-link href="/app/admin/search">
            Search {!isPaidPlan && "🔒"}
          </s-link>
          
          <s-link href="/app/settings">
            Settings {!canCustomizeWidget && "🔒"}
          </s-link>
          
          <s-link href="/app/faq">
            FAQs {!canManageFAQs && "🔒"}
          </s-link>
          
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
            {isPendingApproval && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="info">Pending</Badge>
              </span>
            )}
          </s-link>
        </s-app-nav>
        
        {/* ✅ Full-screen loader when unlocking features after billing approval */}
        {showUnlockLoader && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            // backgroundColor: "rgba(255, 255, 255, 0.95)",
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px"
          }}>
            <div style={{
              width: "60px",
              height: "60px",
              border: "4px solid #E1E3E5",
              borderTop: "4px solid #005BD3",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }} />
            <h2 style={{ 
              fontSize: "24px", 
              fontWeight: "600", 
              color: "#202223",
              margin: 0
            }}>
              Activating Your Plan
            </h2>
            <p style={{ 
              fontSize: "16px", 
              color: "#6d7175",
              margin: 0
            }}>
              Unlocking features... Please wait
            </p>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
        
        {/* ✅ FIXED: Banner with clickable button that navigates properly */}
        {isPendingApproval && !showUnlockLoader && (
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
            <button
              onClick={() => navigate("/app/subscription")}
              style={{
                background: "none",
                border: "none",
                color: "#005BD3",
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
                font: "inherit"
              }}
            >
              Complete billing approval
            </button>
          </div>
        )}
        
        {/* Show banner if approaching or at limit */}
        {usage && (isApproachingLimit || isAtLimit) && isBillingApproved && !showUnlockLoader && (
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
            <button
              onClick={() => navigate("/app/subscription")}
              style={{
                background: "none",
                border: "none",
                color: "#005BD3",
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
                font: "inherit"
              }}
            >
              {isAtLimit ? "Upgrade now to continue" : "Upgrade your plan"}
            </button>
          </div>
        )}
        
        {/* ✅ Main Content Area - with blur overlay if page is locked */}
        <div style={{ position: "relative", minHeight: "100vh" }}>
          {/* Render the actual page content - it will be visible but blurred */}
          <div style={{ 
            filter: isPageLocked ? "blur(4px)" : "none",
            pointerEvents: isPageLocked ? "none" : "auto",
            userSelect: isPageLocked ? "none" : "auto",
            opacity: isPageLocked ? "0.5" : "1",
            transition: "filter 0.3s ease, opacity 0.3s ease"
          }}>
            <Outlet />
          </div>
          
          {/* Overlay appears on top of the blurred content */}
          {isPageLocked && (
            <LockedPageOverlay 
              requiredPlan={requiredPlan} 
              currentPlan={usage?.plan || "FREE"}
              isPendingApproval={isPendingApproval}
              onNavigate={navigate}
            />
          )}
        </div>
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