// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.jsx
//
//  DEFINITIVE FIX FOR "notifications only when chat page open":
//
//  ROOT CAUSE: FCM token was only being saved to DB when admin
//  opened app.chat.admin.jsx. If admin never opened it, no token
//  in DB = Firebase has nowhere to send the push.
//
//  FIX:
//  1. Token registration runs in app.jsx root (every page load)
//  2. SW registers with skipWaiting+claim (activates immediately)
//  3. SW "push" event always fires and shows OS notification
//  4. SW postMessages open clients → in-app toast shown
//  5. No dependency on which page admin is on
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
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

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

// ── Loader ─────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const subscription = await prisma.subscription.findUnique({ where: { shop } });

  let usage = null;
  try {
    usage = await getUsageStats(shop);
  } catch (error) {
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

// ── Locked overlay ─────────────────────────────────────────
function LockedPageOverlay({ requiredPlan, currentPlan, isPendingApproval, onNavigate }) {
  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, WebkitBackdropFilter:"blur(12px)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ borderRadius:"16px", padding:"48px 40px", maxWidth:"520px", textAlign:"center" }}>
        <div style={{ fontSize:"72px", marginBottom:"20px", lineHeight:1 }}>🔒</div>
        <h2 style={{ fontSize:"26px", fontWeight:"700", marginBottom:"12px", color:"#202223", lineHeight:"1.3" }}>
          {isPendingApproval ? "Billing Approval Required" : `Activate Your ${requiredPlan} Plan`}
        </h2>
        <p style={{ fontSize:"16px", color:"#6d7175", marginBottom:"28px", lineHeight:"1.6" }}>
          {isPendingApproval
            ? <>Your subscription upgrade is pending billing approval.</>
            : <>This feature requires the <strong>{requiredPlan}</strong> plan or higher.{currentPlan === "FREE" && " Upgrade now to unlock."}</>}
        </p>
        <button
          onClick={() => onNavigate("/app/subscription")}
          style={{ padding:"14px 32px", backgroundColor:"#005BD3", color:"white", borderRadius:"8px", fontWeight:"600", fontSize:"16px", border:"none", cursor:"pointer" }}
          onMouseEnter={e => { e.target.style.backgroundColor = "#004FC4"; }}
          onMouseLeave={e => { e.target.style.backgroundColor = "#005BD3"; }}
        >
          {isPendingApproval ? "Complete Billing Approval" : "View Plans"}
        </button>
      </div>
    </div>
  );
}

// ── Global in-app toast ────────────────────────────────────
function GlobalToast({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position     : "fixed",
      bottom       : "32px",
      right        : "32px",
      zIndex       : 2147483647, // max possible — always on top
      display      : "flex",
      flexDirection: "column-reverse",
      gap          : "10px",
      maxWidth     : "340px",
      pointerEvents: "none",
    }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{
          pointerEvents: "auto",
          background   : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          color        : "white",
          borderRadius : "16px",
          padding      : "14px 16px",
          boxShadow    : "0 6px 24px rgba(99,102,241,0.5)",
          display      : "flex",
          alignItems   : "flex-start",
          gap          : "12px",
          animation    : "talksySlideIn 0.3s ease",
          border       : "1px solid rgba(255,255,255,0.15)",
          position     : "relative",
          overflow     : "hidden",
        }}>
          <div style={{ position:"absolute", bottom:0, left:0, height:"3px", background:"rgba(255,255,255,0.4)", animation:"talksyProgress 7s linear forwards", width:"100%" }} />
          <div style={{ width:"36px", height:"36px", background:"rgba(255,255,255,0.2)", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0 }}>💬</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:"700", fontSize:"13px", marginBottom:"4px" }}>{toast.title}</div>
            {toast.imageUrl && (
              <img src={toast.imageUrl} alt="" style={{ width:"100%", maxHeight:"100px", objectFit:"cover", borderRadius:"8px", marginBottom:"6px" }} onError={e => e.currentTarget.style.display = "none"} />
            )}
            <div style={{ fontSize:"12px", opacity:0.9, lineHeight:"1.45", wordBreak:"break-word" }}>{toast.body}</div>
            <div style={{ fontSize:"10px", opacity:0.6, marginTop:"4px" }}>{toast.time}</div>
          </div>
          <button onClick={() => onDismiss(toast.id)} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"white", width:"22px", height:"22px", borderRadius:"6px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"14px" }}>×</button>
        </div>
      ))}
      <style>{`
        @keyframes talksySlideIn  { from{transform:translateX(120%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes talksyProgress { from{width:100%} to{width:0%} }
      `}</style>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────
