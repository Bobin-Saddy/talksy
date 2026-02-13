// app/routes/app.chat.admin.jsx - WITH AUTO CHAT HISTORY CLEANUP & DELETED MESSAGE
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { canCreateChat, runCleanupAndGetDeleted, getChatHistoryDays, PLAN_HISTORY_LABELS } from "../planLimits.server";

// --- ICONS ---
const Icons = {
  Send: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  User: ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Paperclip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>,
  Smile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>,
  X: ({ size = 20, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  FileText: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>,
  CheckCircle: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  AlertCircle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
  RotateCcw: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  TrendingUp: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>,
  AlertTriangle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  Inbox: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>,
  Lock: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
  Trash: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>,
  Zap: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
};

// ✅ PLAN LABEL HELPER
const getPlanRetentionLabel = (plan) => {
  const labels = {
    FREE: "2 min (test) / 30 days",
    STANDARD: "6 months",
    PREMIUM: "Forever",
  };
  return labels[plan] || "Unknown";
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  if (!shop) throw new Response("Unauthorized", { status: 401 });

  // ✅ RUN AUTO CLEANUP FIRST — then fetch remaining sessions
  const cleanupResult = await runCleanupAndGetDeleted(shop);

  // Fetch all sessions ordered by creation time
  const sessions = await prisma.chatSession.findMany({
    where: { shop },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const chatLimit = await canCreateChat(shop);
  const historyInfo = await getChatHistoryDays(shop);

  const sessionsWithLimitInfo = sessions.map((session, index) => {
    const isOverLimit = chatLimit.max > 0 && index >= chatLimit.max;
    return {
      ...session,
      chatIndex: index + 1,
      isOverLimit,
    };
  });

  sessionsWithLimitInfo.sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );

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
    // ✅ Cleanup info to show toast/message on frontend
    cleanupResult: {
      deleted: cleanupResult.deleted,
      deletedSessionIds: cleanupResult.deletedSessionIds || [],
      plan: cleanupResult.plan,
    },
    historyInfo: {
      days: historyInfo.days,
      unlimited: historyInfo.unlimited,
      label: historyInfo.label,
      plan: historyInfo.plan,
    },
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const body = await request.json();

  if (body.action === "resolve") {
    await prisma.chatSession.update({
      where: { sessionId: body.sessionId },
      data: { isResolved: true, resolvedAt: new Date(), resolvedBy: "admin" },
    });
    return json({ success: true });
  }

  if (body.action === "unresolve") {
    await prisma.chatSession.update({
      where: { sessionId: body.sessionId },
      data: { isResolved: false, resolvedAt: null, resolvedBy: null },
    });
    return json({ success: true });
  }

  // ✅ Manual cleanup action (optional)
  if (body.action === "cleanup") {
    const result = await runCleanupAndGetDeleted(shop, body.activeSessionId);
    return json({ success: true, cleanupResult: result });
  }

  return json({ success: false });
};

// ✅ DELETED CHAT BANNER COMPONENT
function DeletedChatBanner({ plan, onDismiss, onUpgrade }) {
  const planMessages = {
    FREE: {
      title: "⚠️ Aapki Chat History Delete Ho Gayi",
      detail: "Free plan mein chat history sirf 30 days (testing: 2 min) tak rehti hai. Uske baad automatic delete ho jaati hai.",
      color: "#f59e0b",
      bg: "#fffbeb",
      border: "#fcd34d",
    },
    STANDARD: {
      title: "⚠️ Aapki Chat History Delete Ho Gayi",
      detail: "Standard plan mein chat history 6 mahine (180 din) ke baad automatic delete ho jaati hai.",
      color: "#6366f1",
      bg: "#eef2ff",
      border: "#c7d2fe",
    },
  };

  const msg = planMessages[plan] || planMessages.FREE;

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(4px)",
      zIndex: 99999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        background: "white",
        borderRadius: "20px",
        padding: "36px",
        maxWidth: "460px",
        width: "90%",
        boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
        textAlign: "center",
        border: `2px solid ${msg.border}`,
      }}>
        <div style={{ fontSize: "56px", marginBottom: "16px" }}>🗑️</div>
        <h2 style={{
          fontSize: "20px",
          fontWeight: "800",
          color: "#111827",
          marginBottom: "12px",
          lineHeight: "1.3",
        }}>
          {msg.title}
        </h2>
        <div style={{
          background: msg.bg,
          border: `1px solid ${msg.border}`,
          borderRadius: "12px",
          padding: "14px",
          marginBottom: "20px",
        }}>
          <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: 0 }}>
            {msg.detail}
          </p>
        </div>
        <div style={{
          background: "#f9fafb",
          borderRadius: "10px",
          padding: "12px 16px",
          marginBottom: "24px",
          fontSize: "13px",
          color: "#6b7280",
          lineHeight: "1.5",
        }}>
          <strong>📋 Plan Retention Guide:</strong><br/>
          🆓 FREE: 30 days (2 min testing)<br/>
          ⭐ STANDARD: 6 months<br/>
          👑 PREMIUM: Kabhi delete nahi
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={onDismiss}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "10px",
              border: "2px solid #e5e7eb",
              background: "white",
              color: "#6b7280",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Samajh Gaya
          </button>
          <button
            onClick={onUpgrade}
            style={{
              flex: 2,
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)",
              color: "white",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(124,58,237,0.35)",
            }}
          >
            🚀 Plan Upgrade Karo
          </button>
        </div>
      </div>
    </div>
  );
}

