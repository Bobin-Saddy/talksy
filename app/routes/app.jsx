// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.jsx - WITH FCM ON ALL PAGES
// ═══════════════════════════════════════════════════════════
import { Outlet, useLoaderData, useRouteError, useLocation, useNavigate, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider, Badge } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";
import { useEffect, useRef, useState } from "react";
import { getUsageStats } from "../planLimits.server";
import prisma from "../db.server";

// 🔥 FCM imports
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const FIREBASE_CONFIG = {
  apiKey           : "AIzaSyAkp3v6YWY4HexFQ7Z0BYPGMeG18IXXqWg",
  authDomain       : "shopify-talksy.firebaseapp.com",
  projectId        : "shopify-talksy",
  storageBucket    : "shopify-talksy.firebasestorage.app",
  messagingSenderId: "547076667229",
  appId            : "1:547076667229:web:e65ed249fe33f7724e9ab4",
};
const FIREBASE_VAPID_KEY =
  "BJzrkyA1gwJTL7auMx6y0RHjv34mSPzm6FpY5twRsMuuE54l0nL4cl4UUltGcgqO5cNGcJjWEugjyZFkkfTI1AE";
const BACKEND_URL = "https://talksy-production-5d43.up.railway.app";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const subscription = await prisma.subscription.findUnique({ where: { shop } });

  let usage = null;
  try {
    usage = await getUsageStats(shop);
  } catch (error) {
    console.error("Error getting usage stats:", error);
    usage = {
      plan    : "FREE",
      chats   : { current: 0, max: 100, percentage: 0, remaining: 100 },
      faqs    : { current: 0, canManage: false },
      features: { canCustomizeWidget: false, canCreateCustomFAQPage: false },
      retention: { days: 30 },
    };
  }

  return {
    apiKey            : process.env.SHOPIFY_API_KEY || "",
    usage,
    subscriptionStatus: subscription?.status || "active",
    currentShop       : shop,
  };
};