export default function App() {
  const { apiKey, usage, subscriptionStatus, currentShop } = useLoaderData();
  const location    = useLocation();
  const navigate    = useNavigate();
  const revalidator = useRevalidator();

  const [globalToasts, setGlobalToasts] = useState([]);
  const audioRef        = useRef(null);
  const tokenSavedRef   = useRef(false); // prevent duplicate saves

  const pushGlobalToast = (title, body, imageUrl = null) => {
    const id = Date.now() + Math.random();
    setGlobalToasts(prev => [...prev, {
      id, title, body, imageUrl,
      time: new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
    }]);
    setTimeout(() => setGlobalToasts(prev => prev.filter(t => t.id !== id)), 8000);
  };

  // ════════════════════════════════════════════════════════
  //  FCM SETUP — runs on every page load in the root layout
  //  Registers SW + saves token to DB so push is always
  //  deliverable regardless of which page admin is on.
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    if (!currentShop) return;

    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");

    // ── Step 1: Register SW immediately (even before permission check)
    // SW must be registered so it can receive background pushes.
    // Token registration only happens after permission is granted.
    async function registerSW() {
      try {
        const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
        // skipWaiting is handled in the SW itself
        await navigator.serviceWorker.ready;
        console.log("[FCM] SW registered and ready");
        return swReg;
      } catch (err) {
        console.warn("[FCM] SW registration failed:", err.message);
        return null;
      }
    }

    // ── Step 2: Save token to DB (only if permission granted)
    async function saveToken(swReg) {
      if (Notification.permission !== "granted") return;
      if (tokenSavedRef.current) return;

      try {
        const app       = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
        const messaging = getMessaging(app);

        const token = await getToken(messaging, {
          vapidKey                 : FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });

        if (!token) { console.warn("[FCM] No token"); return; }

        const res = await fetch(`${BACKEND_URL}/app/admin/register-fcm-token`, {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({
            shop        : currentShop,
            fcmToken    : token,
            registeredAt: new Date().toISOString(),
          }),
        });

        if (res.ok) {
          tokenSavedRef.current = true;
          console.log(`[FCM] ✅ Token saved for ${currentShop}`);
        }
      } catch (err) {
        console.warn("[FCM] Token save error:", err.message);
      }
    }

    // ── Step 3: Listen for SW → page postMessages (in-app toast)
    // SW sends TALKSY_PUSH on every push received.
    // This works inside Shopify iframe on any page.
    function onSwMessage(event) {
      if (!event.data || event.data.type !== "TALKSY_PUSH") return;
      console.log("[FCM] SW message received:", event.data);
      if (audioRef.current) audioRef.current.play().catch(() => {});
      pushGlobalToast(
        event.data.title || "💬 New Message",
        event.data.body  || "Customer sent a message",
        event.data.imageUrl || null,
      );
    }

    // ── Step 4: Listen for permission-granted event from chat admin page
    function onPermissionGranted() {
      tokenSavedRef.current = false; // reset so token is re-saved
      registerSW().then(swReg => { if (swReg) saveToken(swReg); });
    }

    navigator.serviceWorker.addEventListener("message", onSwMessage);
    window.addEventListener("talksy:permission-granted", onPermissionGranted);

    // Run setup
    registerSW().then(swReg => { if (swReg) saveToken(swReg); });

    return () => {
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
      window.removeEventListener("talksy:permission-granted", onPermissionGranted);
    };
  }, [currentShop]);

  // ── Plan / billing ─────────────────────────────────────────
  const isApproachingLimit = usage && typeof usage.chats.percentage === "number" && usage.chats.percentage > 80;
  const isAtLimit          = usage && typeof usage.chats.percentage === "number" && usage.chats.percentage >= 100;
  const isBillingApproved  = subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const isPendingApproval  = subscriptionStatus === "pending_approval";
  const isPremiumPlan      = usage && usage.plan === "PREMIUM"  && isBillingApproved;
  const isStandardPlan     = usage && usage.plan === "STANDARD" && isBillingApproved;
  const isPaidPlan         = isPremiumPlan || isStandardPlan;
  const canManageFAQs      = isPaidPlan;
  const canCustomizeWidget = isPaidPlan;

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

        {/* ✅ Global toast — always visible on every page */}
        <GlobalToast toasts={globalToasts} onDismiss={(id) => setGlobalToasts(p => p.filter(t => t.id !== id))} />

        <s-app-nav key={`${usage?.plan}-${subscriptionStatus}-${isBillingApproved}`}>
          <s-link href="/app/chat/admin">Chats</s-link>
          <s-link href="/app/admin/search">Search {!isPaidPlan && "🔒"}</s-link>
          <s-link href="/app/settings">Settings {!canCustomizeWidget && "🔒"}</s-link>
          <s-link href="/app/faq">FAQs {!canManageFAQs && "🔒"}</s-link>
          <s-link href="/app/subscription">
            Subscription
            {usage && isApproachingLimit && !isAtLimit && usage.chats.remaining !== "Unlimited" && (
              <span style={{ marginLeft:"8px" }}><Badge tone="warning">{usage.chats.remaining} left</Badge></span>
            )}
            {usage && isAtLimit && <span style={{ marginLeft:"8px" }}><Badge tone="critical">Limit Reached</Badge></span>}
            {isPendingApproval && <span style={{ marginLeft:"8px" }}><Badge tone="info">Pending</Badge></span>}
          </s-link>
        </s-app-nav>

        {showUnlockLoader && (
          <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:99999, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"20px" }}>
            <div style={{ width:"60px", height:"60px", border:"4px solid #E1E3E5", borderTop:"4px solid #005BD3", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
            <h2 style={{ fontSize:"24px", fontWeight:"600", color:"#202223", margin:0 }}>Activating Your Plan</h2>
            <p style={{ fontSize:"16px", color:"#6d7175", margin:0 }}>Unlocking features... Please wait</p>
            <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {isPendingApproval && !showUnlockLoader && (
          <div style={{ padding:"12px 20px", backgroundColor:"#E3F2FD", borderBottom:"1px solid #90CAF9", textAlign:"center" }}>
            <span style={{ fontWeight:600 }}>⏳ Subscription upgrade pending billing approval.</span>{" "}
            <button onClick={() => navigate("/app/subscription")} style={{ background:"none", border:"none", color:"#005BD3", textDecoration:"underline", cursor:"pointer", padding:0, font:"inherit" }}>Complete billing approval</button>
          </div>
        )}

        {usage && (isApproachingLimit || isAtLimit) && isBillingApproved && !showUnlockLoader && (
          <div style={{ padding:"12px 20px", backgroundColor:isAtLimit?"#FED3D1":"#FFF4E5", borderBottom:"1px solid #ddd", textAlign:"center" }}>
            <span style={{ fontWeight:600 }}>
              {isAtLimit
                ? `⚠️ You've reached your ${usage.plan} plan limit (${usage.chats.current}/${usage.chats.max} chats).`
                : `⚡ You're using ${Math.round(usage.chats.percentage)}% of your ${usage.plan} plan.`}
            </span>{" "}
            <button onClick={() => navigate("/app/subscription")} style={{ background:"none", border:"none", color:"#005BD3", textDecoration:"underline", cursor:"pointer", padding:0, font:"inherit" }}>
              {isAtLimit ? "Upgrade now to continue" : "Upgrade your plan"}
            </button>
          </div>
        )}

        <div style={{ position:"relative", minHeight:"100vh" }}>
          <div style={{ filter:isPageLocked?"blur(4px)":"none", pointerEvents:isPageLocked?"none":"auto", userSelect:isPageLocked?"none":"auto", opacity:isPageLocked?"0.5":"1", transition:"filter 0.3s ease, opacity 0.3s ease" }}>
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