// ✅ SMALL TOAST NOTIFICATION
function Toast({ message, type = "info", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
    warning: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e" },
    success: { bg: "#f0fdf4", border: "#86efac", text: "#166534" },
    error: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" },
  };
  const c = colors[type];

  return (
    <div style={{
      position: "fixed",
      bottom: "24px",
      right: "24px",
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
      borderRadius: "12px",
      padding: "14px 18px",
      fontSize: "13px",
      fontWeight: "600",
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      zIndex: 9999,
      maxWidth: "320px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      animation: "slideIn 0.3s ease",
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: c.text, padding: "0" }}>
        <Icons.X size={14} />
      </button>
    </div>
  );
}

export default function NeuralChatAdmin() {
  const {
    sessions: initialSessions,
    currentShop,
    planLimit: initialPlanLimit,
    cleanupResult: initialCleanup,
    historyInfo,
  } = useLoaderData();

  const [sessions, setSessions] = useState(initialSessions);
  const [planLimit, setPlanLimit] = useState(initialPlanLimit);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [accentColor] = useState("#6366f1");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [filterStatus, setFilterStatus] = useState("all");
  const [toasts, setToasts] = useState([]);
  const [showDeletedBanner, setShowDeletedBanner] = useState(false);
  const [deletedPlan, setDeletedPlan] = useState(null);
  // ✅ Track which session IDs have been deleted mid-session
  const [activeSessionDeleted, setActiveSessionDeleted] = useState(false);

  const fetcher = useFetcher();
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const isFirstLoadRef = useRef(true);
  const lastSessionCountRef = useRef(initialSessions.length);
  const processedCleanupRef = useRef(false);

  const emojis = ["😊", "👍", "❤️", "🙌", "✨", "🔥", "✅", "🤔", "💡", "🚀", "👋", "🙏", "🎉"];

  // ✅ Show deleted banner on first load if cleanup happened
  useEffect(() => {
    if (
      !processedCleanupRef.current &&
      initialCleanup?.deleted > 0
    ) {
      processedCleanupRef.current = true;
      setDeletedPlan(initialCleanup.plan);
      setShowDeletedBanner(true);
      console.log(
        `🗑️ ${initialCleanup.deleted} chat(s) were auto-deleted on page load for plan: ${initialCleanup.plan}`
      );
    }
  }, [initialCleanup]);

  useEffect(() => {
    audioRef.current = new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3"
    );
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const addToast = (message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ✅ REAL-TIME POLLING — also checks if active session was deleted
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(window.location.pathname, {
          headers: { Accept: "application/json" },
        });
        const data = await res.json();

        if (data.sessions && data.planLimit) {
          const currentSessionIds = sessions.map((s) => s.sessionId);
          const newSessions = data.sessions.filter(
            (s) => !currentSessionIds.includes(s.sessionId)
          );

          setSessions(data.sessions);
          setPlanLimit(data.planLimit);
          lastSessionCountRef.current = data.sessions.length;

          // ✅ Check if active session was deleted during this poll
          if (activeSession) {
            const stillExists = data.sessions.find(
              (s) => s.sessionId === activeSession.sessionId
            );
            if (!stillExists && !activeSessionDeleted) {
              setActiveSessionDeleted(true);
              setMessages([]);
              addToast(
                `🗑️ Yeh chat automatically delete ho gayi (${historyInfo.plan} plan limit).`,
                "warning"
              );
            }
          }

          // ✅ Also show banner if new cleanup happened mid-session
          if (data.cleanupResult?.deleted > 0) {
            setDeletedPlan(data.cleanupResult.plan);
            setShowDeletedBanner(true);
          }

          // New chat notifications
          if (newSessions.length > 0) {
            if (audioRef.current) audioRef.current.play().catch(() => {});
            if (Notification.permission === "granted") {
              newSessions.forEach((ns) => {
                new Notification("New Chat Request", {
                  body: "From: " + (ns.email || "Customer"),
                  icon: "/favicon.ico",
                });
              });
            }
            const hasOverLimitNewChat = newSessions.some((s) => s.isOverLimit);
            if (hasOverLimitNewChat) setFilterStatus("requests");
          }
        }
      } catch (e) {
        console.error("Session refresh failed:", e);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [sessions, activeSession, activeSessionDeleted, historyInfo]);

  const filteredSessions = useMemo(() => {
    let filtered = sessions.filter((s) =>
      s.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filterStatus === "requests") {
      filtered = filtered.filter((s) => s.isOverLimit === true);
    } else {
      filtered = filtered.filter((s) => s.isOverLimit !== true);
      if (filterStatus === "pending") filtered = filtered.filter((s) => !s.isResolved);
      else if (filterStatus === "resolved") filtered = filtered.filter((s) => s.isResolved);
    }
    return filtered;
  }, [sessions, searchTerm, filterStatus]);

  const isActiveSessionOverLimit = activeSession?.isOverLimit === true;
  const withinLimitSessions = sessions.filter((s) => s.isOverLimit !== true);
  const overLimitSessions = sessions.filter((s) => s.isOverLimit === true);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const notifyNewMessage = (session, message) => {
    if (audioRef.current) audioRef.current.play().catch(() => {});
    if (activeSession?.sessionId !== session.sessionId) {
      setUnreadCounts((prev) => ({
        ...prev,
        [session.sessionId]: (prev[session.sessionId] || 0) + 1,
      }));
    }
    if (document.visibilityState !== "visible" && Notification.permission === "granted") {
      new Notification("New message from " + (session.email || "Customer"), {
        body: message.message,
        icon: "/favicon.ico",
      });
    }
  };

  useEffect(() => {
    if (!activeSession || activeSessionDeleted) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/app/chat/messages?sessionId=" + activeSession.sessionId);

        // ✅ If 404 / session deleted on server
        if (res.status === 404) {
          setActiveSessionDeleted(true);
          setMessages([]);
          addToast("🗑️ Yeh chat server se delete ho gayi.", "warning");
          return;
        }

        const data = await res.json();
        if (
          data.length !== messages.length ||
          (data.length > 0 && data[data.length - 1].id !== lastMessageIdRef.current)
        ) {
          const latestServerMsg = data[data.length - 1];
          if (
            latestServerMsg &&
            latestServerMsg.sender === "user" &&
            latestServerMsg.id !== lastMessageIdRef.current &&
            !isFirstLoadRef.current
          ) {
            notifyNewMessage(activeSession, latestServerMsg);
          }
          setMessages(data);
          if (data.length > 0) lastMessageIdRef.current = data[data.length - 1].id;
        }
      } catch (err) {
        console.error("Message polling error", err);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [activeSession, messages.length, activeSessionDeleted]);

  const loadChat = async (session) => {
    setActiveSession(session);
    setActiveSessionDeleted(false);
    setUnreadCounts((prev) => ({ ...prev, [session.sessionId]: 0 }));
    isFirstLoadRef.current = true;
    try {
      const res = await fetch("/app/chat/messages?sessionId=" + session.sessionId);
      if (res.status === 404) {
        setActiveSessionDeleted(true);
        setMessages([]);
        return;
      }
      const data = await res.json();
      if (data.length > 0) lastMessageIdRef.current = data[data.length - 1].id;
      setMessages(data);
      setTimeout(() => { isFirstLoadRef.current = false; }, 500);
    } catch (err) {}
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview({ url: reader.result, name: file.name, type: file.type });
    };
    reader.readAsDataURL(file);
  };

  const addEmoji = (emoji) => {
    setReply((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleReply = async (text = null) => {
    if (isActiveSessionOverLimit || activeSessionDeleted) {
      if (activeSessionDeleted) {
        addToast("Yeh chat delete ho chuki hai. Reply nahi kar sakte.", "error");
      } else {
        addToast("Plan limit exceed ho gayi. Upgrade karo.", "warning");
      }
      return;
    }

    const finalMsg = text || reply;
    const finalFile = filePreview?.url;
    if ((!finalMsg.trim() && !finalFile) || !activeSession) return;

    const newMessage = {
      message: finalMsg || "Attachment",
      sender: "admin",
      createdAt: new Date().toISOString(),
      sessionId: activeSession.sessionId,
      shop: currentShop,
      fileUrl: finalFile || null,
    };

    setReply("");
    setFilePreview(null);
    setShowEmojiPicker(false);

    try {
      const response = await fetch("/app/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMessage),
      });
      const result = await response.json();
      if (!result.success) {
        addToast("Message send nahi hua. Dobara try karo.", "error");
      }
    } catch (error) {
      addToast("Network error. Message send nahi hua.", "error");
    }
  };

  const handleMarkResolved = async () => {
    if (!activeSession) return;
    fetcher.submit(
      JSON.stringify({ action: "resolve", sessionId: activeSession.sessionId }),
      { method: "post", action: "/app/chat/admin", encType: "application/json" }
    );
    setSessions((prev) =>
      prev.map((s) =>
        s.sessionId === activeSession.sessionId
          ? { ...s, isResolved: true, resolvedAt: new Date().toISOString() }
          : s
      )
    );
    setActiveSession((prev) => ({ ...prev, isResolved: true, resolvedAt: new Date().toISOString() }));
  };

  const handleReopenChat = async () => {
    if (!activeSession) return;
    fetcher.submit(
      JSON.stringify({ action: "unresolve", sessionId: activeSession.sessionId }),
      { method: "post", action: "/app/chat/admin", encType: "application/json" }
    );
    setSessions((prev) =>
      prev.map((s) =>
        s.sessionId === activeSession.sessionId
          ? { ...s, isResolved: false, resolvedAt: null }
          : s
      )
    );
    setActiveSession((prev) => ({ ...prev, isResolved: false, resolvedAt: null }));
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#f9fafb", color: "#111827", fontFamily: '"Inter", system-ui, sans-serif' }}>

      {/* ✅ DELETED CHAT MODAL BANNER */}
      {showDeletedBanner && (
        <DeletedChatBanner
          plan={deletedPlan}
          onDismiss={() => setShowDeletedBanner(false)}
          onUpgrade={() => { window.location.href = "/app/subscription"; }}
        />
      )}

      {/* ✅ TOAST NOTIFICATIONS */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}

      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.95)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", cursor: "zoom-out" }}
        >
          <img src={selectedImage} style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: "12px" }} alt="Preview" />
        </div>
      )}

      {/* SIDEBAR */}
      <div style={{ width: "360px", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", background: "#fff" }}>
        <div style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#111827", margin: 0 }}>Messages</h2>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: 4 }}>Manage customer conversations</p>
          {/* ✅ PLAN RETENTION INFO */}
          <div style={{ marginTop: "10px", padding: "8px 12px", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd", fontSize: "11px", color: "#0369a1", display: "flex", alignItems: "center", gap: "6px" }}>
            <Icons.Clock />
            <span><strong>{historyInfo.plan}</strong>: Chat history {historyInfo.unlimited ? "forever rehti hai" : `${historyInfo.label} ke baad delete hogi`}</span>
          </div>
        </div>

        {planLimit.isOverLimit && (
          <div style={{ margin: "0 16px 16px", padding: "14px", background: "linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <Icons.AlertTriangle />
              <div style={{ fontSize: "13px", fontWeight: "700" }}>Over Plan Limit (+{planLimit.overLimitBy} extra)</div>
            </div>
            <div style={{ fontSize: "12px", opacity: 0.95, lineHeight: "1.4" }}>
              {planLimit.overLimitBy} customer{planLimit.overLimitBy !== 1 ? "s" : ""} waiting. Check the "Requests" tab.
            </div>
            <button
              onClick={() => (window.location.href = "/app/subscription")}
              style={{ marginTop: "10px", padding: "8px 14px", background: "white", color: "#7c3aed", border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "12px", cursor: "pointer", width: "100%" }}
            >
              Upgrade to Continue
            </button>
          </div>
        )}

        {/* 4-TAB FILTER */}
        <div style={{ padding: "0 16px 16px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px", borderBottom: "1px solid #f3f4f6" }}>
          {[
            { key: "all", label: "All", count: withinLimitSessions.length, color: "#6366f1" },
            { key: "pending", label: "Pending", count: withinLimitSessions.filter((s) => !s.isResolved).length, color: "#f59e0b" },
            { key: "resolved", label: "Resolved", count: withinLimitSessions.filter((s) => s.isResolved).length, color: "#10b981" },
            { key: "requests", label: "Requests", count: overLimitSessions.length, color: "#7c3aed", icon: <Icons.Inbox /> },
          ].map(({ key, label, count, color, icon }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              style={{ padding: "8px 12px", borderRadius: "8px", border: filterStatus === key ? "none" : "1px solid #e5e7eb", background: filterStatus === key ? color : "#fff", color: filterStatus === key ? "#fff" : "#6b7280", fontWeight: "600", fontSize: "12px", cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
            >
              {icon} {label} {count > 0 && `(${count})`}
            </button>
          ))}
        </div>

        <div style={{ padding: "16px" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: "12px", color: "#9ca3af" }}><Icons.Search /></span>
            <input
              placeholder="Search conversations..."
              style={{ width: "100%", padding: "10px 10px 10px 40px", borderRadius: "10px", border: "1px solid #e5e7eb", outline: "none", fontSize: "14px" }}
              onChange={(e) => setSearchTerm(e.target.value)}
              value={searchTerm}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
          {filteredSessions.map((session) => (
            <div
              key={session.sessionId}
              onClick={() => loadChat(session)}
              style={{ position: "relative", padding: "12px", borderRadius: "12px", cursor: "pointer", marginBottom: "6px", background: activeSession?.sessionId === session.sessionId ? "#f0f9ff" : "transparent", border: activeSession?.sessionId === session.sessionId ? "1px solid #bae6fd" : "1px solid transparent", transition: "all 0.2s" }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: activeSession?.sessionId === session.sessionId ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : session.isOverLimit ? "#fef3c7" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", color: activeSession?.sessionId === session.sessionId ? "white" : session.isOverLimit ? "#92400e" : "#9ca3af", flexShrink: 0 }}>
                  {session.isOverLimit ? <Icons.Lock /> : <Icons.User size={20} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: 2 }}>
                    <div style={{ fontWeight: "600", fontSize: "14px", color: "#111827" }}>{session.email?.split("@")[0] || "User"}</div>
                    {session.isResolved && (
                      <div style={{ background: "#10b981", borderRadius: "50%", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icons.Check />
                      </div>
                    )}
                    {session.isOverLimit && (
                      <div style={{ background: "#f59e0b", color: "white", fontSize: "9px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px" }}>REQUEST</div>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {session.messages[0]?.message || "New Chat"}
                  </div>
                </div>
                {unreadCounts[session.sessionId] > 0 && (
                  <div style={{ background: "#ef4444", color: "white", fontSize: "10px", fontWeight: "700", padding: "4px 8px", borderRadius: "10px", minWidth: "20px", textAlign: "center" }}>
                    {unreadCounts[session.sessionId]}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff" }}>
        {activeSession ? (
          <>
            {/* ✅ DELETED SESSION HEADER */}
            {activeSessionDeleted ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", background: "#fef2f2" }}>
                <div style={{ textAlign: "center", maxWidth: "460px" }}>
                  <div style={{ fontSize: "72px", marginBottom: "20px" }}>🗑️</div>
                  <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#991b1b", marginBottom: "12px" }}>
                    Yeh Chat Automatically Delete Ho Gayi
                  </h2>
                  <div style={{ background: "white", border: "2px solid #fca5a5", borderRadius: "16px", padding: "20px", marginBottom: "24px" }}>
                    <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.7", margin: 0 }}>
                      Aapki <strong>{historyInfo.plan} plan</strong> mein chat history automatically delete ho jaati hai.
                      <br /><br />
                      <strong>📋 Retention Rules:</strong><br />
                      🆓 FREE: 30 din (test: 2 min)<br />
                      ⭐ STANDARD: 6 mahine<br />
                      👑 PREMIUM: Kabhi delete nahi
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                    <button
                      onClick={() => { setActiveSession(null); setActiveSessionDeleted(false); }}
                      style={{ padding: "12px 24px", borderRadius: "10px", border: "2px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "600", cursor: "pointer" }}
                    >
                      Back to Chats
                    </button>
                    <button
                      onClick={() => (window.location.href = "/app/subscription")}
                      style={{ padding: "12px 24px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)", color: "white", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(124,58,237,0.35)" }}
                    >
                      🚀 Upgrade Plan
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ padding: "20px 32px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: isActiveSessionOverLimit ? "#fef3c7" : "#fff" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <h3 style={{ margin: 0, fontWeight: "700", fontSize: "18px", color: "#111827" }}>{activeSession.email}</h3>
                      {isActiveSessionOverLimit && (
                        <div style={{ background: "#f59e0b", color: "white", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Icons.Lock /> Over Limit
                        </div>
                      )}
                      {activeSession.isResolved && !isActiveSessionOverLimit && (
                        <div style={{ background: "#d1fae5", color: "#065f46", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Icons.Check /> Resolved
                        </div>
                      )}
                    </div>
                    {isActiveSessionOverLimit && (
                      <div style={{ fontSize: "12px", color: "#92400e", marginTop: "4px", fontWeight: "500" }}>
                        This chat is over your plan limit. Upgrade to respond.
                      </div>
                    )}
                  </div>
                  {!isActiveSessionOverLimit && !activeSession.isResolved && (
                    <button onClick={handleMarkResolved} style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", fontWeight: "600", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 12px rgba(16,185,129,0.25)" }}>
                      <Icons.CheckCircle /> Mark as Resolved
                    </button>
                  )}
                  {!isActiveSessionOverLimit && activeSession.isResolved && (
                    <button onClick={handleReopenChat} style={{ padding: "10px 18px", borderRadius: "10px", border: "2px solid #f59e0b", background: "#fff", color: "#f59e0b", fontWeight: "600", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Icons.RotateCcw /> Reopen Chat
                    </button>
                  )}
                  {isActiveSessionOverLimit && (
                    <button onClick={() => (window.location.href = "/app/subscription")} style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: "#f59e0b", color: "#fff", fontWeight: "600", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Icons.TrendingUp /> Upgrade Plan
                    </button>
                  )}
                </div>

                <div ref={scrollRef} style={{ flex: 1, padding: "32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px", background: "#f9fafb" }}>
                  {messages.map((msg, i) => (
                    <div key={msg.id || i} style={{ alignSelf: msg.sender === "admin" ? "flex-end" : "flex-start", maxWidth: "65%" }}>
                      <div style={{ padding: "12px 16px", borderRadius: "16px", background: msg.sender === "admin" ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : msg.sender === "bot" ? "#fef3c7" : "#fff", color: msg.sender === "admin" ? "#fff" : "#111827", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: msg.sender === "admin" ? "none" : msg.sender === "bot" ? "1px solid #fbbf24" : "1px solid #e5e7eb" }}>
                        {msg.fileUrl ? (
                          msg.fileUrl.includes("image") || msg.fileUrl.startsWith("data:image") ? (
                            <img src={msg.fileUrl} onClick={() => setSelectedImage(msg.fileUrl)} style={{ maxWidth: "280px", borderRadius: "10px", cursor: "zoom-in" }} alt="attachment" />
                          ) : (
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <Icons.FileText />
                              <a href={msg.fileUrl} target="_blank" rel="noreferrer" style={{ color: "inherit", fontWeight: "600", textDecoration: "none" }}>View Document</a>
                            </div>
                          )
                        ) : (
                          <div style={{ fontSize: "14px", lineHeight: "1.5" }}>{msg.message}</div>
                        )}
                      </div>
                      <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px", textAlign: msg.sender === "admin" ? "right" : "left" }}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  ))}
                </div>

                {filePreview && !isActiveSessionOverLimit && (
                  <div style={{ padding: "12px 32px", background: "#fef3c7", borderTop: "2px solid #fbbf24", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ position: "relative" }}>
                      {filePreview.type.includes("image") ? (
                        <img src={filePreview.url} style={{ height: "50px", width: "50px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e5e7eb" }} alt="preview" />
                      ) : (
                        <div style={{ height: "50px", width: "50px", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px" }}><Icons.FileText /></div>
                      )}
                      <button onClick={() => setFilePreview(null)} style={{ position: "absolute", top: "-6px", right: "-6px", background: "#ef4444", borderRadius: "50%", border: "none", cursor: "pointer", padding: "4px", display: "flex" }}>
                        <Icons.X size={12} color="white" />
                      </button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>{filePreview.name}</div>
                      <div style={{ fontSize: "11px", color: "#6b7280" }}>Ready to send</div>
                    </div>
                  </div>
                )}

                {!isActiveSessionOverLimit ? (
                  <div style={{ padding: "20px 32px", background: "#fff", borderTop: "1px solid #e5e7eb", position: "relative" }}>
                    {showEmojiPicker && (
                      <div style={{ position: "absolute", bottom: "80px", left: "32px", background: "white", padding: "12px", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)", border: "1px solid #e5e7eb", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px", zIndex: 10 }}>
                        {emojis.map((e) => (
                          <button key={e} onClick={() => addEmoji(e)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", padding: "6px", borderRadius: "8px" }}>{e}</button>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", background: "#f9fafb", borderRadius: "12px", padding: "6px 8px", border: "1px solid #e5e7eb" }}>
                      <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelect} accept="image/*,.pdf" />
                      <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: "none", border: "none", cursor: "pointer", color: showEmojiPicker ? accentColor : "#9ca3af", padding: "8px" }}><Icons.Smile /></button>
                      <button onClick={() => fileInputRef.current.click()} style={{ background: "none", border: "none", cursor: "pointer", margin: "0 8px", color: "#9ca3af", padding: "8px" }}><Icons.Paperclip /></button>
                      <input
                        placeholder="Type a message..."
                        style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: "14px", color: "#111827" }}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onKeyPress={(e) => { if (e.key === "Enter") handleReply(); }}
                      />
                      <button
                        onClick={() => handleReply()}
                        style={{ width: "40px", height: "40px", borderRadius: "10px", background: reply.trim() || filePreview ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : "#e5e7eb", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Icons.Send />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "20px 32px", background: "#fef3c7", borderTop: "2px solid #fbbf24" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px", background: "white", borderRadius: "12px", border: "2px dashed #f59e0b" }}>
                      <Icons.Lock />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "#92400e", marginBottom: "4px" }}>Chat Locked - Over Plan Limit</div>
                        <div style={{ fontSize: "12px", color: "#92400e" }}>Upgrade your plan to respond to this customer</div>
                      </div>
                      <button onClick={() => (window.location.href = "/app/subscription")} style={{ padding: "8px 16px", background: "#f59e0b", color: "white", border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}>
                        Upgrade Now
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#d1d5db", gap: "16px", background: "#f9fafb" }}>
            <Icons.User size={80} />
            <p style={{ fontWeight: "600", fontSize: "16px", color: "#9ca3af" }}>Select a conversation to start chatting</p>
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div style={{ width: "320px", padding: "24px", background: "#fff", borderLeft: "1px solid #e5e7eb" }}>
        <h4 style={{ fontSize: "11px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 20 }}>Chat Details</h4>

        {/* Plan Usage */}
        <div style={{ marginBottom: "16px", padding: "16px", background: planLimit.isOverLimit ? "#fef3c7" : planLimit.isAtLimit ? "#fee2e2" : planLimit.isNearLimit ? "#fef3c7" : "#eff6ff", borderRadius: "12px", border: planLimit.isOverLimit ? "1px solid #fcd34d" : planLimit.isAtLimit ? "1px solid #fca5a5" : planLimit.isNearLimit ? "1px solid #fcd34d" : "1px solid #bfdbfe" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "8px", letterSpacing: "0.5px", color: planLimit.isOverLimit ? "#92400e" : planLimit.isAtLimit ? "#991b1b" : planLimit.isNearLimit ? "#92400e" : "#1e40af" }}>PLAN USAGE</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Icons.TrendingUp />
            <span style={{ fontSize: "24px", fontWeight: "800", color: planLimit.isOverLimit ? "#92400e" : planLimit.isAtLimit ? "#991b1b" : planLimit.isNearLimit ? "#92400e" : "#1e40af" }}>
              {planLimit.max > 0 ? `${withinLimitSessions.length}/${planLimit.max}` : sessions.length}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: planLimit.isOverLimit ? "#92400e" : planLimit.isAtLimit ? "#991b1b" : planLimit.isNearLimit ? "#92400e" : "#60a5fa" }}>
            {planLimit.isOverLimit ? `${planLimit.overLimitBy} request(s) in queue` : planLimit.isAtLimit ? "At limit - upgrade to continue" : `${planLimit.remaining} chat(s) remaining`}
          </div>
          {(planLimit.isAtLimit || planLimit.isOverLimit) && (
            <button onClick={() => (window.location.href = "/app/subscription")} style={{ marginTop: "12px", padding: "8px 12px", background: planLimit.isOverLimit ? "#f59e0b" : "#dc2626", color: "white", border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "12px", cursor: "pointer", width: "100%" }}>
              Upgrade Now
            </button>
          )}
        </div>

        {/* ✅ Chat History Retention Info */}
        <div style={{ marginBottom: "16px", padding: "14px", background: "#f0fdf4", borderRadius: "12px", border: "1px solid #86efac" }}>
          <div style={{ fontSize: "10px", color: "#166534", fontWeight: "700", marginBottom: "8px", letterSpacing: "0.5px" }}>CHAT RETENTION</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Icons.Trash />
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#166534" }}>
              {historyInfo.unlimited ? "Forever" : historyInfo.label}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#16a34a" }}>
            {historyInfo.plan} plan: {historyInfo.unlimited ? "Chats kabhi delete nahi hongi" : `${historyInfo.label} ke baad auto-delete`}
          </div>
        </div>

        {activeSession && !activeSessionDeleted && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ padding: "16px", background: activeSession.isResolved ? "#d1fae5" : isActiveSessionOverLimit ? "#fee2e2" : "#fef3c7", borderRadius: "12px", border: activeSession.isResolved ? "1px solid #86efac" : isActiveSessionOverLimit ? "1px solid #fca5a5" : "1px solid #fcd34d" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "8px", letterSpacing: "0.5px", color: activeSession.isResolved ? "#065f46" : isActiveSessionOverLimit ? "#991b1b" : "#92400e" }}>STATUS</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "15px", color: activeSession.isResolved ? "#065f46" : isActiveSessionOverLimit ? "#991b1b" : "#92400e" }}>
                {activeSession.isResolved ? <Icons.CheckCircle /> : isActiveSessionOverLimit ? <Icons.Lock /> : <Icons.AlertCircle />}
                {activeSession.isResolved ? "Resolved" : isActiveSessionOverLimit ? "Over Limit" : "Pending"}
              </div>
            </div>
            <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: "10px", color: "#9ca3af", fontWeight: "700", marginBottom: "8px", letterSpacing: "0.5px" }}>LOCAL TIME</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", fontSize: "14px", color: "#111827" }}>
                <Icons.Clock /> {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div style={{ padding: "16px", background: "#eff6ff", borderRadius: "12px", border: "1px solid #bfdbfe" }}>
              <div style={{ fontSize: "10px", color: "#1e40af", fontWeight: "700", marginBottom: "8px", letterSpacing: "0.5px" }}>MESSAGES</div>
              <div style={{ fontSize: "28px", fontWeight: "800", color: "#1e40af" }}>{messages.length}</div>
              <div style={{ fontSize: "11px", color: "#60a5fa", marginTop: 4 }}>Total exchanges</div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f3f4f6; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      `}</style>
    </div>
  );
}