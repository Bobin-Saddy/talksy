// app/routes/app.chat.admin.jsx
// ✅ Users stay in conversation list even after chat history is deleted
// ✅ No "Deleted" tab - users always visible
// ✅ Trash icon shows next to users with deleted history

import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect, useRef, useMemo } from "react";

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icons = {
  Send: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  User: ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Paperclip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  Smile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  X: ({ size = 20, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  FileText: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  CheckCircle: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  AlertCircle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  RotateCcw: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  TrendingUp: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  AlertTriangle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Inbox: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  Lock: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
};

const PLAN_RETENTION_LABELS = {
  FREE:     "30 days (test: 2 min)",
  STANDARD: "6 months",
  PREMIUM:  "Forever",
};

// ─── LOADER ───────────────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { canCreateChat, runCleanupAndGetDeleted, getChatHistoryDays } = await import("../planLimits.server");

  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  if (!shop) throw new Response("Unauthorized", { status: 401 });

  const cleanupResult = await runCleanupAndGetDeleted(shop);

  const sessions = await prisma.chatSession.findMany({
    where: { shop },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });

  const chatLimit = await canCreateChat(shop);
  const historyInfo = await getChatHistoryDays(shop);

  const sessionsWithLimitInfo = sessions
    .map((s, index) => ({
      ...s,
      chatIndex: index + 1,
      isOverLimit: chatLimit.max > 0 && index >= chatLimit.max,
    }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  return json({
    sessions: sessionsWithLimitInfo,
    currentShop: shop,
    planLimit: {
      current: sessions.length,
      max: chatLimit.max,
      remaining: chatLimit.remaining,
      isNearLimit: chatLimit.remaining <= 5 && chatLimit.remaining > 0,
      isAtLimit: !chatLimit.allowed,
      isOverLimit: chatLimit.max > 0 && sessions.length > chatLimit.max,
      overLimitBy: chatLimit.max > 0 ? Math.max(0, sessions.length - chatLimit.max) : 0,
    },
    cleanupResult: {
      deleted: cleanupResult.deleted,
      deletedSessionIds: cleanupResult.deletedSessionIds || [],
      plan: cleanupResult.plan,
    },
    historyInfo: {
      days: historyInfo.days,
      unlimited: historyInfo.unlimited,
      label: historyInfo.label || PLAN_RETENTION_LABELS[historyInfo.plan] || "Unknown",
      plan: historyInfo.plan,
    },
  });
};

// ─── ACTION ───────────────────────────────────────────────────────────────────
export const action = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");

  const { session } = await authenticate.admin(request);
  const body = await request.json();

  if (body.action === "resolve") {
    await prisma.chatSession.update({ where: { sessionId: body.sessionId }, data: { isResolved: true, resolvedAt: new Date(), resolvedBy: "admin" } });
    return json({ success: true });
  }
  if (body.action === "unresolve") {
    await prisma.chatSession.update({ where: { sessionId: body.sessionId }, data: { isResolved: false, resolvedAt: null, resolvedBy: null } });
    return json({ success: true });
  }
  return json({ success: false });
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function DeletedChatBanner({ plan, onDismiss, onUpgrade }) {
  const info = {
    FREE: { detail: "Free plan mein chat history 30 din (testing: 2 min) ke baad delete hoti hai.", bg: "#fffbeb", border: "#fcd34d" },
    STANDARD: { detail: "Standard plan mein chat history 6 mahine ke baad delete hoti hai.", bg: "#eef2ff", border: "#c7d2fe" },
  }[plan] || { detail: "Plan limit ki wajah se chat delete ho gayi.", bg: "#fffbeb", border: "#fcd34d" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: "20px", padding: "36px", maxWidth: "460px", width: "90%", boxShadow: "0 25px 60px rgba(0,0,0,0.25)", textAlign: "center", border: `2px solid ${info.border}` }}>
        <div style={{ fontSize: "56px", marginBottom: "16px" }}>🗑️</div>
        <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#111827", marginBottom: "12px" }}>⚠️ Kuch Chat History Delete Ho Gayi</h2>
        <div style={{ background: info.bg, border: `1px solid ${info.border}`, borderRadius: "12px", padding: "14px", marginBottom: "20px" }}>
          <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: 0 }}>{info.detail}</p>
        </div>
        <div style={{ background: "#f9fafb", borderRadius: "10px", padding: "12px 16px", marginBottom: "24px", fontSize: "13px", color: "#6b7280", lineHeight: "1.6" }}>
          <strong>📋 Retention:</strong><br />
          🆓 FREE: 30 din (test: 2 min) &nbsp; ⭐ STANDARD: 6 mahine &nbsp; 👑 PREMIUM: Kabhi nahi
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={onDismiss} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "2px solid #e5e7eb", background: "white", color: "#6b7280", fontWeight: "600", fontSize: "14px", cursor: "pointer" }}>Samajh Gaya</button>
          <button onClick={onUpgrade} style={{ flex: 2, padding: "12px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #7c3aed, #6366f1)", color: "white", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>🚀 Upgrade</button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message, type = "info", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  const c = { info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" }, warning: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e" }, success: { bg: "#f0fdf4", border: "#86efac", text: "#166534" }, error: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" } }[type] || {};
  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", background: c.bg, border: `1px solid ${c.border}`, color: c.text, borderRadius: "12px", padding: "14px 18px", fontSize: "13px", fontWeight: "600", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 9999, maxWidth: "320px", display: "flex", alignItems: "center", gap: "10px", animation: "slideIn 0.3s ease" }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: c.text, padding: 0 }}><Icons.X size={14} /></button>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function NeuralChatAdmin() {
  const { sessions: initSessions, currentShop, planLimit: initPlanLimit, cleanupResult: initCleanup, historyInfo } = useLoaderData();

  const [sessions, setSessions] = useState(initSessions);
  const [planLimit, setPlanLimit] = useState(initPlanLimit);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [filterStatus, setFilterStatus] = useState("all");
  const [toasts, setToasts] = useState([]);
  const [showDeletedBanner, setShowDeletedBanner] = useState(false);
  const [deletedPlan, setDeletedPlan] = useState(null);
  const [chatHistoryDeleted, setChatHistoryDeleted] = useState({});

  const fetcher = useFetcher();
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const isFirstLoadRef = useRef(true);
  const processedCleanupRef = useRef(false);
  const emojis = ["😊", "👍", "❤️", "🙌", "✨", "🔥", "✅", "🤔", "💡", "🚀", "👋", "🙏", "🎉"];

  useEffect(() => {
    if (!processedCleanupRef.current && initCleanup?.deleted > 0) {
      processedCleanupRef.current = true;
      setDeletedPlan(initCleanup.plan);
      setShowDeletedBanner(true);
      const deleted = {};
      initCleanup.deletedSessionIds?.forEach(id => { deleted[id] = true; });
      setChatHistoryDeleted(deleted);
    }
  }, [initCleanup]);

  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  }, []);

  const addToast = (message, type = "info") => setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch(window.location.pathname, { headers: { Accept: "application/json" } });
        const data = await res.json();
        if (!data.sessions) return;

        const currentIds = sessions.map(s => s.sessionId);
        const newSessions = data.sessions.filter(s => !currentIds.includes(s.sessionId));

        setSessions(data.sessions);
        setPlanLimit(data.planLimit);

        if (data.cleanupResult?.deletedSessionIds?.length > 0) {
          const newDeleted = {};
          data.cleanupResult.deletedSessionIds.forEach(id => {
            if (!chatHistoryDeleted[id]) {
              newDeleted[id] = true;
              if (activeSession && activeSession.sessionId === id) {
                addToast(`🗑️ Chat history delete ho gayi (${historyInfo.plan} plan).`, "warning");
              }
            }
          });
          if (Object.keys(newDeleted).length > 0) {
            setChatHistoryDeleted(prev => ({ ...prev, ...newDeleted }));
          }
        }

        if (data.cleanupResult?.deleted > 0 && !processedCleanupRef.current) {
          processedCleanupRef.current = true;
          setDeletedPlan(data.cleanupResult.plan);
          setShowDeletedBanner(true);
        }

        if (newSessions.length > 0) {
          audioRef.current?.play().catch(() => { });
          if (Notification.permission === "granted") newSessions.forEach(ns => new Notification("New Chat", { body: "From: " + (ns.email || "Customer"), icon: "/favicon.ico" }));
          if (newSessions.some(s => s.isOverLimit)) setFilterStatus("requests");
        }
      } catch { }
    }, 1500);
    return () => clearInterval(iv);
  }, [sessions, activeSession, chatHistoryDeleted, historyInfo]);

  useEffect(() => {
    if (!activeSession) return;
    const hasDeletedHistory = chatHistoryDeleted[activeSession.sessionId];
    if (hasDeletedHistory) {
      setMessages([]);
      return;
    }
    const iv = setInterval(async () => {
      try {
        const res = await fetch("/app/chat/messages?sessionId=" + activeSession.sessionId);
        if (res.status === 404) {
          setChatHistoryDeleted(prev => ({ ...prev, [activeSession.sessionId]: true }));
          setMessages([]);
          addToast("🗑️ Chat history delete ho gayi.", "warning");
          return;
        }
        const data = await res.json();
        if (data.length !== messages.length || (data.length > 0 && data[data.length - 1].id !== lastMessageIdRef.current)) {
          const latest = data[data.length - 1];
          if (latest?.sender === "user" && latest.id !== lastMessageIdRef.current && !isFirstLoadRef.current) audioRef.current?.play().catch(() => { });
          setMessages(data);
          if (data.length > 0) lastMessageIdRef.current = data[data.length - 1].id;
        }
      } catch { }
    }, 1500);
    return () => clearInterval(iv);
  }, [activeSession, messages.length, chatHistoryDeleted]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const filteredSessions = useMemo(() => {
    let f = sessions.filter(s => s.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterStatus === "requests") return f.filter(s => s.isOverLimit);
    f = f.filter(s => !s.isOverLimit);
    if (filterStatus === "pending") return f.filter(s => !s.isResolved);
    if (filterStatus === "resolved") return f.filter(s => s.isResolved);
    return f;
  }, [sessions, searchTerm, filterStatus]);

  const withinLimit = sessions.filter(s => !s.isOverLimit);
  const overLimit = sessions.filter(s => s.isOverLimit);
  const isActiveOverLimit = activeSession?.isOverLimit === true;
  const hasDeletedHistory = activeSession ? chatHistoryDeleted[activeSession.sessionId] : false;

  const loadChat = async (sess) => {
    setActiveSession(sess);
    setUnreadCounts(prev => ({ ...prev, [sess.sessionId]: 0 }));
    isFirstLoadRef.current = true;
    if (chatHistoryDeleted[sess.sessionId]) {
      setMessages([]);
      setTimeout(() => { isFirstLoadRef.current = false; }, 500);
      return;
    }
    try {
      const res = await fetch("/app/chat/messages?sessionId=" + sess.sessionId);
      if (res.status === 404) {
        setChatHistoryDeleted(prev => ({ ...prev, [sess.sessionId]: true }));
        setMessages([]);
        return;
      }
      const data = await res.json();
      if (data.length > 0) lastMessageIdRef.current = data[data.length - 1].id;
      setMessages(data);
      setTimeout(() => { isFirstLoadRef.current = false; }, 500);
    } catch { }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFilePreview({ url: reader.result, name: file.name, type: file.type });
    reader.readAsDataURL(file);
  };

  const handleReply = async (text = null) => {
    if (isActiveOverLimit || hasDeletedHistory) {
      addToast(hasDeletedHistory ? "Chat history delete ho chuki hai." : "Plan limit exceed.", "error");
      return;
    }
    const finalMsg = text || reply;
    const finalFile = filePreview?.url;
    if ((!finalMsg.trim() && !finalFile) || !activeSession) return;
    setReply(""); setFilePreview(null); setShowEmojiPicker(false);
    try {
      const res = await fetch("/app/chat/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: finalMsg || "Attachment", sender: "admin", createdAt: new Date().toISOString(), sessionId: activeSession.sessionId, shop: currentShop, fileUrl: finalFile || null }) });
      const result = await res.json();
      if (!result.success) addToast("Message send nahi hua.", "error");
    } catch { addToast("Network error.", "error"); }
  };

  const handleMarkResolved = () => {
    if (!activeSession) return;
    fetcher.submit(JSON.stringify({ action: "resolve", sessionId: activeSession.sessionId }), { method: "post", action: "/app/chat/admin", encType: "application/json" });
    const u = { ...activeSession, isResolved: true, resolvedAt: new Date().toISOString() };
    setSessions(prev => prev.map(s => s.sessionId === activeSession.sessionId ? u : s));
    setActiveSession(u);
  };

  const handleReopenChat = () => {
    if (!activeSession) return;
    fetcher.submit(JSON.stringify({ action: "unresolve", sessionId: activeSession.sessionId }), { method: "post", action: "/app/chat/admin", encType: "application/json" });
    const u = { ...activeSession, isResolved: false, resolvedAt: null };
    setSessions(prev => prev.map(s => s.sessionId === activeSession.sessionId ? u : s));
    setActiveSession(u);
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#f9fafb", color: "#111827", fontFamily: '"Inter", system-ui, sans-serif' }}>
      {showDeletedBanner && <DeletedChatBanner plan={deletedPlan} onDismiss={() => setShowDeletedBanner(false)} onUpgrade={() => { window.location.href = "/app/subscription"; }} />}
      {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />)}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", cursor: "zoom-out" }}>
          <img src={selectedImage} style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: "12px" }} alt="Preview" />
        </div>
      )}

      {/* SIDEBAR */}
      <div style={{ width: "360px", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", background: "#fff" }}>
        <div style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#111827", margin: 0 }}>Messages</h2>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: 4 }}>Manage customer conversations</p>
          <div style={{ marginTop: "10px", padding: "8px 12px", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd", fontSize: "11px", color: "#0369a1", display: "flex", alignItems: "center", gap: "6px" }}>
            <Icons.Clock />
            <span><strong>{historyInfo.plan}</strong>: {historyInfo.unlimited ? "Never deleted" : `${historyInfo.label} auto-delete`}</span>
          </div>
        </div>

        {planLimit.isOverLimit && (
          <div style={{ margin: "0 16px 16px", padding: "14px", background: "linear-gradient(135deg,#7c3aed,#6366f1)", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}><Icons.AlertTriangle /><div style={{ fontSize: "13px", fontWeight: "700" }}>Over Limit (+{planLimit.overLimitBy})</div></div>
            <div style={{ fontSize: "12px", opacity: 0.95 }}>{planLimit.overLimitBy} customer{planLimit.overLimitBy !== 1 ? "s" : ""} waiting.</div>
            <button onClick={() => window.location.href = "/app/subscription"} style={{ marginTop: "10px", padding: "8px 14px", background: "white", color: "#7c3aed", border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "12px", cursor: "pointer", width: "100%" }}>Upgrade</button>
          </div>
        )}

        <div style={{ padding: "0 16px 16px", display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "6px", borderBottom: "1px solid #f3f4f6" }}>
          {[
            { key: "all", label: "All", count: withinLimit.length, color: "#6366f1" },
            { key: "pending", label: "Pending", count: withinLimit.filter(s => !s.isResolved).length, color: "#f59e0b" },
            { key: "resolved", label: "Resolved", count: withinLimit.filter(s => s.isResolved).length, color: "#10b981" },
            { key: "requests", label: "Requests", count: overLimit.length, color: "#7c3aed", icon: <Icons.Inbox /> },
          ].map(({ key, label, count, color, icon }) => (
            <button key={key} onClick={() => setFilterStatus(key)} style={{ padding: "8px 12px", borderRadius: "8px", border: filterStatus === key ? "none" : "1px solid #e5e7eb", background: filterStatus === key ? color : "#fff", color: filterStatus === key ? "#fff" : "#6b7280", fontWeight: "600", fontSize: "12px", cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
              {icon} {label} {count > 0 && `(${count})`}
            </button>
          ))}
        </div>

        <div style={{ padding: "16px" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: "12px", color: "#9ca3af" }}><Icons.Search /></span>
            <input placeholder="Search conversations..." style={{ width: "100%", padding: "10px 10px 10px 40px", borderRadius: "10px", border: "1px solid #e5e7eb", outline: "none", fontSize: "14px" }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
          {filteredSessions.map(sess => {
            const hasNoHistory = chatHistoryDeleted[sess.sessionId];
            return (
              <div key={sess.sessionId} onClick={() => loadChat(sess)} style={{ padding: "12px", borderRadius: "12px", cursor: "pointer", marginBottom: "6px", background: activeSession?.sessionId === sess.sessionId ? "#f0f9ff" : "transparent", border: activeSession?.sessionId === sess.sessionId ? "1px solid #bae6fd" : "1px solid transparent", transition: "all 0.2s" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: activeSession?.sessionId === sess.sessionId ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : sess.isOverLimit ? "#fef3c7" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", color: activeSession?.sessionId === sess.sessionId ? "white" : sess.isOverLimit ? "#92400e" : "#9ca3af", flexShrink: 0 }}>
                    {sess.isOverLimit ? <Icons.Lock /> : <Icons.User size={20} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: 2 }}>
                      <div style={{ fontWeight: "600", fontSize: "14px", color: "#111827" }}>{sess.email?.split("@")[0] || "User"}</div>
                      {sess.isResolved && <div style={{ background: "#10b981", borderRadius: "50%", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}><Icons.Check /></div>}
                      {sess.isOverLimit && <div style={{ background: "#f59e0b", color: "white", fontSize: "9px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px" }}>REQUEST</div>}
                      {hasNoHistory && <Icons.Trash color="#ef4444" />}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {hasNoHistory ? "History deleted" : (sess.messages[0]?.message || "New Chat")}
                    </div>
                  </div>
                  {unreadCounts[sess.sessionId] > 0 && <div style={{ background: "#ef4444", color: "white", fontSize: "10px", fontWeight: "700", padding: "4px 8px", borderRadius: "10px", minWidth: "20px", textAlign: "center" }}>{unreadCounts[sess.sessionId]}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff" }}>
        {!activeSession ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#d1d5db", gap: "16px", background: "#f9fafb" }}>
            <Icons.User size={80} /><p style={{ fontWeight: "600", fontSize: "16px", color: "#9ca3af" }}>Select a conversation</p>
          </div>
        ) : hasDeletedHistory ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", background: "#fef2f2" }}>
            <div style={{ textAlign: "center", maxWidth: "460px" }}>
              <div style={{ fontSize: "72px", marginBottom: "20px" }}>🗑️</div>
              <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#991b1b", marginBottom: "12px" }}>Chat History Deleted</h2>
              <div style={{ background: "white", border: "2px solid #fca5a5", borderRadius: "16px", padding: "20px", marginBottom: "24px" }}>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.7", margin: 0 }}>
                  <strong>{historyInfo.plan} plan</strong> automatically deletes chat history.<br /><br />
                  <strong>User:</strong> {activeSession.email}<br /><br />
                  <strong>📋 Retention:</strong><br />
                  🆓 FREE: 30 din (test: 2 min) · ⭐ STANDARD: 6 months · 👑 PREMIUM: Forever
                </p>
              </div>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <button onClick={() => { setActiveSession(null); }} style={{ padding: "12px 24px", borderRadius: "10px", border: "2px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "600", cursor: "pointer" }}>Back</button>
                <button onClick={() => window.location.href = "/app/subscription"} style={{ padding: "12px 24px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#7c3aed,#6366f1)", color: "white", fontWeight: "700", cursor: "pointer" }}>🚀 Upgrade</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: "20px 32px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: isActiveOverLimit ? "#fef3c7" : "#fff" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <h3 style={{ margin: 0, fontWeight: "700", fontSize: "18px", color: "#111827" }}>{activeSession.email}</h3>
                  {isActiveOverLimit && <div style={{ background: "#f59e0b", color: "white", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px" }}><Icons.Lock /> Over Limit</div>}
                  {activeSession.isResolved && !isActiveOverLimit && <div style={{ background: "#d1fae5", color: "#065f46", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px" }}><Icons.Check /> Resolved</div>}
                </div>
              </div>
              {!isActiveOverLimit && !activeSession.isResolved && <button onClick={handleMarkResolved} style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", fontWeight: "600", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><Icons.CheckCircle /> Resolve</button>}
              {!isActiveOverLimit && activeSession.isResolved && <button onClick={handleReopenChat} style={{ padding: "10px 18px", borderRadius: "10px", border: "2px solid #f59e0b", background: "#fff", color: "#f59e0b", fontWeight: "600", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><Icons.RotateCcw /> Reopen</button>}
              {isActiveOverLimit && <button onClick={() => window.location.href = "/app/subscription"} style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: "#f59e0b", color: "#fff", fontWeight: "600", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><Icons.TrendingUp /> Upgrade</button>}
            </div>

            <div ref={scrollRef} style={{ flex: 1, padding: "32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px", background: "#f9fafb" }}>
              {messages.map((msg, i) => (
                <div key={msg.id || i} style={{ alignSelf: msg.sender === "admin" ? "flex-end" : "flex-start", maxWidth: "65%" }}>
                  <div style={{ padding: "12px 16px", borderRadius: "16px", background: msg.sender === "admin" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : msg.sender === "bot" ? "#fef3c7" : "#fff", color: msg.sender === "admin" ? "#fff" : "#111827", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: msg.sender === "admin" ? "none" : msg.sender === "bot" ? "1px solid #fbbf24" : "1px solid #e5e7eb" }}>
                    {msg.fileUrl ? (msg.fileUrl.includes("image") || msg.fileUrl.startsWith("data:image") ? <img src={msg.fileUrl} onClick={() => setSelectedImage(msg.fileUrl)} style={{ maxWidth: "280px", borderRadius: "10px", cursor: "zoom-in" }} alt="attachment" /> : <div style={{ display: "flex", gap: "8px", alignItems: "center" }}><Icons.FileText /><a href={msg.fileUrl} target="_blank" rel="noreferrer" style={{ color: "inherit", fontWeight: "600", textDecoration: "none" }}>View Document</a></div>) : <div style={{ fontSize: "14px", lineHeight: "1.5" }}>{msg.message}</div>}
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px", textAlign: msg.sender === "admin" ? "right" : "left" }}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              ))}
            </div>

            {filePreview && !isActiveOverLimit && (
              <div style={{ padding: "12px 32px", background: "#fef3c7", borderTop: "2px solid #fbbf24", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ position: "relative" }}>
                  {filePreview.type.includes("image") ? <img src={filePreview.url} style={{ height: "50px", width: "50px", objectFit: "cover", borderRadius: "8px" }} alt="preview" /> : <div style={{ height: "50px", width: "50px", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px" }}><Icons.FileText /></div>}
                  <button onClick={() => setFilePreview(null)} style={{ position: "absolute", top: "-6px", right: "-6px", background: "#ef4444", borderRadius: "50%", border: "none", cursor: "pointer", padding: "4px", display: "flex" }}><Icons.X size={12} color="white" /></button>
                </div>
                <div><div style={{ fontSize: "13px", fontWeight: "600" }}>{filePreview.name}</div><div style={{ fontSize: "11px", color: "#6b7280" }}>Ready to send</div></div>
              </div>
            )}

            {!isActiveOverLimit ? (
              <div style={{ padding: "20px 32px", background: "#fff", borderTop: "1px solid #e5e7eb", position: "relative" }}>
                {showEmojiPicker && (
                  <div style={{ position: "absolute", bottom: "80px", left: "32px", background: "white", padding: "12px", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)", border: "1px solid #e5e7eb", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "8px", zIndex: 10 }}>
                    {emojis.map(e => <button key={e} onClick={() => { setReply(p => p + e); setShowEmojiPicker(false); }} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", padding: "6px", borderRadius: "8px" }}>{e}</button>)}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", background: "#f9fafb", borderRadius: "12px", padding: "6px 8px", border: "1px solid #e5e7eb" }}>
                  <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelect} accept="image/*,.pdf" />
                  <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: "none", border: "none", cursor: "pointer", color: showEmojiPicker ? "#6366f1" : "#9ca3af", padding: "8px" }}><Icons.Smile /></button>
                  <button onClick={() => fileInputRef.current.click()} style={{ background: "none", border: "none", cursor: "pointer", margin: "0 8px", color: "#9ca3af", padding: "8px" }}><Icons.Paperclip /></button>
                  <input placeholder="Type a message..." style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: "14px", color: "#111827" }} value={reply} onChange={e => setReply(e.target.value)} onKeyPress={e => { if (e.key === "Enter") handleReply(); }} />
                  <button onClick={() => handleReply()} style={{ width: "40px", height: "40px", borderRadius: "10px", background: (reply.trim() || filePreview) ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#e5e7eb", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icons.Send /></button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "20px 32px", background: "#fef3c7", borderTop: "2px solid #fbbf24" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px", background: "white", borderRadius: "12px", border: "2px dashed #f59e0b" }}>
                  <Icons.Lock />
                  <div style={{ flex: 1 }}><div style={{ fontSize: "14px", fontWeight: "600", color: "#92400e", marginBottom: "4px" }}>Locked</div><div style={{ fontSize: "12px", color: "#92400e" }}>Upgrade to respond</div></div>
                  <button onClick={() => window.location.href = "/app/subscription"} style={{ padding: "8px 16px", background: "#f59e0b", color: "white", border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}>Upgrade</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div style={{ width: "320px", padding: "24px", background: "#fff", borderLeft: "1px solid #e5e7eb" }}>
        <h4 style={{ fontSize: "11px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 20 }}>Details</h4>
        <div style={{ marginBottom: "16px", padding: "16px", background: planLimit.isOverLimit ? "#fef3c7" : planLimit.isAtLimit ? "#fee2e2" : planLimit.isNearLimit ? "#fef3c7" : "#eff6ff", borderRadius: "12px", border: planLimit.isOverLimit ? "1px solid #fcd34d" : planLimit.isAtLimit ? "1px solid #fca5a5" : planLimit.isNearLimit ? "1px solid #fcd34d" : "1px solid #bfdbfe" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "8px", letterSpacing: "0.5px", color: planLimit.isOverLimit ? "#92400e" : planLimit.isAtLimit ? "#991b1b" : planLimit.isNearLimit ? "#92400e" : "#1e40af" }}>PLAN USAGE</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}><Icons.TrendingUp /><span style={{ fontSize: "24px", fontWeight: "800", color: planLimit.isOverLimit ? "#92400e" : planLimit.isAtLimit ? "#991b1b" : planLimit.isNearLimit ? "#92400e" : "#1e40af" }}>{planLimit.max > 0 ? `${withinLimit.length}/${planLimit.max}` : sessions.length}</span></div>
          <div style={{ fontSize: "11px", color: planLimit.isOverLimit ? "#92400e" : planLimit.isAtLimit ? "#991b1b" : planLimit.isNearLimit ? "#92400e" : "#60a5fa" }}>
            {planLimit.isOverLimit ? `${planLimit.overLimitBy} in queue` : planLimit.isAtLimit ? "At limit" : `${planLimit.remaining} remaining`}
          </div>
          {(planLimit.isAtLimit || planLimit.isOverLimit) && <button onClick={() => window.location.href = "/app/subscription"} style={{ marginTop: "12px", padding: "8px 12px", background: planLimit.isOverLimit ? "#f59e0b" : "#dc2626", color: "white", border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "12px", cursor: "pointer", width: "100%" }}>Upgrade</button>}
        </div>

        <div style={{ marginBottom: "16px", padding: "14px", background: "#f0fdf4", borderRadius: "12px", border: "1px solid #86efac" }}>
          <div style={{ fontSize: "10px", color: "#166534", fontWeight: "700", marginBottom: "8px", letterSpacing: "0.5px" }}>RETENTION</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}><Icons.Trash /><span style={{ fontSize: "13px", fontWeight: "700", color: "#166534" }}>{historyInfo.unlimited ? "Forever" : historyInfo.label}</span></div>
          <div style={{ fontSize: "11px", color: "#16a34a" }}>{historyInfo.plan} plan</div>
        </div>

        {activeSession && !hasDeletedHistory && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ padding: "16px", background: activeSession.isResolved ? "#d1fae5" : isActiveOverLimit ? "#fee2e2" : "#fef3c7", borderRadius: "12px", border: activeSession.isResolved ? "1px solid #86efac" : isActiveOverLimit ? "1px solid #fca5a5" : "1px solid #fcd34d" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "8px", letterSpacing: "0.5px", color: activeSession.isResolved ? "#065f46" : isActiveOverLimit ? "#991b1b" : "#92400e" }}>STATUS</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "15px", color: activeSession.isResolved ? "#065f46" : isActiveOverLimit ? "#991b1b" : "#92400e" }}>
                {activeSession.isResolved ? <Icons.CheckCircle /> : isActiveOverLimit ? <Icons.Lock /> : <Icons.AlertCircle />}
                {activeSession.isResolved ? "Resolved" : isActiveOverLimit ? "Over Limit" : "Pending"}
              </div>
            </div>
            <div style={{ padding: "16px", background: "#eff6ff", borderRadius: "12px", border: "1px solid #bfdbfe" }}>
              <div style={{ fontSize: "10px", color: "#1e40af", fontWeight: "700", marginBottom: "8px", letterSpacing: "0.5px" }}>MESSAGES</div>
              <div style={{ fontSize: "28px", fontWeight: "800", color: "#1e40af" }}>{messages.length}</div>
            </div>
          </div>
        )}

        {activeSession && hasDeletedHistory && (
          <div style={{ padding: "16px", background: "#fef2f2", borderRadius: "12px", border: "1px solid #fca5a5" }}>
            <div style={{ fontSize: "10px", color: "#991b1b", fontWeight: "700", marginBottom: "8px", letterSpacing: "0.5px" }}>STATUS</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "15px", color: "#991b1b", marginBottom: "8px" }}>
              <Icons.Trash />
              History Deleted
            </div>
            <div style={{ fontSize: "11px", color: "#dc2626", lineHeight: "1.6" }}>
              Deleted per {historyInfo.plan} retention policy
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes slideIn { from{transform:translateX(100px);opacity:0} to{transform:translateX(0);opacity:1} }
        ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:#f3f4f6}
        ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:10px} ::-webkit-scrollbar-thumb:hover{background:#9ca3af}
      `}</style>
    </div>
  );
}