// ── Locked page overlay ────────────────────────────────────
function LockedPageOverlay({ requiredPlan, currentPlan, isPendingApproval, onNavigate }) {
  return (
    <div style={{
      position            : "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      WebkitBackdropFilter: "blur(12px)",
      zIndex              : 9999,
      display             : "flex",
      alignItems          : "center",
      justifyContent      : "center",
      padding             : "20px",
    }}>
      <div style={{ borderRadius: "16px", padding: "48px 40px", maxWidth: "520px", textAlign: "center" }}>
        <div style={{ fontSize: "72px", marginBottom: "20px", lineHeight: 1 }}>🔒</div>
        <h2 style={{ fontSize: "26px", fontWeight: "700", marginBottom: "12px", color: "#202223", lineHeight: "1.3" }}>
          {isPendingApproval ? "Billing Approval Required" : `Activate Your ${requiredPlan} Plan`}
        </h2>
        <p style={{ fontSize: "16px", color: "#6d7175", marginBottom: "28px", lineHeight: "1.6" }}>
          {isPendingApproval
            ? <>Your subscription upgrade is pending billing approval. Complete the billing process to access this feature.</>
            : <>This feature is available on the <strong>{requiredPlan}</strong> plan or higher.{currentPlan === "FREE" && " Upgrade now to unlock this feature."}</>}
        </p>
        <button
          onClick={() => onNavigate("/app/subscription")}
          style={{ display: "inline-block", padding: "14px 32px", backgroundColor: "#005BD3", color: "white", borderRadius: "8px", fontWeight: "600", fontSize: "16px", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,91,211,0.3)" }}
          onMouseEnter={e => { e.target.style.backgroundColor = "#004FC4"; e.target.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.target.style.backgroundColor = "#005BD3"; e.target.style.transform = "translateY(0)"; }}
        >
          {isPendingApproval ? "Complete Billing Approval" : "View Plans"}
        </button>
      </div>
    </div>
  );
}

// ── Global toast — shown on ALL app pages ──────────────────
function GlobalToast({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position     : "fixed",
      bottom       : "32px",
      right        : "32px",
      zIndex       : 99999,
      display      : "flex",
      flexDirection: "column-reverse",
      gap          : "10px",
      maxWidth     : "340px",
      width        : "340px",
      pointerEvents: "none",
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            pointerEvents: "auto",
            background   : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color        : "white",
            borderRadius : "16px",
            padding      : "14px 16px",
            boxShadow    : "0 6px 24px rgba(99,102,241,0.45)",
            display      : "flex",
            alignItems   : "flex-start",
            gap          : "12px",
            animation    : "globalSlideIn 0.3s ease",
            border       : "1px solid rgba(255,255,255,0.15)",
            position     : "relative",
            overflow     : "hidden",
          }}
        >
          <div style={{ position: "absolute", bottom: 0, left: 0, height: "3px", background: "rgba(255,255,255,0.4)", animation: "globalToastProgress 7s linear forwards", width: "100%" }} />
          <div style={{ width: "36px", height: "36px", background: "rgba(255,255,255,0.2)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>💬</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: "700", fontSize: "13px", marginBottom: "4px" }}>{toast.title}</div>
            {toast.imageUrl && (
              <img src={toast.imageUrl} alt="attachment" style={{ width: "100%", maxHeight: "100px", objectFit: "cover", borderRadius: "8px", marginBottom: "6px", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />
            )}
            <div style={{ fontSize: "12px", opacity: 0.9, lineHeight: "1.45", wordBreak: "break-word" }}>{toast.body}</div>
            <div style={{ fontSize: "10px", opacity: 0.6, marginTop: "4px" }}>{toast.time}</div>
          </div>
          <button onClick={() => onDismiss(toast.id)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", width: "22px", height: "22px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "13px", fontWeight: "700" }}>×</button>
        </div>
      ))}
      <style>{`
        @keyframes globalSlideIn {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes globalToastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const { apiKey, usage, subscriptionStatus, currentShop } = useLoaderData();
  const location    = useLocation();
  const navigate    = useNavigate();
  const revalidator = useRevalidator();

  const [globalToasts, setGlobalToasts] = useState([]);
  const fcmInitRef = useRef(false);
  const audioRef   = useRef(null);

  const pushGlobalToast = (title, body, imageUrl = null) => {
    const id = Date.now() + Math.random();
    setGlobalToasts(prev => [...prev, {
      id,
      title,
      body,
      imageUrl,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
    setTimeout(() => setGlobalToasts(prev => prev.filter(t => t.id !== id)), 8000);
  };

  const dismissToast = (id) => setGlobalToasts(prev => prev.filter(t => t.id !== id));

  // ✅ FCM setup runs on EVERY page of the app
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    if (fcmInitRef.current) return;
    if (!currentShop) return;

    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");

    async function setupFCM() {
      try {
        // Only run if admin has already granted permission.
        // First-time prompt is handled by "Enable Notifications" button
        // inside app.chat.admin.jsx — we never auto-prompt here.
        if (Notification.permission !== "granted") {
          console.log(`[FCM] Permission "${Notification.permission}" — skipping`);
          return;
        }

        // Register (or reuse) Firebase service worker
        let swReg;
        try {
          swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
          await navigator.serviceWorker.ready;
        } catch (swErr) {
          console.warn("[FCM] SW registration failed:", swErr.message);
          return;
        }

        // Init Firebase (reuse if already done)
        const app       = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
        const messaging = getMessaging(app);

        // Get FCM token
        const token = await getToken(messaging, {
          vapidKey                 : FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });

        if (!token) { console.warn("[FCM] No token"); return; }

        // Save token to DB — ensures push works even when admin is NOT
        // on the chat panel page
        await fetch(`${BACKEND_URL}/app/admin/register-fcm-token`, {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({
            shop        : currentShop,
            fcmToken    : token,
            registeredAt: new Date().toISOString(),
          }),
        });

        fcmInitRef.current = true;
        console.log(`[FCM] ✅ Ready on all pages — ${currentShop}`);

        // ── Foreground handler ─────────────────────────────────
        // When app tab is OPEN and VISIBLE → browser won't auto-show
        // a notification, so we show our own in-app toast instead.
        // When tab is HIDDEN → we show a native Notification.
        // When app is CLOSED → service worker handles it automatically.
        onMessage(messaging, (payload) => {
          console.log("[FCM] Message received:", payload);

          if (audioRef.current) audioRef.current.play().catch(() => {});

          const imageUrl = payload.notification?.image
            || payload.data?.imageUrl
            || payload.data?.fileUrl
            || null;

          const isImage  = !!(imageUrl);
          const bodyText = isImage
            ? "📷 Customer sent an image"
            : (payload.notification?.body || payload.data?.message || "Customer sent a message");

          const title = payload.notification?.title || "💬 New Message";

          if (document.hidden) {
            // Tab hidden — show native notification
            new Notification(title, {
              body : bodyText,
              icon : "/icons/talksy-192.png",
              image: imageUrl || undefined,
            });
          } else {
            // Tab visible — show in-app toast
            pushGlobalToast(title, bodyText, imageUrl);
          }
        });

      } catch (err) {
        console.error("[FCM] Setup error:", err.message);
      }
    }

    const timer = setTimeout(setupFCM, 1000);
    return () => clearTimeout(timer);
  }, [currentShop]);

  // ── Plan/billing logic ─────────────────────────────────────
  const isApproachingLimit = usage && typeof usage.chats.percentage === "number" && usage.chats.percentage > 80;
  const isAtLimit          = usage && typeof usage.chats.percentage === "number" && usage.chats.percentage >= 100;

  const isBillingApproved = subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const isPendingApproval = subscriptionStatus === "pending_approval";

  const isPremiumPlan  = usage && usage.plan === "PREMIUM"  && isBillingApproved;
  const isStandardPlan = usage && usage.plan === "STANDARD" && isBillingApproved;
  const isPaidPlan     = isPremiumPlan || isStandardPlan;

  const canManageFAQs      = isPremiumPlan || isStandardPlan;
  const canCustomizeWidget = isPremiumPlan || isStandardPlan;

  const currentPath = location.pathname;
  let isPageLocked = false;
  let requiredPlan = "";
  if (currentPath.includes("/admin/search")) { isPageLocked = !isPaidPlan;         requiredPlan = "Standard"; }
  if (currentPath.includes("/settings"))     { isPageLocked = !canCustomizeWidget; requiredPlan = "Standard"; }
  if (currentPath.includes("/faq"))          { isPageLocked = !canManageFAQs;      requiredPlan = "Standard"; }

  const params           = new URLSearchParams(location.search);
  const showUnlockLoader = params.get("billing") === "complete" || params.get("success") === "true";

  useEffect(() => {
    if (params.get("success") === "true" || params.get("billing") === "complete") {
      setTimeout(() => { window.location.href = window.location.pathname; }, 1500);
    }
  }, [location.search]);

  useEffect(() => {
    if (isPendingApproval) {
      const interval = setInterval(() => revalidator.revalidate(), 5000);
      return () => clearInterval(interval);
    }
  }, [isPendingApproval, revalidator]);

  useEffect(() => {
    const beat = async () => { try { await fetch("/app/update-status", { method: "POST" }); } catch (_) {} };
    beat();
    const interval = setInterval(beat, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ShopifyAppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>

        {/* ✅ Global toast — shown on ALL pages of the app */}
        <GlobalToast toasts={globalToasts} onDismiss={dismissToast} />

        <s-app-nav key={`${usage?.plan}-${subscriptionStatus}-${isBillingApproved}`}>
          <s-link href="/app/chat/admin">Chats</s-link>
          <s-link href="/app/admin/search">Search {!isPaidPlan && "🔒"}</s-link>
          <s-link href="/app/settings">Settings {!canCustomizeWidget && "🔒"}</s-link>
          <s-link href="/app/faq">FAQs {!canManageFAQs && "🔒"}</s-link>
          <s-link href="/app/subscription">
            Subscription
            {usage && isApproachingLimit && !isAtLimit && usage.chats.remaining !== "Unlimited" && (
              <span style={{ marginLeft: "8px" }}><Badge tone="warning">{usage.chats.remaining} left</Badge></span>
            )}
            {usage && isAtLimit && (
              <span style={{ marginLeft: "8px" }}><Badge tone="critical">Limit Reached</Badge></span>
            )}
            {isPendingApproval && (
              <span style={{ marginLeft: "8px" }}><Badge tone="info">Pending</Badge></span>
            )}
          </s-link>
        </s-app-nav>

        {showUnlockLoader && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
            <div style={{ width: "60px", height: "60px", border: "4px solid #E1E3E5", borderTop: "4px solid #005BD3", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <h2 style={{ fontSize: "24px", fontWeight: "600", color: "#202223", margin: 0 }}>Activating Your Plan</h2>
            <p style={{ fontSize: "16px", color: "#6d7175", margin: 0 }}>Unlocking features... Please wait</p>
            <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {isPendingApproval && !showUnlockLoader && (
          <div style={{ padding: "12px 20px", backgroundColor: "#E3F2FD", borderBottom: "1px solid #90CAF9", textAlign: "center" }}>
            <span style={{ fontWeight: 600 }}>⏳ Your subscription upgrade is pending billing approval.</span>{" "}
            <button onClick={() => navigate("/app/subscription")} style={{ background: "none", border: "none", color: "#005BD3", textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}>Complete billing approval</button>
          </div>
        )}

        {usage && (isApproachingLimit || isAtLimit) && isBillingApproved && !showUnlockLoader && (
          <div style={{ padding: "12px 20px", backgroundColor: isAtLimit ? "#FED3D1" : "#FFF4E5", borderBottom: "1px solid #ddd", textAlign: "center" }}>
            <span style={{ fontWeight: 600 }}>
              {isAtLimit
                ? `⚠️ You've reached your ${usage.plan} plan limit (${usage.chats.current}/${usage.chats.max} chats).`
                : `⚡ You're using ${Math.round(usage.chats.percentage)}% of your ${usage.plan} plan.`}
            </span>{" "}
            <button onClick={() => navigate("/app/subscription")} style={{ background: "none", border: "none", color: "#005BD3", textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}>
              {isAtLimit ? "Upgrade now to continue" : "Upgrade your plan"}
            </button>
          </div>
        )}

        <div style={{ position: "relative", minHeight: "100vh" }}>
          <div style={{ filter: isPageLocked ? "blur(4px)" : "none", pointerEvents: isPageLocked ? "none" : "auto", userSelect: isPageLocked ? "none" : "auto", opacity: isPageLocked ? "0.5" : "1", transition: "filter 0.3s ease, opacity 0.3s ease" }}>
            <Outlet />
          </div>
          {isPageLocked && (
            <LockedPageOverlay
              requiredPlan     ={requiredPlan}
              currentPlan      ={usage?.plan || "FREE"}
              isPendingApproval={isPendingApproval}
              onNavigate       ={navigate}
            />
          )}
        </div>

      </PolarisAppProvider>
    </ShopifyAppProvider>
  );
}

export function ErrorBoundary() { return boundary.error(useRouteError()); }
export const headers = (headersArgs) => boundary.headers(headersArgs);